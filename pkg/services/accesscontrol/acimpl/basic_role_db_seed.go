package acimpl

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ossBasicRoleSeedLockName  = "oss-ac-basic-role-seeder"
	ossBasicRoleSeedTimeout   = 2 * time.Minute
	ossBasicRolePermBatchSize = 500
)

// getBasicRolePermissionsLocked copies the current in-memory permissions for each basic role - needs to be called with s.rolesMu held
func (s *Service) getBasicRolePermissionsLocked() map[string][]accesscontrol.Permission {
	out := make(map[string][]accesscontrol.Permission, len(s.roles))
	for role, r := range s.roles {
		if r == nil {
			continue
		}
		perms := make([]accesscontrol.Permission, len(r.Permissions))
		copy(perms, r.Permissions)
		out[role] = perms
	}
	return out
}

// refreshBasicRolePermissionsInDB is run at startup or when plugins declare new roles - syncs the in-memory permissions to the db
func (s *Service) refreshBasicRolePermissionsInDB(ctx context.Context, permissions map[string][]accesscontrol.Permission) error {
	if s.sql == nil {
		return nil
	}

	runTx := func(ctx context.Context) error {
		return s.sql.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			return s.seedBasicRolePermissionsTx(sess, permissions)
		})
	}

	if s.serverLock == nil {
		return runTx(ctx)
	}

	var runErr error
	if err := s.serverLock.LockExecuteAndRelease(ctx, ossBasicRoleSeedLockName, ossBasicRoleSeedTimeout, func(ctx context.Context) {
		runErr = runTx(ctx)
	}); err != nil {
		return err
	}
	return runErr
}

// seedBasicRolePermissionsTx removes duplicates from in-memory permissions and then reconciles the db for each role
func (s *Service) seedBasicRolePermissionsTx(sess *db.Session, rolesSnapshot map[string][]accesscontrol.Permission) error {
	ts := time.Now()
	defs := accesscontrol.BuildBasicRoleDefinitions()

	for builtinRole, def := range defs {
		roleID, err := ensureBasicRole(sess, builtinRole, def, ts)
		if err != nil {
			return err
		}

		desired := dedupePermissions(rolesSnapshot[builtinRole])
		if err := reconcileRolePermissions(sess, roleID, desired, ts); err != nil {
			return fmt.Errorf("failed to reconcile basic role permissions for %s: %w", builtinRole, err)
		}
	}

	return nil
}

type dbPermissionRow struct {
	ID         int64  `xorm:"id"`
	Action     string `xorm:"action"`
	Scope      string `xorm:"scope"`
	Kind       string `xorm:"kind"`
	Attribute  string `xorm:"attribute"`
	Identifier string `xorm:"identifier"`
}

// reconcileRolePermissions makes the DB permissions for roleID match the desired set.
// specifically it: deletes extras, inserts missing, and normalizes derived columns.
func reconcileRolePermissions(sess *db.Session, roleID int64, desired []accesscontrol.Permission, ts time.Time) error {
	current := make([]dbPermissionRow, 0)
	if err := sess.SQL(
		"SELECT id, action, scope, kind, attribute, identifier FROM permission WHERE role_id = ?",
		roleID,
	).Find(&current); err != nil {
		return err
	}

	wanted := make(map[string]accesscontrol.Permission, len(desired))
	for i := range desired {
		p := desired[i].OSSPermission()
		wanted[permissionKey(p.Action, p.Scope)] = p
	}

	have := make(map[string]dbPermissionRow, len(current))
	for i := range current {
		have[permissionKey(current[i].Action, current[i].Scope)] = current[i]
	}

	// delete permissions that exist in DB but are not desired
	toDeleteIDs := make([]int64, 0)
	for key, row := range have {
		if _, ok := wanted[key]; !ok {
			toDeleteIDs = append(toDeleteIDs, row.ID)
		}
	}
	if err := deletePermissionsByID(sess, toDeleteIDs); err != nil {
		return err
	}

	// insert permissions that are desired but missing
	toInsert := make([]accesscontrol.Permission, 0)
	for key, p := range wanted {
		if _, ok := have[key]; ok {
			continue
		}
		insert := accesscontrol.Permission{
			RoleID:  roleID,
			Action:  p.Action,
			Scope:   p.Scope,
			Created: ts,
			Updated: ts,
		}
		insert.Kind, insert.Attribute, insert.Identifier = accesscontrol.SplitScope(insert.Scope)
		toInsert = append(toInsert, insert)
	}
	for i := 0; i < len(toInsert); {
		end := i + ossBasicRolePermBatchSize
		if end > len(toInsert) {
			end = len(toInsert)
		}
		if _, err := sess.InsertMulti(toInsert[i:end]); err != nil {
			return err
		}
		i = end
	}

	// normalize derived columns for permissions that exist in both sets
	for key, row := range have {
		p, ok := wanted[key]
		if !ok {
			continue
		}
		kind, attr, ident := accesscontrol.SplitScope(p.Scope)
		if row.Kind == kind && row.Attribute == attr && row.Identifier == ident {
			continue
		}
		if _, err := sess.Exec(
			"UPDATE permission SET kind = ?, attribute = ?, identifier = ?, updated = ? WHERE id = ?",
			kind, attr, ident, ts, row.ID,
		); err != nil {
			return err
		}
	}

	return nil
}

