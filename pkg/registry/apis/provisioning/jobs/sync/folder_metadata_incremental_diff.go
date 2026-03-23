package sync

import (
	"context"
	"errors"
	"fmt"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

//go:generate mockery --name FolderMetadataIncrementalDiffBuilder --structname MockFolderMetadataIncrementalDiffBuilder --inpackage --filename incremental_diff_builder_mock.go --with-expecter
type FolderMetadataIncrementalDiffBuilder interface {
	BuildIncrementalDiff(
		ctx context.Context,
		currentRef string,
		repoDiff []repository.VersionedFileChange,
		resourcesList *provisioning.ResourceList,
	) ([]repository.VersionedFileChange, []replacedFolder, []*resources.InvalidFolderMetadata, error)
}

type folderMetadataIncrementalDiffBuilder struct {
	repo repository.Reader
}

type replacedFolder struct {
	Path   string
	OldUID string
}

// NewFolderMetadataIncrementalDiffBuilder wires the repository reader used to
// rewrite `_folder.json` changes into the directory/resource diff entries
// consumed by incremental apply.
func NewFolderMetadataIncrementalDiffBuilder(
	repo repository.Reader,
) *folderMetadataIncrementalDiffBuilder {
	return &folderMetadataIncrementalDiffBuilder{
		repo: repo,
	}
}

// BuildIncrementalDiff rewrites handled `_folder.json` create/update/delete
// events into synthetic folder changes plus direct-child updates.
//
// The rebuilder keeps unrelated git changes intact, preserves real diff paths,
// and returns any old folder UIDs that must be deleted after the rewritten diff
// is applied.
func (d *folderMetadataIncrementalDiffBuilder) BuildIncrementalDiff(
	ctx context.Context,
	currentRef string,
	repoDiff []repository.VersionedFileChange,
	resourcesList *provisioning.ResourceList,
) ([]repository.VersionedFileChange, []replacedFolder, []*resources.InvalidFolderMetadata, error) {
	input := splitMetadataChanges(repoDiff)
	if !input.HasMetadataChanges() {
		return repoDiff, nil, nil, nil
	}

	index := newManagedResourceIndex(resourcesList)
	diffTracker := newRebuiltIncrementalDiffTracker(input.otherChanges)
	invalid := make([]*resources.InvalidFolderMetadata, 0)

	for _, change := range input.MetadataChanges() {
		warnings, err := d.rewriteMetadataChange(ctx, currentRef, input, index, diffTracker, change)
		if err != nil {
			return nil, nil, nil, err
		}
		invalid = append(invalid, warnings...)
	}

	return diffTracker.IncrementalDiff(), diffTracker.ReplacedFolders(), invalid, nil
}

// rewriteMetadataChange dispatches each handled metadata action to the
// specialized rewrite flow for create/update or delete semantics.
// Renamed `_folder.json` entries are dropped from the rewritten diff because
// folder moves are driven by the directory rename entry, not by replaying the
// metadata file as a separate resource rename.
func (d *folderMetadataIncrementalDiffBuilder) rewriteMetadataChange(
	ctx context.Context,
	currentRef string,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
	change repository.VersionedFileChange,
) ([]*resources.InvalidFolderMetadata, error) {
	switch change.Action {
	case repository.FileActionCreated, repository.FileActionUpdated:
		return d.rewriteCreatedOrUpdatedMetadataChange(ctx, input, index, diffTracker, change)
	case repository.FileActionDeleted:
		return d.rewriteDeletedMetadataChange(ctx, currentRef, input, index, diffTracker, change)
	case repository.FileActionRenamed:
		return d.collectInvalidRenamedMetadataChange(ctx, currentRef, change)
	default:
		return nil, nil
	}
}

// rewriteCreatedOrUpdatedMetadataChange turns a metadata create or update into
// a synthetic folder update plus any direct-child updates needed to replay the
// new folder identity through the standard incremental apply path.
func (d *folderMetadataIncrementalDiffBuilder) rewriteCreatedOrUpdatedMetadataChange(
	ctx context.Context,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
	change repository.VersionedFileChange,
) ([]*resources.InvalidFolderMetadata, error) {
	folderPath := folderPathForMetadataChange(change.Path)
	folder, invalidMetaErrors, err := d.readMetadata(ctx, folderPath, change.Ref, change.Action)
	if err != nil {
		return nil, err
	}

	// In case the folder path is not in the original diff, and we didn't generate a change yet,
	// we append an update change for it.
	if !input.HadChangeOriginallyAt(folderPath) && !diffTracker.HasGeneratedPath(folderPath) {
		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   folderPath,
			Ref:    change.Ref,
		})
	}

	replaced, err := d.replacementForMetadataChange(index, folderPath, folder)
	if err != nil {
		return nil, err
	}
	if replaced != nil {
		diffTracker.AppendReplaced(*replaced)
	}

	for _, childPath := range index.DirectChildrenOf(folderPath) {
		// Skip children that already have a real diff entry, are going to be
		// handled by their own metadata rewrite (e.g. folders with metadata changes),
		// or were already emitted while expanding a deeper metadata change.
		// That keeps the rewritten diff stable and avoids replaying the same child more than once.
		if input.HadChangeOriginallyAt(childPath) || input.HasMetadataFolderAt(childPath) || diffTracker.HasGeneratedPath(childPath) {
			continue
		}

		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   childPath,
			Ref:    change.Ref,
		})
	}

	return invalidMetaErrors, nil
}

