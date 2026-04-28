// Package dashboard implements an embed.Extractor for Grafana dashboards.
// It reuses pkg/services/store/kind/dashboard for structural parsing (the
// same code path the bleve search index runs) and supplements with a
// focused pass to capture query expressions, which the shared parser
// drops.
package dashboard

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	dashparse "github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/embed"
)

// Extractor produces one Item per panel.
type Extractor struct {
	lookup dashparse.DatasourceLookup
}

func New() *Extractor {
	// Empty lookup — the dashboard parser only uses it to resolve
	// references; query parsing doesn't depend on it.
	return &Extractor{
		lookup: dashparse.CreateDatasourceLookup(nil),
	}
}

func (e *Extractor) Resource() string { return "dashboards" }

// Extract reads the dashboard via the shared streaming parser, supplements
// with query expressions and folder annotations, and returns one Item per
// panel.
func (e *Extractor) Extract(ctx context.Context, key *resourcepb.ResourceKey, value []byte) ([]embed.Item, error) {
	summary, err := dashparse.ReadDashboard(bytes.NewReader(value), e.lookup)
	if err != nil {
		return nil, fmt.Errorf("read dashboard: %w", err)
	}

	uid := summary.UID
	if uid == "" {
		uid = key.GetName()
	}
	if uid == "" {
		return nil, fmt.Errorf("dashboard has no UID")
	}

	folderTitle, folderUID := folderInfo(value)
	queries := extractQueries(value)

	items := make([]embed.Item, 0, len(summary.Panels))
	idx := 0
	for _, p := range summary.Panels {
		// Collapsed row: yields children with the row's title as their context.
		if p.Type == "row" && len(p.Collapsed) > 0 {
			for _, child := range p.Collapsed {
				if it, ok := buildItem(summary, child, p.Title, folderTitle, folderUID, uid, queries, idx); ok {
					items = append(items, it)
					idx++
				}
			}
			continue
		}
		// Empty row marker — no embeddable content of its own.
		if p.Type == "row" {
			continue
		}
		if it, ok := buildItem(summary, p, "", folderTitle, folderUID, uid, queries, idx); ok {
			items = append(items, it)
			idx++
		}
	}
	return items, nil
}

func buildItem(
	summary *dashparse.DashboardSummaryInfo,
	p dashparse.PanelSummaryInfo,
	rowName, folderTitle, folderUID, uid string,
	queries map[int64][]queryExpr,
	idx int,
) (embed.Item, bool) {
	// Breadcrumb: folder → dashboard → row → panel title → description
	parts := make([]string, 0, 5)
	if folderTitle != "" {
		parts = append(parts, folderTitle)
	}
	if summary.Title != "" {
		parts = append(parts, summary.Title)
	}
	if rowName != "" {
		parts = append(parts, rowName)
	}
	if p.Title != "" {
		parts = append(parts, p.Title)
	}
	if p.Description != "" {
		parts = append(parts, p.Description)
	}
	breadcrumb := strings.Join(parts, " → ")

	panelQueries := queries[p.ID]
	var queryLines []string
	for i, q := range panelQueries {
		if q.Expression == "" {
			continue
		}
		if len(panelQueries) > 1 {
			queryLines = append(queryLines, fmt.Sprintf("Query %d: %s", i+1, q.Expression))
		} else {
			queryLines = append(queryLines, q.Expression)
		}
	}

	var sections []string
	if breadcrumb != "" {
		sections = append(sections, breadcrumb)
	}
	if len(summary.Tags) > 0 {
		sections = append(sections, "Tags: "+strings.Join(summary.Tags, ", "))
	}
	sections = append(sections, queryLines...)

	if len(sections) == 0 {
		return embed.Item{}, false
	}

	dsUIDs := map[string]struct{}{}
	langs := map[string]struct{}{}
	for _, ds := range p.Datasource {
		if ds.UID != "" {
			dsUIDs[ds.UID] = struct{}{}
		}
		if l := inferLanguage(ds.Type); l != "" {
			langs[l] = struct{}{}
		}
	}
	for _, q := range panelQueries {
		if q.Language != "" {
			langs[q.Language] = struct{}{}
		}
	}

	md := map[string]any{
		"dashboard_title": summary.Title,
	}
	if len(summary.Tags) > 0 {
		md["tags"] = summary.Tags
	}
	if len(dsUIDs) > 0 {
		md["datasource_uids"] = sortedKeys(dsUIDs)
	}
	if len(langs) > 0 {
		md["query_languages"] = sortedKeys(langs)
	}
	if rowName != "" {
		md["row_name"] = rowName
	}
	mdJSON, _ := json.Marshal(md)

	return embed.Item{
		UID:         uid,
		Title:       displayTitle(summary.Title, p.Title, uid),
		Subresource: subresource(p.ID, idx),
		Content:     strings.Join(sections, "\n"),
		Metadata:    mdJSON,
		Folder:      folderUID,
	}, true
}

