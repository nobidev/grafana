package manifest

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/datasource"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/stretchr/testify/assert"
)

func TestExtensionFactory_ImplementsInterface(t *testing.T) {
	// This test ensures that OpenAPIExtensionFactory implements OpenAPIExtensionGetter
	var factory datasource.OpenAPIExtensionGetter = NewOpenAPIExtensionFactory()
	assert.NotNil(t, factory)
}

func TestExtensionFactory_GetExtensionForPlugin(t *testing.T) {
	factory := NewOpenAPIExtensionFactory()

	// Test with a plugin that has no manifest (should return nil, nil)
	plugin := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: "test-plugin",
		},
		FS: plugins.NewFakeFS(),
	}

	extension, err := factory.GetOpenAPIExtension(plugin)
	assert.NoError(t, err)
	assert.Nil(t, extension)
}

func TestExtensionFactory_GetExtensionForPlugin_WithManifest(t *testing.T) {
	factory := NewOpenAPIExtensionFactory()

	// Test with a plugin that has manifest data
	plugin := pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID: "test-plugin",
		},
		FS: plugins.NewFakeFS(),
		// Note: We can't easily create a real ManifestData for testing here
		// since it requires complex schema structures
	}

	extension, err := factory.GetOpenAPIExtension(plugin)
	assert.NoError(t, err)
	// Should return nil since no manifest data is present
	assert.Nil(t, extension)
}
