package manifest

import (
	"fmt"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

// OpenAPIExtensionFactory creates OpenAPI extensions for datasource plugins
type OpenAPIExtensionFactory struct {
	provider *ManifestOpenAPIExtensionProvider
}

// NewOpenAPIExtensionFactory creates a new OpenAPI extension factory
func NewOpenAPIExtensionFactory() *OpenAPIExtensionFactory {
	return &OpenAPIExtensionFactory{
		provider: NewManifestExtensionProvider(),
	}
}

// GetOpenAPIExtension gets the OpenAPI extension for a datasource plugin
func (f *OpenAPIExtensionFactory) GetOpenAPIExtension(plugin pluginstore.Plugin) (*datasourceV0.DataSourceOpenAPIExtension, error) {
	// Try to get extension from manifest data
	extension, err := f.provider.GetExtensionForPlugin(&plugin)
	if err != nil {
		return nil, fmt.Errorf("failed to get extension from manifest: %w", err)
	}

	// If no extension found, return nil (this is expected for plugins without manifests)
	if extension == nil {
		return nil, nil
	}

	return extension, nil
}
