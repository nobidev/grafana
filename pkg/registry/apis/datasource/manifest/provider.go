package manifest

import (
	"fmt"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// ManifestOpenAPIExtensionProvider provides OpenAPI extensions based on plugin manifests
type ManifestOpenAPIExtensionProvider struct {
	converter *ManifestConverter
}

// NewManifestExtensionProvider creates a new manifest extension provider
func NewManifestExtensionProvider() *ManifestOpenAPIExtensionProvider {
	return &ManifestOpenAPIExtensionProvider{
		converter: NewManifestConverter(),
	}
}

// GetExtensionForPlugin attempts to convert a plugin's manifest data to OpenAPI extension
func (p *ManifestOpenAPIExtensionProvider) GetExtensionForPlugin(plugin *pluginstore.Plugin) (*datasourceV0.DataSourceOpenAPIExtension, error) {
	if plugin == nil {
		return nil, fmt.Errorf("plugin is nil")
	}

	// Check if the plugin has manifest data
	if plugin.ManifestData == nil {
		// Return nil if no manifest data - this is expected for plugins without manifests
		return nil, nil
	}

	// Convert manifest to OpenAPI extension
	extension, err := p.converter.ConvertManifestToOpenAPIExtension(plugin.ManifestData)
	if err != nil {
		return nil, fmt.Errorf("failed to convert manifest to OpenAPI extension: %w", err)
	}

	return extension, nil
}