// subresource is the unique sub-identifier for a panel within its dashboard.
// V1 panels carry numeric IDs that are stable across edits. The shared
// parser doesn't capture v2 panel IDs (they all come back as 0), so we
// fall back to position. When the upstream parser starts capturing v2 IDs,
// this fallback becomes a no-op for new dashboards while existing v2 rows
// will need a one-time re-embed to migrate from `panel/p<idx>` to `panel/<id>`.
func subresource(id int64, idx int) string {
	if id != 0 {
		return fmt.Sprintf("panel/%d", id)
	}
	return fmt.Sprintf("panel/p%d", idx)
}

// displayTitle is what cross-resource search shows. Combining dashboard +
// panel disambiguates panels with the same name across dashboards.
func displayTitle(dashboardTitle, panelTitle, uid string) string {
	switch {
	case dashboardTitle != "" && panelTitle != "":
		return dashboardTitle + " — " + panelTitle
	case dashboardTitle != "":
		return dashboardTitle
	case panelTitle != "":
		return panelTitle
	}
	return uid
}

// folderInfo pulls folder title/UID from either the classic API response
// (meta.folderTitle/folderUid) or k8s-style v2 (metadata.annotations).
func folderInfo(value []byte) (title, uid string) {
	var partial struct {
		Meta struct {
			FolderTitle string            `json:"folderTitle"`
			FolderUID   string            `json:"folderUid"`
			Annotations map[string]string `json:"annotations"`
		} `json:"meta"`
		Metadata struct {
			Annotations map[string]string `json:"annotations"`
		} `json:"metadata"`
	}
	if err := json.Unmarshal(value, &partial); err != nil {
		return "", ""
	}

	title = partial.Meta.FolderTitle
	uid = partial.Meta.FolderUID

	if title == "" {
		title = partial.Meta.Annotations["grafana.app/folderTitle"]
	}
	if uid == "" {
		uid = partial.Meta.Annotations["grafana.app/folder"]
	}
	if title == "" {
		title = partial.Metadata.Annotations["grafana.app/folderTitle"]
	}
	if uid == "" {
		uid = partial.Metadata.Annotations["grafana.app/folder"]
	}
	return title, uid
}

// queryExpr holds one query's content + inferred language.
type queryExpr struct {
	Expression string
	Language   string
}

// extractQueries returns query expressions keyed by panel ID. The shared
// dashboard parser drops these (the bleve index doesn't need them); we walk
// the JSON ourselves to collect them. V1 only: v2 panels lack stable IDs
// in the shared parser, so we can't correlate query expressions back to
// the right `PanelSummaryInfo`. V2 query support needs an upstream change
// that captures `id` and `data.spec.queries[].spec.query.spec.<expr>` in
// readV2PanelSpec.
func extractQueries(value []byte) map[int64][]queryExpr {
	out := map[int64][]queryExpr{}

	var raw map[string]any
	if err := json.Unmarshal(value, &raw); err != nil {
		return out
	}
	body := unwrapSpec(raw)

	panels, ok := body["panels"].([]any)
	if !ok {
		return out
	}
	for _, p := range panels {
		pm, ok := p.(map[string]any)
		if !ok {
			continue
		}
		collectPanelQueries(pm, out)
		if nested, ok := pm["panels"].([]any); ok {
			for _, np := range nested {
				if npm, ok := np.(map[string]any); ok {
					collectPanelQueries(npm, out)
				}
			}
		}
	}
	return out
}

