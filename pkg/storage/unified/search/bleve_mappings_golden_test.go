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
	builderProvider := func(name string, build func() (resource.DocumentBuilderInfo, error)) func(t *testing.T) (resource.SearchFieldsProvider, string, string) {
		return func(t *testing.T) (resource.SearchFieldsProvider, string, string) {
			t.Helper()
			info, err := build()
			require.NoError(t, err, "build %s", name)
			return info.SearchFieldsProvider, info.GroupResource.Group, info.GroupResource.Resource
		}
	}

	cases := []struct {
		name             string
		provider         func(t *testing.T) (resource.SearchFieldsProvider, string, string)
		selectableFields []string
		path             string
	}{
		{
			name: "empty",
			path: "testdata/bleve_mapping_empty.json",
		},
		{
			name:             "selectable_fields",
			selectableFields: []string{"spec.title", "spec.description"},
			path:             "testdata/bleve_mapping_selectable_fields.json",
		},
		{
			name:     "dashboard",
			provider: builderProvider("dashboard", func() (resource.DocumentBuilderInfo, error) { return builders.DashboardBuilder(nil) }),
			path:     "testdata/bleve_mapping_dashboard.json",
		},
		{
			name:     "user",
			provider: builderProvider("user", builders.GetUserBuilder),
			path:     "testdata/bleve_mapping_user.json",
		},
		{
			name:     "team",
			provider: builderProvider("team", builders.GetTeamSearchBuilder),
			path:     "testdata/bleve_mapping_team.json",
		},
		{
			name:     "team_binding",
			provider: builderProvider("team_binding", builders.GetTeamBindingBuilder),
			path:     "testdata/bleve_mapping_team_binding.json",
		},
		{
			name:     "external_group_mapping",
			provider: builderProvider("external_group_mapping", builders.GetExternalGroupMappingBuilder),
			path:     "testdata/bleve_mapping_external_group_mapping.json",
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
			var provider resource.SearchFieldsProvider
			var group, kindResource string
			if tc.provider != nil {
				provider, group, kindResource = tc.provider(t)
			}

			mappings, err := search.GetBleveMappings(provider, group, kindResource, tc.selectableFields)
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
