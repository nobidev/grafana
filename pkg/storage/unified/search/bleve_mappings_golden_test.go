package search_test

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// Run with -update-golden to regenerate the JSON snapshots after an
// intentional change to the bleve mapping shape:
//
//	go test ./pkg/storage/unified/search/ -run TestBleveMappingsGoldenJSON -update-golden
var updateGolden = flag.Bool("update-golden", false, "regenerate bleve mapping golden JSON files")

// TestBleveMappingsGoldenJSON pins the bleve index mapping shape produced by
// GetBleveMappings to JSON snapshots committed under testdata. Each snapshot
// captures the current on-disk shape; when an intentional change to the
// mapping ships, regenerate with -update-golden and review the diff. Any
// unintended drift trips this test.
//
// The standard search fields (title, title_phrase, title_ngram, description,
// tags, folder, ownerReferences, createdBy, managedBy, manager.*, source.*,
// labels.*, reference.*, created, updated) are part of the mapping returned
// by GetBleveMappings even with nil inputs, so the "empty" case below already
// captures their full bleve representation. A separate snapshot of the
// raw StandardSearchFields column definitions would not add information.
//
// The per-kind cases (dashboard, user, team, team_binding,
// external_group_mapping) feed each in-tree builder's SearchableDocumentFields
// through GetBleveMappings and capture the resulting per-kind fields.*
// sub-document. They guard against accidental shape drift while the
// manifest-driven search-fields work moves the source of truth from column
// definitions to SearchFieldsProvider declarations.
func TestBleveMappingsGoldenJSON(t *testing.T) {
	filterableStringFields := func(t *testing.T) resource.SearchableDocumentFields {
		t.Helper()
		f, err := resource.NewSearchableDocumentFields([]*resourcepb.ResourceTableColumnDefinition{
			{
				// A typical per-kind custom field: filterable STRING. Today's
				// inner-loop output is a single keyword mapping at fields.<name>.
				Name: "panel_types",
				Type: resourcepb.ResourceTableColumnDefinition_STRING,
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					Filterable: true,
				},
			},
			{
				// A non-filterable STRING: no explicit mapping today.
				Name: "panel_title",
				Type: resourcepb.ResourceTableColumnDefinition_STRING,
			},
			{
				// A non-string column: no explicit mapping today.
				Name: "schema_version",
				Type: resourcepb.ResourceTableColumnDefinition_INT32,
			},
		})
		require.NoError(t, err)
		return f
	}

	dashboardFields := func(t *testing.T) resource.SearchableDocumentFields {
		t.Helper()
		info, err := builders.DashboardBuilder(nil)
		require.NoError(t, err)
		return info.Fields
	}
	userFields := func(t *testing.T) resource.SearchableDocumentFields {
		t.Helper()
		info, err := builders.GetUserBuilder()
		require.NoError(t, err)
		return info.Fields
	}
	teamFields := func(t *testing.T) resource.SearchableDocumentFields {
		t.Helper()
		info, err := builders.GetTeamSearchBuilder()
		require.NoError(t, err)
		return info.Fields
	}
	teamBindingFields := func(t *testing.T) resource.SearchableDocumentFields {
		t.Helper()
		info, err := builders.GetTeamBindingBuilder()
		require.NoError(t, err)
		return info.Fields
	}
	externalGroupMappingFields := func(t *testing.T) resource.SearchableDocumentFields {
		t.Helper()
		info, err := builders.GetExternalGroupMappingBuilder()
		require.NoError(t, err)
		return info.Fields
	}

	cases := []struct {
		name             string
		fields           func(t *testing.T) resource.SearchableDocumentFields
		provider         func(t *testing.T) (resource.SearchFieldsProvider, string, string)
		selectableFields []string
		path             string
	}{
		{
			name: "empty",
			path: "testdata/bleve_mapping_empty.json",
		},
		{
			name:   "filterable_string_field",
			fields: filterableStringFields,
			path:   "testdata/bleve_mapping_filterable_string.json",
		},
		{
			name:             "selectable_fields",
			selectableFields: []string{"spec.title", "spec.description"},
			path:             "testdata/bleve_mapping_selectable_fields.json",
		},
		{
			name:   "dashboard",
			fields: dashboardFields,
			path:   "testdata/bleve_mapping_dashboard.json",
		},
		{
			name:   "user",
			fields: userFields,
			path:   "testdata/bleve_mapping_user.json",
		},
		{
			name:   "team",
			fields: teamFields,
			path:   "testdata/bleve_mapping_team.json",
		},
		{
			name:   "team_binding",
			fields: teamBindingFields,
			path:   "testdata/bleve_mapping_team_binding.json",
		},
		{
			name:   "external_group_mapping",
			fields: externalGroupMappingFields,
			path:   "testdata/bleve_mapping_external_group_mapping.json",
		},
		{
			// Provider-driven path: a kind whose bleve mapping comes from
			// SearchFieldDefinitions rather than column definitions. Exercises
			// the type-aware filter rule: string+filter emits an explicit
			// keyword mapping, non-string+filter falls back to dynamic.
			name: "provider_driven",
			provider: func(t *testing.T) (resource.SearchFieldsProvider, string, string) {
				t.Helper()
				gvr := schema.GroupVersionResource{Group: "example.test", Version: "v0", Resource: "widgets"}
				p := resource.NewMapProvider(
					map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
						gvr: {
							{Name: "label", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
							{Name: "count", Type: resource.SearchFieldTypeInt64, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
							{Name: "active", Type: resource.SearchFieldTypeBoolean, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve}},
							{Name: "description", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityText, resource.SearchCapabilityRetrieve}},
						},
					},
					map[schema.GroupResource]string{
						gvr.GroupResource(): gvr.Version,
					},
				)
				return p, gvr.Group, gvr.Resource
			},
			path: "testdata/bleve_mapping_provider_driven.json",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var fields resource.SearchableDocumentFields
			if tc.fields != nil {
				fields = tc.fields(t)
			}
			var provider resource.SearchFieldsProvider
			var group, kindResource string
			if tc.provider != nil {
				provider, group, kindResource = tc.provider(t)
			}

			mappings, err := search.GetBleveMappings(fields, provider, group, kindResource, tc.selectableFields)
			require.NoError(t, err)

			got, err := json.MarshalIndent(mappings, "", "  ")
			require.NoError(t, err)
			got = append(got, '\n')

			compareOrUpdateGolden(t, tc.path, got)
		})
	}
}

func compareOrUpdateGolden(t *testing.T, path string, got []byte) {
	t.Helper()
	if *updateGolden {
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o750))
		require.NoError(t, os.WriteFile(path, got, 0o600))
		return
	}
	want, err := os.ReadFile(path) //nolint:gosec // path comes from a hardcoded test case
	require.NoError(t, err, "missing golden file %s; regenerate with -update-golden", path)
	assert.Equal(t, strings.TrimSpace(string(want)), strings.TrimSpace(string(got)),
		"golden snapshot changed; if intended, rerun with -update-golden")
}