// collectPanelQueries reads expressions from one v1 panel's targets[].
func collectPanelQueries(p map[string]any, out map[int64][]queryExpr) {
	id, ok := readInt(p["id"])
	if !ok {
		return
	}
	dsType, _ := mapAt(p, "datasource")["type"].(string)
	targets, ok := p["targets"].([]any)
	if !ok {
		return
	}
	var qs []queryExpr
	for _, t := range targets {
		tm, ok := t.(map[string]any)
		if !ok {
			continue
		}
		// Per-target datasource type wins over the panel's.
		targetDS := dsType
		if td, _ := mapAt(tm, "datasource")["type"].(string); td != "" {
			targetDS = td
		}
		if qe, ok := readQuery(tm, targetDS); ok {
			qs = append(qs, qe)
		}
	}
	if len(qs) > 0 {
		out[id] = append(out[id], qs...)
	}
}

// readQuery pulls the expression and inferred language out of a target.
// Tries `expr` (PromQL/LogQL), `rawSql`/`rawQuery` (SQL-likes), `query`
// (TraceQL).
func readQuery(t map[string]any, dsType string) (queryExpr, bool) {
	if s, _ := t["expr"].(string); s != "" {
		return queryExpr{Expression: s, Language: inferLanguage(dsType)}, true
	}
	if s, _ := t["rawSql"].(string); s != "" {
		return queryExpr{Expression: s, Language: "sql"}, true
	}
	if s, _ := t["rawQuery"].(string); s != "" {
		return queryExpr{Expression: s, Language: "sql"}, true
	}
	if s, _ := t["query"].(string); s != "" {
		return queryExpr{Expression: s, Language: "traceql"}, true
	}
	return queryExpr{}, false
}

func inferLanguage(dsType string) string {
	dsType = strings.ToLower(dsType)
	switch {
	case strings.Contains(dsType, "prometheus"):
		return "promql"
	case strings.Contains(dsType, "loki"):
		return "logql"
	case strings.Contains(dsType, "tempo"):
		return "traceql"
	case strings.Contains(dsType, "sql"),
		strings.Contains(dsType, "mysql"),
		strings.Contains(dsType, "postgres"),
		strings.Contains(dsType, "mssql"),
		strings.Contains(dsType, "clickhouse"),
		strings.Contains(dsType, "bigquery"),
		strings.Contains(dsType, "snowflake"):
		return "sql"
	}
	return ""
}

// unwrapSpec returns the body that holds the dashboard fields. K8s-wrapped
// resources put the dashboard under `spec`; `dashboard.ReadDashboard`
// recurses into that automatically. We have to do it ourselves for the
// supplemental query pass.
func unwrapSpec(raw map[string]any) map[string]any {
	if spec, ok := raw["spec"].(map[string]any); ok {
		// V2 puts elements/layout directly under spec; v1 wrapped in k8s
		// puts the whole dashboard under spec. Either shape works for our
		// targets[]/elements[] traversal.
		return spec
	}
	if d, ok := raw["dashboard"].(map[string]any); ok {
		return d
	}
	return raw
}

func sortedKeys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// mapAt walks `path` and returns a non-nil map, or nil if any step is
// missing.
func mapAt(m map[string]any, path ...string) map[string]any {
	cur := any(m)
	for _, k := range path {
		mm, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = mm[k]
	}
	if mm, ok := cur.(map[string]any); ok {
		return mm
	}
	return nil
}

func readInt(v any) (int64, bool) {
	switch x := v.(type) {
	case int:
		return int64(x), true
	case int64:
		return x, true
	case float64:
		return int64(x), true
	case string:
		// dashboards occasionally serialize IDs as strings; tolerate it.
		var i int64
		_, err := fmt.Sscan(x, &i)
		return i, err == nil
	}
	return 0, false
}
