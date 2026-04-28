package dashboard

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestExtractor_Resource(t *testing.T) {
	require.Equal(t, "dashboards", New().Resource())
}

func TestExtractor_Classic(t *testing.T) {
	// Classic v1 dashboard with two panels and one row marker. The shared
	// parser doesn't associate flat-row panels with their row marker, so
	// we don't expect "Errors → 5xx rate" here — the row name only
	// surfaces for collapsed rows (next test).
	body := map[string]any{
		"uid":         "dash-uid-1",
		"title":       "API Latency",
		"description": "Production API latency dashboard",
		"tags":        []any{"production", "latency"},
		"panels": []any{
			map[string]any{
				"id":          1,
				"title":       "p99 latency",
				"description": "99th percentile across all routes",
				"datasource":  map[string]any{"uid": "prom-1", "type": "prometheus"},
				"targets": []any{
					map[string]any{
						"refId":      "A",
						"datasource": map[string]any{"uid": "prom-1", "type": "prometheus"},
						"expr":       `histogram_quantile(0.99, sum(rate(http_duration_seconds_bucket[5m])) by (le))`,
					},
				},
			},
			map[string]any{
				"id":    2,
				"title": "5xx rate",
				"datasource": map[string]any{
					"uid": "prom-1", "type": "prometheus",
				},
				"targets": []any{
					map[string]any{
						"expr": `sum(rate(http_requests_total{status=~"5.."}[5m]))`,
					},
				},
			},
		},
		"meta": map[string]any{
			"folderTitle": "Production",
			"folderUid":   "folder-prod",
		},
	}
	value, _ := json.Marshal(body)

	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Resource: "dashboards", Name: "dash-uid-1"}, value)
	require.NoError(t, err)
	require.Len(t, items, 2)

	assert.Equal(t, "dash-uid-1", items[0].UID)
	assert.Equal(t, "API Latency — p99 latency", items[0].Title)
	assert.Equal(t, "panel/1", items[0].Subresource)
	assert.Equal(t, "folder-prod", items[0].Folder)
	assert.Contains(t, items[0].Content, "Production → API Latency → p99 latency")
	assert.Contains(t, items[0].Content, "histogram_quantile")
	assert.Contains(t, items[0].Content, "Tags: production, latency")

	assert.Equal(t, "panel/2", items[1].Subresource)
	assert.Contains(t, items[1].Content, `sum(rate(http_requests_total{status=~"5.."}[5m]))`)

	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	assert.Equal(t, "API Latency", md["dashboard_title"])
	assert.ElementsMatch(t, []any{"production", "latency"}, md["tags"])
	assert.Equal(t, []any{"prom-1"}, md["datasource_uids"])
	assert.Equal(t, []any{"promql"}, md["query_languages"])
}

func TestExtractor_CollapsedRow(t *testing.T) {
	// A row with collapsed panels — the shared parser captures this in
	// PanelSummaryInfo.Collapsed and we surface it as the row name.
	body := map[string]any{
		"uid":   "dash-collapsed",
		"title": "Collapsed Dashboard",
		"panels": []any{
			map[string]any{
				"id":    99,
				"type":  "row",
				"title": "Errors",
				"panels": []any{
					map[string]any{
						"id":      5,
						"title":   "Inside the row",
						"targets": []any{map[string]any{"expr": "up"}},
					},
				},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "dash-collapsed"}, value)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "panel/5", items[0].Subresource)
	assert.Contains(t, items[0].Content, "Errors → Inside the row")

	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	assert.Equal(t, "Errors", md["row_name"])
}

func TestExtractor_V2_Structural(t *testing.T) {
	// V2 (k8s-shape) dashboards have known limitations until the shared
	// parser is extended:
	//   - Panel IDs aren't captured → subresource falls back to `panel/pN`
	//   - Datasource refs aren't captured → no datasource_uids in metadata
	//   - Query expressions aren't captured → no query content embedded
	// Title, description, tags, and panel titles/descriptions DO work.
	body := map[string]any{
		"apiVersion": "dashboard.grafana.app/v2beta1",
		"metadata": map[string]any{
			"name": "v2-dash",
			"annotations": map[string]any{
				"grafana.app/folderTitle": "Engineering",
				"grafana.app/folder":      "folder-eng",
			},
		},
		"spec": map[string]any{
			"title": "Service Health",
			"tags":  []any{"v2"},
			"elements": map[string]any{
				"panel-a": map[string]any{
					"kind": "Panel",
					"spec": map[string]any{
						"id":          1,
						"title":       "Request rate",
						"description": "Per-route request rate",
						"vizConfig":   map[string]any{"kind": "TimeseriesPanel", "spec": map[string]any{}},
						"data": map[string]any{
							"kind": "QueryGroup",
							"spec": map[string]any{
								"queries": []any{
									map[string]any{
										"kind": "PanelQuery",
										"spec": map[string]any{
											"datasource": map[string]any{"uid": "prom-2", "type": "prometheus"},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "v2-dash"}, value)
	require.NoError(t, err)
	require.Len(t, items, 1)

	assert.Equal(t, "v2-dash", items[0].UID)
	assert.Equal(t, "Service Health — Request rate", items[0].Title)
	// V2 panels lack IDs in the shared parser, so subresource is positional.
	assert.Equal(t, "panel/p0", items[0].Subresource)
	assert.Equal(t, "folder-eng", items[0].Folder)
	assert.Contains(t, items[0].Content, "Engineering → Service Health → Request rate")
	assert.Contains(t, items[0].Content, "Per-route request rate")
	assert.Contains(t, items[0].Content, "Tags: v2")

	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	// V2 limitation: no datasource_uids / query_languages until upstream fix.
	assert.Nil(t, md["datasource_uids"])
	assert.Nil(t, md["query_languages"])
}

func TestExtractor_DashboardWithoutPanels(t *testing.T) {
	body := map[string]any{
		"uid":   "empty",
		"title": "Empty",
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "empty"}, value)
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestExtractor_MissingUIDFallsBackToKeyName(t *testing.T) {
	body := map[string]any{
		"title": "Untitled",
		"panels": []any{
			map[string]any{
				"id":      1,
				"title":   "Panel",
				"targets": []any{map[string]any{"expr": "up"}},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "from-key"}, value)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, "from-key", items[0].UID)
}

func TestExtractor_SQLQueries(t *testing.T) {
	body := map[string]any{
		"uid":   "sql-dash",
		"title": "Reports",
		"panels": []any{
			map[string]any{
				"id":         1,
				"title":      "Daily revenue",
				"datasource": map[string]any{"uid": "pg-1", "type": "postgres"},
				"targets": []any{
					map[string]any{
						"refId":  "A",
						"rawSql": "SELECT date, SUM(amount) FROM orders GROUP BY date",
					},
				},
			},
		},
	}
	value, _ := json.Marshal(body)
	items, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "sql-dash"}, value)
	require.NoError(t, err)
	require.Len(t, items, 1)
	var md map[string]any
	require.NoError(t, json.Unmarshal(items[0].Metadata, &md))
	assert.Equal(t, []any{"sql"}, md["query_languages"])
	assert.Contains(t, items[0].Content, "SELECT date, SUM(amount) FROM orders")
}

func TestExtractor_InvalidJSON(t *testing.T) {
	_, err := New().Extract(context.Background(),
		&resourcepb.ResourceKey{Name: "bad"}, []byte(`{not json`))
	require.Error(t, err)
}
