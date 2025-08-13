package manifest

import (
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// ManifestConverter handles converting plugin manifest data to OpenAPI extensions
type ManifestConverter struct{}

// NewManifestConverter creates a new manifest converter
func NewManifestConverter() *ManifestConverter {
	return &ManifestConverter{}
}

// ConvertManifestToOpenAPIExtension converts app.ManifestData to DataSourceOpenAPIExtension
func (c *ManifestConverter) ConvertManifestToOpenAPIExtension(manifestData *app.ManifestData) (*datasourceV0.DataSourceOpenAPIExtension, error) {
	if manifestData == nil {
		return nil, fmt.Errorf("manifest data is nil")
	}

	extension := &datasourceV0.DataSourceOpenAPIExtension{
		Schemas: make(map[string]*spec.Schema),
	}

	// Convert each kind in the manifest to OpenAPI schemas
	for _, kind := range manifestData.Kinds {
		for _, version := range kind.Versions {
			if version.Schema == nil {
				continue
			}

			// Convert the schema to OpenAPI format
			schema, err := c.convertSchemaToOpenAPI(version.Schema)
			if err != nil {
				return nil, fmt.Errorf("failed to convert schema for kind %s version %s: %w", kind.Kind, version.Name, err)
			}

			// Use a consistent naming scheme for the schema
			schemaKey := fmt.Sprintf("%s%s", kind.Kind, version.Name)
			extension.Schemas[schemaKey] = schema
		}
	}

	return extension, nil
}

// convertSchemaToOpenAPI converts app.VersionSchema to spec.Schema
func (c *ManifestConverter) convertSchemaToOpenAPI(versionSchema *app.VersionSchema) (*spec.Schema, error) {
	if versionSchema == nil {
		return nil, fmt.Errorf("version schema is nil")
	}

	// Create a dummy GVK for the schema conversion
	// The actual GVK doesn't matter for this conversion since we're just extracting the schema
	gvk := schema.GroupVersionKind{
		Group:   "test.grafana.app",
		Version: "v1",
		Kind:    "TestKind",
	}

	// Use AsKubeOpenAPI to convert the schema
	definitions, err := versionSchema.AsKubeOpenAPI(gvk, func(path string) spec.Ref {
		return spec.Ref{}
	})
	if err != nil {
		return nil, fmt.Errorf("failed to convert schema using AsKubeOpenAPI: %w", err)
	}

	// Find the main schema (not the kind or list objects)
	// The main schema should be the one that represents the actual resource schema
	var mainSchema *spec.Schema
	for key, def := range definitions {
		// Skip the kind and list objects, look for the main schema
		if !strings.HasSuffix(key, ".TestKind") && !strings.HasSuffix(key, ".TestKindList") {
			// Take the first non-kind, non-list schema we find
			mainSchema = &def.Schema
			break
		}
	}

	if mainSchema == nil {
		return nil, fmt.Errorf("no main schema found in AsKubeOpenAPI result")
	}

	return mainSchema, nil
}
