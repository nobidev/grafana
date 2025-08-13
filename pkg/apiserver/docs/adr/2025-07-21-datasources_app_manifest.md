# ADR-001: Manifest-Based Datasource Schema System

**Date:** 2025-07-21
**Status:** Implemented (Refactored)
**Type:** Architecture Decision Record

## Context

The Grafana API Server currently uses hardcoded OpenAPI schemas for datasource plugins. This approach is inflexible and requires code changes to add schema support for new plugins. We need a more dynamic and extensible system that allows plugins to define their own schemas.

## Decision

We will implement a manifest-based schema system that derives OpenAPI schemas for datasource plugins from `app.Manifest` files. When a plugin has a `manifest.json` file in its package, the system will automatically read, parse, and load it as `app.ManifestData`, converting the `Kinds` field into `DataSourceOpenAPIExtension.Schemas`.

## Implementation

### 🔧 **Refactored Architecture** (Manifest as Plugin Property)

The system has been refactored to integrate manifest loading directly into the plugin lifecycle:

1. **`loader.go`** - Core manifest conversion logic (no longer handles file loading)
2. **`provider.go`** - Clean interface for extension providers
3. **`factory.go`** - Factory that creates OpenAPI extensions from manifest data
4. **`loader_test.go`** - Tests for the converter functionality
5. **`README.md`** - Comprehensive documentation

### 🔄 **Integration Points**

- **Plugin Structs** - Added `ManifestData *app.ManifestData` field to both `plugins.Plugin` and `pluginstore.Plugin`
- **Bootstrap Pipeline** - Added `ManifestLoadingDecorateFunc` to automatically load manifests during plugin bootstrap
- **`register.go`** - Added `extensionFactory` parameter to `RegisterAPIService`
- **`NewDataSourceAPIBuilder`** - Accepts `OpenAPIExtensionGetter` as parameter
- **`wireset.go`** - Added `NewOpenAPIExtensionFactory` to dependency injection

### 🎯 **Key Features**

1. **Automatic Discovery**: Manifests are automatically loaded during plugin bootstrap
2. **Schema Conversion**: Converts `app.VersionSchema` to OpenAPI `spec.Schema`
3. **Plugin Integration**: Manifest data is stored as a property of the plugin
4. **Error Handling**: Graceful handling of missing manifests (non-blocking)
5. **Type Safety**: Uses strongly typed `app.Manifest` structures

### 🔄 **How It Works**

1. **Plugin Discovery**: Plugins are discovered as before
2. **Bootstrap**: During bootstrap, `ManifestLoadingDecorateFunc` automatically checks for and loads `manifest.json` files
3. **Storage**: Manifest data is stored in the `Plugin.ManifestData` field
4. **API Usage**: When OpenAPI extensions are needed, the factory accesses the pre-loaded manifest data
5. **Conversion**: The `ManifestConverter` converts the manifest data to OpenAPI schemas

### ✅ **Benefits**

- **Integrated**: Manifest loading is now part of the standard plugin lifecycle
- **Performance**: Manifests are loaded once during bootstrap, not on every API call
- **Clean Architecture**: The manifest package now has a single, clear responsibility
- **Automatic**: All plugins automatically get manifest support without additional configuration
- **Consistent**: Manifest data flows naturally through the plugin system
- **Backward Compatible**: Existing plugins without manifests continue to work normally

## Recent Refactoring (2025-01-27)

### 🔧 **Architecture Simplification**

The manifest system has been refactored to integrate directly with the plugin loader machinery:

#### **Changes Made**

1. **Added ManifestData to Plugin Structs**:
   - Added `ManifestData *app.ManifestData` field to both `plugins.Plugin` and `pluginstore.Plugin`
   - Updated `ToGrafanaDTO` function to properly transfer manifest data between the two types

2. **Integrated Manifest Loading into Bootstrap Pipeline**:
   - Added `ManifestLoadingDecorateFunc` to the bootstrap pipeline that automatically loads `manifest.json` files
   - Added to `DefaultDecorateFuncs` so manifest loading happens automatically during plugin bootstrap
   - Manifest loading is non-blocking - plugins without manifests continue to work normally

3. **Simplified Manifest Package**:
   - Removed file loading logic from the manifest package (now handled by plugin loader)
   - Renamed `PluginManifestLoader` to `ManifestConverter` to reflect its new single responsibility
   - Simplified to just handle conversion from `app.ManifestData` to OpenAPI extensions
   - Updated provider and factory to work with pre-loaded manifest data

4. **Updated Dependency Injection**:
   - Updated wireset to use the new `OpenAPIExtensionFactory`
   - Fixed interface bindings to ensure proper dependency injection

5. **Cleaned Up Code**:
   - Removed manifest.json checking from plugin discovery (now handled by bootstrap)
   - Removed unused validation step that was checking for manifest files
   - Updated tests to work with the new structure
   - Removed example manifest file that's no longer needed

#### **Technical Benefits**

- **Cleaner Architecture**: Manifest loading is now part of the standard plugin lifecycle
- **Better Performance**: Manifests are loaded once during bootstrap, not on every API call
- **Simplified Code**: The manifest package now has a single, clear responsibility
- **Automatic Integration**: All plugins automatically get manifest support without additional configuration
- **Consistent Data Flow**: Manifest data flows naturally through the plugin system

### 🔧 **Schema Conversion Enhancement**

