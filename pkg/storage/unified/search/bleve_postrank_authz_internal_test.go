package search

import (
	"testing"

	"github.com/grafana/authlib/authz"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestPostRankAuthzConfigWindowSize(t *testing.T) {
	cfg := PostRankAuthzConfig{OverFetchFactor: 5, MaxWindow: 10000}.effective()
	assert.Equal(t, 500, cfg.windowSize(100))
	assert.Equal(t, 5000, cfg.windowSize(1000))
	// Clamped to MaxWindow.
	assert.Equal(t, 10000, cfg.windowSize(100000))
}

func TestPostRankAuthzConfigGrowWindow(t *testing.T) {
	cfg := PostRankAuthzConfig{OverFetchFactor: 1, MaxWindow: 40}.effective()
	base := cfg.windowSize(10) // 10

	// First window is the base; each subsequent window doubles.
	assert.Equal(t, 10, cfg.growWindow(base, 0))
	assert.Equal(t, 20, cfg.growWindow(base, 1))
	assert.Equal(t, 40, cfg.growWindow(base, 2))
	// Growth saturates at MaxWindow and stays there.
	assert.Equal(t, 40, cfg.growWindow(base, 3))
	assert.Equal(t, 40, cfg.growWindow(base, 99))

	// When the base already equals MaxWindow, growth is a no-op.
	flat := PostRankAuthzConfig{OverFetchFactor: 5, MaxWindow: 100}.effective()
	fb := flat.windowSize(1000) // clamped to 100
	assert.Equal(t, 100, flat.growWindow(fb, 5))
}

func TestAuthzResourcesVerb(t *testing.T) {
	idx := &bleveIndex{key: resource.NamespacedResource{Namespace: "default", Group: "folder.grafana.app", Resource: "folders"}}
	for perm, verb := range map[dashboardaccess.PermissionType]string{
		0:                                 utils.VerbGet,
		dashboardaccess.PERMISSION_EDIT:   utils.VerbUpdate,
		dashboardaccess.PERMISSION_CREATE: utils.VerbCreate,
	} {
		got := idx.authzResources(&resourcepb.ResourceSearchRequest{Permission: int64(perm)})
		assert.Equal(t, map[string]string{"folders": verb}, got, "permission %v", perm)
	}
}

func TestAuthzResourcesCreateOnlyAppliesToFolders(t *testing.T) {
	idx := &bleveIndex{key: resource.NamespacedResource{Namespace: "default", Group: dashboardGroup, Resource: "dashboards"}}
	got := idx.authzResources(&resourcepb.ResourceSearchRequest{Permission: int64(dashboardaccess.PERMISSION_CREATE)})
	assert.Equal(t, map[string]string{"dashboards": utils.VerbGet}, got)
}

func TestBatchCheckItem(t *testing.T) {
	folder := docInfo{namespace: "default", group: "folder.grafana.app", resourceType: "folders", name: "team-a", folder: "public"}

	edit := folder
	edit.verb = utils.VerbUpdate
	assert.Equal(t, authz.BatchCheckItem{Namespace: "default", Group: "folder.grafana.app", Resource: "folders", Name: "team-a", Folder: "public", Verb: utils.VerbUpdate}, batchCheckItem(edit))

	create := folder
	create.verb = utils.VerbCreate
	assert.Equal(t, authz.BatchCheckItem{Namespace: "default", Group: dashboardGroup, Resource: "dashboards", Folder: "team-a", Verb: utils.VerbCreate}, batchCheckItem(create))
}