// deletePermissionsByID deletes permissions by IDs, in batches
func deletePermissionsByID(sess *db.Session, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	for i := 0; i < len(ids); {
		end := i + ossBasicRolePermBatchSize
		if end > len(ids) {
			end = len(ids)
		}
		sub := ids[i:end]
		if _, err := sess.Table("permission").In("id", sub).Delete(&accesscontrol.Permission{}); err != nil {
			return err
		}
		i = end
	}
	return nil
}

// ensureBasicRole ensures that the basic role and role binding exists in the db
func ensureBasicRole(sess *db.Session, builtinRole string, def *accesscontrol.RoleDTO, ts time.Time) (int64, error) {
	var existing accesscontrol.Role
	has, err := sess.Table("role").Where("uid = ?", def.UID).Get(&existing)
	if err != nil {
		return 0, err
	}

	if !has {
		role := accesscontrol.Role{
			OrgID:       def.OrgID,
			Version:     def.Version,
			UID:         def.UID,
			Name:        def.Name,
			DisplayName: def.DisplayName,
			Group:       def.Group,
			Description: def.Description,
			Hidden:      def.Hidden,
			Created:     ts,
			Updated:     ts,
		}
		if _, err := sess.Table("role").Insert(&role); err != nil {
			return 0, err
		}

		// re-fetch to get ID
		if _, err := sess.Table("role").Where("uid = ?", def.UID).Get(&existing); err != nil {
			return 0, err
		}
	} else {
		// ensure role name, etc are what is expected
		roleUpdate := accesscontrol.Role{
			OrgID:       def.OrgID,
			UID:         def.UID,
			Name:        def.Name,
			DisplayName: def.DisplayName,
			Group:       def.Group,
			Description: def.Description,
			Hidden:      def.Hidden,
			Updated:     ts,
		}
		if _, err := sess.Table("role").ID(existing.ID).
			Cols("org_id", "uid", "name", "display_name", "group_name", "description", "hidden", "updated").
			Update(&roleUpdate); err != nil {
			return 0, err
		}
	}

	// ensure builtin_role binding exists
	var br accesscontrol.BuiltinRole
	ok, err := sess.Table("builtin_role").
		Where("role_id = ? AND role = ? AND org_id = ?", existing.ID, builtinRole, accesscontrol.GlobalOrgID).
		Get(&br)
	if err != nil {
		return 0, err
	}
	if !ok {
		if _, err := sess.Table("builtin_role").Insert(&accesscontrol.BuiltinRole{
			RoleID:  existing.ID,
			OrgID:   accesscontrol.GlobalOrgID,
			Role:    builtinRole,
			Updated: ts,
			Created: ts,
		}); err != nil {
			return 0, err
		}
	}

	return existing.ID, nil
}

func dedupePermissions(perms []accesscontrol.Permission) []accesscontrol.Permission {
	seen := make(map[string]struct{}, len(perms))
	out := make([]accesscontrol.Permission, 0, len(perms))
	for i := range perms {
		key := permissionKey(perms[i].Action, perms[i].Scope)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, perms[i].OSSPermission())
	}
	return out
}

func permissionKey(action, scope string) string {
	return action + "\x00" + scope
}