// rewriteDeletedMetadataChange handles `_folder.json` deletion by either
// reverting the folder to its path-derived identity when the directory still
// exists, or by scheduling direct cleanup when the whole folder is gone.
func (d *folderMetadataIncrementalDiffBuilder) rewriteDeletedMetadataChange(
	ctx context.Context,
	currentRef string,
	input folderMetadataDiffSplit,
	index managedResourceIndex,
	diffTracker *rebuiltIncrementalDiffTracker,
	change repository.VersionedFileChange,
) ([]*resources.InvalidFolderMetadata, error) {
	folderPath := folderPathForMetadataChange(change.Path)
	existing := index.ExistingAt(folderPath)
	if existing == nil {
		return nil, nil
	}

	replacement, directoryExists, err := d.replacementForDeletedMetadataChange(ctx, currentRef, folderPath, existing)
	if err != nil {
		return nil, err
	}

	if replacement != nil {
		diffTracker.AppendReplaced(*replacement)
	}

	if !directoryExists {
		return nil, nil
	}

	if !input.HadChangeOriginallyAt(folderPath) && !diffTracker.HasGeneratedPath(folderPath) {
		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   folderPath,
			Ref:    currentRef,
		})
	}

	if replacement == nil {
		return nil, nil
	}

	for _, childPath := range index.DirectChildrenOf(folderPath) {
		// Skip children that already have a real diff entry, are going to be
		// handled by their own metadata rewrite (e.g. folders with metadata changes),
		// or were already emitted while expanding a deeper metadata change.
		// That keeps the rewritten diff stable and avoids replaying the same child more than once.
		if input.HadChangeOriginallyAt(childPath) || input.HasMetadataFolderAt(childPath) || diffTracker.HasGeneratedPath(childPath) {
			continue
		}

		diffTracker.Append(repository.VersionedFileChange{
			Action: repository.FileActionUpdated,
			Path:   childPath,
			Ref:    currentRef,
		})
	}

	return nil, nil
}

