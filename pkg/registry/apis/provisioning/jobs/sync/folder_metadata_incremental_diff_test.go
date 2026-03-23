package sync

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestFolderMetadataIncrementalDiffBuilder_BuildIncrementalDiff(t *testing.T) {
	t.Run("returns unchanged diff when no folder metadata changes exist", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "dashboards/test.json", Ref: "new-ref"},
			{Action: repository.FileActionDeleted, Path: "dashboards/old.json", PreviousRef: "old-ref"},
		}

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{})

		require.NoError(t, err)
		require.Equal(t, diff, filteredDiff)
		require.Empty(t, replacedFolders)
	})

	t.Run("creates folder replay and direct child updates for metadata creation on existing folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}
		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Contains(t, replacedFolders, replacedFolder{
			Path:   "myfolder/",
			OldUID: "hash-uid",
		})
	})

	t.Run("metadata updates with unchanged uid do not mark the folder as replaced", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Empty(t, replacedFolders)
	})

	t.Run("metadata updates with changed uid mark the folder as replaced", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "new-stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "old-stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "old-stable-uid",
		}}, replacedFolders)
	})

	t.Run("invalid metadata update on existing folder keeps replay without replacement", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "myfolder/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref",
		})
		require.Empty(t, replacedFolders)
		require.Len(t, invalidFolderMetadata, 1)
		require.ErrorIs(t, invalidFolderMetadata[0], resources.ErrInvalidFolderMetadata)
	})

	t.Run("invalid metadata creation on new folder still emits folder replay", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "myfolder/_folder.json", "new-ref").Return(&repository.FileInfo{
			Data: []byte(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":""},"spec":{"title":"Broken"}}`),
		}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
		require.Len(t, invalidFolderMetadata, 1)
		require.ErrorIs(t, invalidFolderMetadata[0], resources.ErrInvalidFolderMetadata)
	})

	t.Run("does not duplicate synthetic child updates when the real diff already contains them", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/dashboard.json", Ref: "new-ref"},
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "hash-uid",
		}}, replacedFolders)
	})

	t.Run("skips synthetic update for renamed direct child old path", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionRenamed, Path: "myfolder/dashboard-renamed.json", PreviousPath: "myfolder/dashboard.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action:       repository.FileActionRenamed,
			Path:         "myfolder/dashboard-renamed.json",
			PreviousPath: "myfolder/dashboard.json",
			PreviousRef:  "old-ref",
			Ref:          "new-ref",
		})
		require.NotContains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Contains(t, replacedFolders, replacedFolder{
			Path:   "myfolder/",
			OldUID: "hash-uid",
		})
	})

	t.Run("only emits direct children and not grandchildren for metadata creation", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "parent/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "parent/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "parent/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "parent/child/",
				},
				{
					Name:     "grandchild-dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "parent/child/dash.json",
				},
				{
					Name:     "sibling-dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "parent/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/dashboard.json",
			Ref:    "new-ref",
		})
		require.NotContains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/child/dash.json",
			Ref:    "new-ref",
		})
		require.Contains(t, replacedFolders, replacedFolder{
			Path:   "parent/",
			OldUID: "hash-uid",
		})
	})

	t.Run("creates folder update replay when metadata is added for a brand-new folder", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "myfolder/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "myfolder/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
	})

	t.Run("metadata deletion while folder remains emits folder update, direct child updates, and replacement", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").Return(&repository.FileInfo{Path: "myfolder/"}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "child-folder-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/child/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "myfolder/dashboard.json",
			Ref:    "new-ref",
		})
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "stable-uid",
		}}, replacedFolders)
	})

	t.Run("metadata deletion while folder directory is gone only schedules replacement", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").
			Return((*repository.FileInfo)(nil), repository.ErrFileNotFound).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "stable-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
			},
		})

		require.NoError(t, err)
		require.Empty(t, filteredDiff)
		require.Equal(t, []replacedFolder{{
			Path:   "myfolder/",
			OldUID: "stable-uid",
		}}, replacedFolders)
	})

	t.Run("metadata deletion with unchanged fallback uid only emits folder update", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionDeleted, Path: "myfolder/_folder.json", PreviousRef: "old-ref"},
		}

		hashUID := resources.ParseFolder("myfolder/", repo.Config().Name).ID
		repo.MockReader.On("Read", mock.Anything, "myfolder/", "new-ref").Return(&repository.FileInfo{Path: "myfolder/"}, nil).Once()

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     hashUID,
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "myfolder/",
				},
				{
					Name:     "dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "myfolder/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Equal(t, []repository.VersionedFileChange{
			{Action: repository.FileActionUpdated, Path: "myfolder/", Ref: "new-ref"},
		}, filteredDiff)
		require.Empty(t, replacedFolders)
	})

	t.Run("renamed metadata file is split out and produces empty diff", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionRenamed, Path: "renamed/_folder.json", PreviousPath: "old/_folder.json", PreviousRef: "old-ref", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "renamed/", "new-ref", "stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, invalidFolderMetadata, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{})

		require.NoError(t, err)
		require.Empty(t, filteredDiff)
		require.Empty(t, replacedFolders)
		require.Empty(t, invalidFolderMetadata)
	})

	t.Run("nested metadata changes are both expanded deterministically", func(t *testing.T) {
		repo := newCompositeRepoWithConfig(t)
		diff := []repository.VersionedFileChange{
			{Action: repository.FileActionCreated, Path: "parent/_folder.json", Ref: "new-ref"},
			{Action: repository.FileActionCreated, Path: "parent/child/_folder.json", Ref: "new-ref"},
		}

		expectFolderMetadataReadTimes(repo, "parent/child/", "new-ref", "child-stable-uid", 1)
		expectFolderMetadataReadTimes(repo, "parent/", "new-ref", "parent-stable-uid", 1)

		diffBuilder := NewFolderMetadataIncrementalDiffBuilder(repo)
		filteredDiff, replacedFolders, _, err := diffBuilder.BuildIncrementalDiff(context.Background(), "new-ref", diff, &provisioning.ResourceList{
			Items: []provisioning.ResourceListItem{
				{
					Name:     "parent-hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "parent/",
				},
				{
					Name:     "child-hash-uid",
					Group:    resources.FolderResource.Group,
					Resource: resources.FolderResource.Resource,
					Path:     "parent/child/",
				},
				{
					Name:     "parent-dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "parent/dashboard.json",
				},
				{
					Name:     "child-dash-uid",
					Group:    "dashboards",
					Resource: "dashboards",
					Path:     "parent/child/dashboard.json",
				},
			},
		})

		require.NoError(t, err)
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/child/",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/dashboard.json",
			Ref:    "new-ref",
		})
		require.Contains(t, filteredDiff, repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   "parent/child/dashboard.json",
			Ref:    "new-ref",
		})
		childFolderReplayCount := 0
		for _, change := range filteredDiff {
			if change.Action == repository.FileActionUpdated && change.Path == "parent/child/" && change.Ref == "new-ref" {
				childFolderReplayCount++
			}
		}
		require.Equal(t, 1, childFolderReplayCount)
		require.Equal(t, []replacedFolder{
			{Path: "parent/child/", OldUID: "child-hash-uid"},
			{Path: "parent/", OldUID: "parent-hash-uid"},
		}, replacedFolders)
	})
}

func expectFolderMetadataReadTimes(repo *compositeRepo, folderPath, ref, uid string, times int) {
	repo.MockReader.On("Read", mock.Anything, folderPath+"_folder.json", ref).Return(&repository.FileInfo{
		Data: []byte(fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v1beta1","kind":"Folder","metadata":{"name":"%s"},"spec":{"title":"Title"}}`, uid)),
	}, nil).Times(times)
}
