package resources

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestPathCreationError(t *testing.T) {
	t.Run("Error method returns formatted message", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		expectedMsg := "failed to create path grafana/folder-1: underlying error"
		require.Equal(t, expectedMsg, pathErr.Error())
	})

	t.Run("Unwrap returns underlying error", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		unwrapped := pathErr.Unwrap()
		require.Equal(t, underlyingErr, unwrapped)
		require.EqualError(t, unwrapped, "underlying error")
	})

	t.Run("errors.Is finds underlying error", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		require.True(t, errors.Is(pathErr, underlyingErr))
		require.False(t, errors.Is(pathErr, fmt.Errorf("different error")))
	})

	t.Run("errors.As extracts PathCreationError", func(t *testing.T) {
		underlyingErr := fmt.Errorf("underlying error")
		pathErr := &PathCreationError{
			Path: "grafana/folder-1",
			Err:  underlyingErr,
		}

		var extractedErr *PathCreationError
		require.True(t, errors.As(pathErr, &extractedErr))
		require.NotNil(t, extractedErr)
		require.Equal(t, "grafana/folder-1", extractedErr.Path)
		require.Equal(t, underlyingErr, extractedErr.Err)
	})

	t.Run("errors.As returns false for non-PathCreationError", func(t *testing.T) {
		regularErr := fmt.Errorf("regular error")

		var extractedErr *PathCreationError
		require.False(t, errors.As(regularErr, &extractedErr))
		require.Nil(t, extractedErr)
	})
}

func TestEffectiveFolderID(t *testing.T) {
	const hashID = "hash-derived-uid"
	const stableUID = "stable-uid-from-folder-json"

	// Build valid _folder.json data.
	manifest := NewFolderManifest(stableUID, "my-folder")
	validData, err := json.Marshal(manifest)
	require.NoError(t, err)

	t.Run("flag off returns hashID without reading repo", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		// No expectations: effectiveFolderID must not call Config() or Read() when flag is off.

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), false)
		result := fm.effectiveFolderID(context.Background(), "my-folder/", hashID)

		assert.Equal(t, hashID, result)
		rw.AssertNotCalled(t, "Read", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("flag on and valid _folder.json returns stable UID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: validData}, nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), true)
		result := fm.effectiveFolderID(context.Background(), "my-folder/", hashID)

		assert.Equal(t, stableUID, result)
	})

	t.Run("flag on and read error falls back to hashID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(nil, errors.New("file not found"))

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), true)
		result := fm.effectiveFolderID(context.Background(), "my-folder/", hashID)

		assert.Equal(t, hashID, result)
	})

	t.Run("flag on and invalid JSON falls back to hashID", func(t *testing.T) {
		rw := repository.NewMockReaderWriter(t)
		rw.On("Read", mock.Anything, "my-folder/_folder.json", "").
			Return(&repository.FileInfo{Data: []byte("not-json")}, nil)

		fm := NewFolderManager(rw, nil, NewEmptyFolderTree(), true)
		result := fm.effectiveFolderID(context.Background(), "my-folder/", hashID)

		assert.Equal(t, hashID, result)
	})
}

func TestCreateFolderWithUID(t *testing.T) {
	t.Run("top-level folder (no parent)", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "my-top-level-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		mockClient := &MockDynamicResourceInterface{}
		// EnsureFolderExists: Get returns NotFound, then Create succeeds.
		mockClient.On("Get", mock.Anything, stableUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableUID))
		mockClient.On("Create", mock.Anything, mock.Anything, metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil)

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), false)
		err := fm.CreateFolderWithUID(ctx, "myfolder/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder with parent already in tree", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		// Pre-populate tree with the parent's hash-derived ID so EnsureFolderPathExist
		// finds it immediately without needing to create it.
		tree := NewEmptyFolderTree()
		parentFolder := ParseFolder("parent/", config.Name)
		tree.Add(parentFolder, "")

		mockClient := &MockDynamicResourceInterface{}
		// EnsureFolderExists for child only: Get returns NotFound, then Create succeeds.
		mockClient.On("Get", mock.Anything, stableUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableUID))
		mockClient.On("Create", mock.Anything, mock.Anything, metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil)

		fm := NewFolderManager(rw, mockClient, tree, false)
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})

	t.Run("nested folder where parent needs to be created", func(t *testing.T) {
		ctx := context.Background()
		const stableUID = "child-stable-uid"

		config := newTestRepoConfig("test-repo")
		rw := repository.NewMockReaderWriter(t)
		rw.On("Config").Return(config)

		parentFolder := ParseFolder("parent/", config.Name)

		mockClient := &MockDynamicResourceInterface{}
		// EnsureFolderExists for parent: Get returns NotFound, then Create succeeds.
		mockClient.On("Get", mock.Anything, parentFolder.ID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, parentFolder.ID))
		mockClient.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil).Once()
		// EnsureFolderExists for child: Get returns NotFound, then Create succeeds.
		mockClient.On("Get", mock.Anything, stableUID, metav1.GetOptions{}, []string(nil)).
			Return(nil, apierrors.NewNotFound(schema.GroupResource{}, stableUID))
		mockClient.On("Create", mock.Anything, mock.AnythingOfType("*unstructured.Unstructured"), metav1.CreateOptions{}, []string(nil)).
			Return(nil, nil).Once()

		fm := NewFolderManager(rw, mockClient, NewEmptyFolderTree(), false)
		err := fm.CreateFolderWithUID(ctx, "parent/child/", stableUID)

		require.NoError(t, err)
		mockClient.AssertExpectations(t)
	})
}