The schema conversion logic has been improved to use the proper `AsKubeOpenAPI` method from the grafana-app-sdk instead of manual JSON marshaling/unmarshaling.

#### **Changes Made**

1. **Updated `convertSchemaToOpenAPI` method in `loader.go`**:
   - Replaced JSON marshaling/unmarshaling approach with `versionSchema.AsKubeOpenAPI(gvk, ref)`
   - Added proper imports for `schema.GroupVersionKind` and `common.ReferenceCallback`
   - Extracts the main schema from the returned definitions map (excluding kind and list objects)

2. **Fixed Type Compatibility Issues**:
   - Updated method signatures to accept `pluginstore.Plugin` instead of `*plugins.Plugin`
   - Updated `GetExtensionForPlugin` in `factory.go` and `provider.go`
   - Updated `LoadManifestFromPlugin` in `loader.go`
   - Added proper imports for `pluginstore` package

3. **Enhanced Test Coverage**:
   - Modified test to provide proper OpenAPI document structure with "spec" field
   - This allows the `AsKubeOpenAPI` method to work correctly

#### **Technical Benefits**

- **Proper API Usage**: Now uses the intended `AsKubeOpenAPI` method from grafana-app-sdk
- **Better Schema Handling**: Provides more robust schema conversion with proper OpenAPI structure
- **Type Safety**: Fixed compatibility issues between `pluginstore.Plugin` and `*plugins.Plugin`
- **Maintainability**: Uses the established SDK patterns instead of custom conversion logic

#### **Implementation Details**

The `convertSchemaToOpenAPI` method now:
1. Creates a dummy `schema.GroupVersionKind` for schema conversion
2. Calls `versionSchema.AsKubeOpenAPI(gvk, ref)` with a simple reference callback
3. Iterates through the returned definitions to find the main schema (excluding kind/list objects)
4. Returns the extracted `spec.Schema` for use in the OpenAPI extension

This approach leverages the full power of the grafana-app-sdk's schema conversion capabilities while maintaining backward compatibility.

## Example Usage

### For Plugin Developers

To add schema support to your datasource plugin, create a `manifest.json` file in your plugin's root directory:

```json
{
  "appName": "my-datasource",
  "group": "my-datasource.grafana.app",
  "kinds": [
    {
      "kind": "DataSourceConfig",
      "scope": "Namespaced",
      "versions": [
        {
          "name": "v1",
          "schema": {
            "spec": {
              "type": "object",
              "properties": {
                "url": {
                  "type": "string",
                  "description": "The URL of the datasource"
                },
                "apiKey": {
                  "type": "string",
                  "description": "API key for authentication",
                  "x-secure": true
                }
              },
              "required": ["url", "apiKey"]
            }
          }
        }
      ]
    }
  ]
}
```

**Note**: The schema should be structured with a "spec" field to work properly with the `AsKubeOpenAPI` method.

## Migration Path

The system is designed to be easily removable if necessary:

1. Remove the `extensionFactory` parameter from `NewDataSourceAPIBuilder`
2. Remove the `extensionFactory` parameter from `RegisterAPIService`
3. Remove `NewOpenAPIExtensionFactory` from the wire set
4. Restore the hardcoded extension logic in `RegisterAPIService`
5. Delete the `manifest/` directory

This ensures that the changes can be easily reverted if needed.

## Consequences

### Positive

- **Dynamic Schema Support**: Plugins can now define their own schemas without code changes
- **Better Developer Experience**: Plugin developers have more control over their API schemas
- **Reduced Maintenance**: Less need to maintain hardcoded schemas in Grafana core
- **Type Safety**: Uses the established `app.Manifest` structure
- **Proper SDK Integration**: Now uses the intended `AsKubeOpenAPI` method for schema conversion
- **Integrated Architecture**: Manifest loading is part of the core plugin system
- **Better Performance**: Manifests are loaded once during bootstrap

### Negative

- **Additional Complexity**: Introduces new components to the codebase
- **Plugin Requirements**: Plugins need to include manifest files for full schema support
- **Learning Curve**: Plugin developers need to understand the manifest format

### Neutral

- **Backward Compatibility**: Existing plugins continue to work with hardcoded fallbacks
- **Modular Design**: Components can be easily removed if needed
- **Automatic Integration**: Manifests are automatically loaded without additional configuration

## Alternatives Considered

1. **Code Generation**: Generate schemas from plugin code annotations
   - **Pros**: More integrated with existing development workflow
   - **Cons**: Requires changes to plugin development process, more complex

2. **API-First Approach**: Define schemas through API endpoints
   - **Pros**: Dynamic runtime configuration
   - **Cons**: More complex, potential security concerns

3. **Configuration Files**: Use separate configuration files for schemas
   - **Pros**: Simple, familiar approach
   - **Cons**: Duplicates manifest concept, less integrated

4. **Manual JSON Conversion**: Continue using manual JSON marshaling/unmarshaling
   - **Pros**: Simple implementation
   - **Cons**: Doesn't leverage SDK capabilities, less robust

5. **Separate File Loading**: Keep manifest loading separate from plugin loading
   - **Pros**: Independent systems
   - **Cons**: Duplicate file I/O, more complex integration, performance overhead

## References

- [Grafana App SDK Documentation](https://github.com/grafana/grafana-app-sdk)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Kubernetes CRD Schema](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/)