// collectInvalidRenamedMetadataChange inspects the destination metadata file of
// a rename and converts invalid folder metadata into an action-aware warning.
// Renamed metadata entries themselves do not produce replayed diff entries.
func (d *folderMetadataIncrementalDiffBuilder) collectInvalidRenamedMetadataChange(
	ctx context.Context,
	currentRef string,
	change repository.VersionedFileChange,
) ([]*resources.InvalidFolderMetadata, error) {
	_, invalid, err := d.readMetadata(ctx, folderPathForMetadataChange(change.Path), currentRef, change.Action)
	return invalid, err
}

// readMetadata reads `_folder.json` once and returns either the parsed folder
// metadata or an action-aware invalid metadata warning.
//
// Invalid or missing metadata intentionally returns a nil folder with no hard
// error. Callers still replay the folder path so apply can fall back to the
// existing folder at that path or to the path-derived unstable UID, but they do
// not treat that case as a confirmed identity replacement because there is no
// trustworthy metadata-defined UID to compare against.
func (d *folderMetadataIncrementalDiffBuilder) readMetadata(
	ctx context.Context,
	folderPath string,
	ref string,
	action repository.FileAction,
) (*folders.Folder, []*resources.InvalidFolderMetadata, error) {
	folder, _, err := resources.ReadFolderMetadata(ctx, d.repo, folderPath, ref)
	if err == nil {
		return folder, nil, nil
	}
	if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
		return nil, nil, nil
	}

	var invalidErr *resources.InvalidFolderMetadata
	if errors.As(err, &invalidErr) {
		return nil, []*resources.InvalidFolderMetadata{invalidErr.WithAction(action)}, nil
	}

	return nil, nil, fmt.Errorf("read folder metadata for %s: %w", folderPath, err)
}

// replacementForMetadataChange determines whether a metadata change at a folder
// path actually replaces the current folder identity.
//
// A folder is only marked for later deletion when the managed folder already
// exists at that path and the UID resolved from the new `_folder.json` differs
// from the existing folder UID.
func (d *folderMetadataIncrementalDiffBuilder) replacementForMetadataChange(
	index managedResourceIndex,
	folderPath string,
	folder *folders.Folder,
) (*replacedFolder, error) {
	existing := index.ExistingAt(folderPath)
	// Replacements are only scheduled for confirmed identity transitions. If the
	// managed folder does not exist yet, or metadata could not be parsed into a
	// trustworthy folder identity, replay still happens but there is no old UID
	// to delete after apply.
	if existing == nil || folder == nil {
		return nil, nil
	}
	if folder.GetName() == existing.Name {
		return nil, nil
	}

	return &replacedFolder{
		Path:   folderPath,
		OldUID: existing.Name,
	}, nil
}

// replacementForDeletedMetadataChange determines whether deleting _folder.json
// changes the current folder identity.
//
// When the directory still exists at currentRef, the folder falls back to its
// path-derived UID. When the directory is gone, the existing folder can be
// cleaned up directly without emitting any other changes.
func (d *folderMetadataIncrementalDiffBuilder) replacementForDeletedMetadataChange(
	ctx context.Context,
	currentRef string,
	folderPath string,
	existing *provisioning.ResourceListItem,
) (*replacedFolder, bool, error) {
	_, err := d.repo.Read(ctx, folderPath, currentRef)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) || apierrors.IsNotFound(err) {
			return &replacedFolder{
				Path:   folderPath,
				OldUID: existing.Name,
			}, false, nil
		}
		return nil, false, fmt.Errorf("read folder directory %s at ref %s: %w", folderPath, currentRef, err)
	}

	folder := resources.ParseFolder(folderPath, d.repo.Config().Name)
	if folder.ID == existing.Name {
		return nil, true, nil
	}

	return &replacedFolder{
		Path:   folderPath,
		OldUID: existing.Name,
	}, true, nil
}

// folderPathForMetadataChange converts a `_folder.json` file path into the
// normalized folder path used by managed-resource lookups and synthetic diff
// entries.
func folderPathForMetadataChange(metadataPath string) string {
	return safepath.EnsureTrailingSlash(safepath.Dir(metadataPath))
}
