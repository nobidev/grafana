package libraryelements

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
)

// FolderConsumer reports and deletes library elements by folder for the folder reconciler.
type FolderConsumer struct {
	sqlStore db.DB
}

func ProvideFolderConsumer(sqlStore db.DB) *FolderConsumer {
	return &FolderConsumer{sqlStore: sqlStore}
}

func (c *FolderConsumer) Name() string { return "library-elements" }

func (c *FolderConsumer) FoldersInUse(ctx context.Context, orgID int64) ([]string, error) {
	var uids []string
	err := c.sqlStore.WithDbSession(ctx, func(session *db.Session) error {
		return session.SQL("SELECT DISTINCT folder_uid FROM library_element WHERE org_id=?", orgID).Find(&uids)
	})
	return uids, err
}

func (c *FolderConsumer) DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error {
	return c.sqlStore.WithTransactionalDbSession(ctx, func(session *db.Session) error {
		_, err := session.Exec("DELETE FROM library_element WHERE folder_uid=? AND org_id=?", folderUID, orgID)
		return err
	})
}
