package manifest

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestManifestConverter_ConvertManifestToOpenAPIExtension(t *testing.T) {
	converter := NewManifestConverter()

	// Create test manifest data with minimal schema
	manifestData := &app.ManifestData{
		AppName: "test-datasource",
		Group:   "test-datasource.grafana.app",
		Kinds: []app.ManifestKind{
			{
				Kind:  "DataSourceConfig",
				Scope: "Namespaced",
				Versions: []app.ManifestKindVersion{
					{
						Name: "v1",
						// Note: Schema is nil for this test to avoid complex schema creation
					},
				},
			},
		},
	}

	// Test conversion
	extension, err := converter.ConvertManifestToOpenAPIExtension(manifestData)
	require.NoError(t, err)
	require.NotNil(t, extension)
	// Since the schema is nil, no schemas should be added
	assert.Empty(t, extension.Schemas)
}

func TestManifestConverter_ConvertManifestToOpenAPIExtension_NilManifest(t *testing.T) {
	converter := NewManifestConverter()

	// Test with nil manifest
	extension, err := converter.ConvertManifestToOpenAPIExtension(nil)
	assert.Error(t, err)
	assert.Nil(t, extension)
	assert.Contains(t, err.Error(), "manifest data is nil")
}

func TestManifestConverter_ConvertManifestToOpenAPIExtension_EmptyKinds(t *testing.T) {
	converter := NewManifestConverter()

	// Test with manifest that has no kinds
	manifestData := &app.ManifestData{
		AppName: "test-datasource",
		Group:   "test-datasource.grafana.app",
		Kinds:   []app.ManifestKind{},
	}

	extension, err := converter.ConvertManifestToOpenAPIExtension(manifestData)
	require.NoError(t, err)
	require.NotNil(t, extension)
	assert.Empty(t, extension.Schemas)
}
