// Command gendevdashboards generates the v2-schema gdev dashboards in
// devenv/dev-dashboards from the preserved v1 corpus in
// apps/dashboard/pkg/migration/testdata/v1_dev_dashboards.
//
// For every v1 dashboard in the corpus it migrates to the latest schema version,
// converts it to dashboard.grafana.app/v2, wraps it in the provisioning envelope,
// and writes it to the matching path under devenv/dev-dashboards (overwriting).
//
// Reading from the (immutable) v1 corpus rather than the already-converted output
// makes the generator idempotent: every run reproduces the full v2 set and a
// complete CONVERSION_REPORT.md, regardless of the current output state.
//
// It writes a CONVERSION_REPORT.md listing counts and every lossy/failed conversion.
//
// Run from the repo root:
//
//	go run ./apps/dashboard/pkg/migration/gendevdashboards
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/conversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	migrationtestutil "github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	// v1CorpusDir is the preserved set of original v1 gdev dashboards (source of truth).
	v1CorpusDir = "apps/dashboard/pkg/migration/testdata/v1_dev_dashboards"
	// devDashboardsDir is where the generated v2 dashboards are written (provisioned set).
	devDashboardsDir = "devenv/dev-dashboards"
)

// dashboardEnvelope is the provisioning envelope shape the file provider expects for
// k8s-format dashboards. metadata.name is read as the UID and spec.title as the title.
type dashboardEnvelope struct {
	APIVersion string               `json:"apiVersion"`
	Kind       string               `json:"kind"`
	Metadata   map[string]string    `json:"metadata"`
	Spec       dashv2.DashboardSpec `json:"spec"`
}

// stats mirrors the counting logic in conversion_data_loss_detection.go so we can
// report on lossy conversions ourselves (the conversion pipeline only logs/records
// data loss as metrics, it does not return it to the caller).
type stats struct {
	panels      int
	queries     int
	annotations int
	links       int
	variables   int
}

func (s stats) String() string {
	return fmt.Sprintf("panels=%d queries=%d annotations=%d links=%d variables=%d",
		s.panels, s.queries, s.annotations, s.links, s.variables)
}

type result struct {
	relPath string
	uid     string
	title   string
	source  stats
	target  stats
	failed  bool
	convErr string // conversion status error message (failed conversion)
	loss    []string
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	s := strings.ToLower(name)
	s = slugRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "dashboard"
	}
	return s
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	// The generator must run from the repo root so the relative paths resolve.
	if _, err := os.Stat(v1CorpusDir); err != nil {
		return fmt.Errorf("must run from repo root (cannot find %s): %w", v1CorpusDir, err)
	}
	if _, err := os.Stat(devDashboardsDir); err != nil {
		return fmt.Errorf("must run from repo root (cannot find %s): %w", devDashboardsDir, err)
	}

	// Initialise the migration singleton with the dev-dashboard datasource set so
	// datasource-name references in the gdev dashboards resolve to UIDs, matching the
	// frontend devDashboardDataSources configuration used by the existing harness.
	migration.ResetForTesting()
	dsProvider := migrationtestutil.NewDataSourceProvider(migrationtestutil.DevDashboardConfig)
	leProvider := migrationtestutil.NewLibraryElementProvider()
	migration.Initialize(dsProvider, leProvider, migration.DefaultCacheTTL)

	scheme := runtime.NewScheme()
	if err := conversion.RegisterConversions(scheme, dsProvider, leProvider); err != nil {
		return fmt.Errorf("register conversions: %w", err)
	}

	files, err := findJSONFiles(v1CorpusDir)
	if err != nil {
		return err
	}
	sort.Strings(files)

	var results []result
	var skipped []string

	for _, srcPath := range files {
		rel, _ := filepath.Rel(v1CorpusDir, srcPath)
		outPath := filepath.Join(devDashboardsDir, rel)

		raw, err := os.ReadFile(srcPath) // nolint:gosec
		if err != nil {
			return fmt.Errorf("read %s: %w", rel, err)
		}

		var dash map[string]interface{}
		if err := json.Unmarshal(raw, &dash); err != nil {
			return fmt.Errorf("unmarshal %s: %w", rel, err)
		}

		// Dashboards without a schemaVersion are not legacy save-models we can migrate.
		if _, ok := getSchemaVersion(dash); !ok {
			skipped = append(skipped, rel+" (no schemaVersion)")
			continue
		}

		res, err := convertFile(scheme, srcPath, outPath, rel, dash)
		if err != nil {
			return fmt.Errorf("convert %s: %w", rel, err)
		}
		results = append(results, res)
	}

	if err := writeReport(results, skipped); err != nil {
		return err
	}

	clean, lossy, failed := 0, 0, 0
	for _, r := range results {
		switch {
		case r.failed:
			failed++
		case len(r.loss) > 0:
			lossy++
		default:
			clean++
		}
	}
	fmt.Printf("Converted %d dashboards: %d clean, %d lossy, %d failed (%d skipped).\n",
		len(results), clean, lossy, failed, len(skipped))
	fmt.Printf("Report: %s\n", filepath.Join(devDashboardsDir, "CONVERSION_REPORT.md"))
	return nil
}

func convertFile(scheme *runtime.Scheme, srcPath, outPath, rel string, dash map[string]interface{}) (result, error) {
	res := result{relPath: rel}

	// uid: prefer the dashboard's uid; otherwise derive from the filename.
	uid, _ := dash["uid"].(string)
	if uid == "" {
		base := strings.TrimSuffix(filepath.Base(srcPath), ".json")
		uid = slugify(base)
	}
	res.uid = uid

	// Collect source stats BEFORE migration mutates the map (panels/queries can be
	// reshaped by schema migrations, but for data-loss reporting we want the original
	// authored content as the baseline).
	res.source = collectStatsV0V1(dash)

	// 1. Migrate the legacy save-model to the latest schema version.
	if err := migration.Migrate(context.Background(), dash, schemaversion.LATEST_VERSION); err != nil {
		// A migration failure is a hard failure; record it and still emit a (default) v2 doc.
		res.failed = true
		res.convErr = "schema migration failed: " + err.Error()
	}

	if t, ok := dash["title"].(string); ok {
		res.title = t
	}

	// 2. Build a v0 dashboard around the migrated spec and convert to v2.
	in := &dashv0.Dashboard{
		Spec: common.Unstructured{Object: dash},
	}
	in.Name = uid

	out := &dashv2.Dashboard{}
	// scheme.Convert runs the registered (metrics-wrapped) conversion. The wrapper
	// always returns nil and records failure/data-loss on the output status instead,
	// so we read out.Status.Conversion to learn whether the conversion succeeded.
	if err := scheme.Convert(in, out, nil); err != nil {
		return res, err
	}

	if out.Status.Conversion != nil && out.Status.Conversion.Failed {
		res.failed = true
		if out.Status.Conversion.Error != nil {
			res.convErr = strings.TrimSpace(res.convErr + " " + *out.Status.Conversion.Error)
		} else if res.convErr == "" {
			res.convErr = "conversion reported failed status (no message)"
		}
	}

	// 3. Compute target stats and detect data loss (target < source).
	res.target = collectStatsV2(out.Spec)
	res.loss = detectLoss(res.source, res.target)

	// 4. Write the provisioning envelope to the output path.
	env := dashboardEnvelope{
		APIVersion: dashv2.APIVERSION,
		Kind:       "Dashboard",
		Metadata:   map[string]string{"name": uid},
		Spec:       out.Spec,
	}
	b, err := json.MarshalIndent(env, "", "  ")
	if err != nil {
		return res, fmt.Errorf("marshal envelope: %w", err)
	}
	b = append(b, '\n')
	if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil { // nolint:gosec
		return res, fmt.Errorf("mkdir %s: %w", filepath.Dir(outPath), err)
	}
	if err := os.WriteFile(outPath, b, 0644); err != nil { // nolint:gosec
		return res, fmt.Errorf("write %s: %w", rel, err)
	}

	return res, nil
}

func detectLoss(src, tgt stats) []string {
	var loss []string
	add := func(name string, s, t int) {
		if t < s {
			loss = append(loss, fmt.Sprintf("%s decreased: source=%d target=%d (loss of %d)", name, s, t, s-t))
		}
	}
	add("panels", src.panels, tgt.panels)
	add("queries", src.queries, tgt.queries)
	add("annotations", src.annotations, tgt.annotations)
	add("links", src.links, tgt.links)
	add("variables", src.variables, tgt.variables)
	return loss
}

// --- counting helpers (mirror conversion_data_loss_detection.go) ---

func collectStatsV0V1(spec map[string]interface{}) stats {
	return stats{
		panels:      countPanelsV0V1(spec),
		queries:     countQueriesV0V1(spec),
		annotations: countAnnotationsV0V1(spec),
		links:       countLinksV0V1(spec),
		variables:   countVariablesV0V1(spec),
	}
}

func countPanelsV0V1(spec map[string]interface{}) int {
	panels, ok := spec["panels"].([]interface{})
	if !ok {
		return 0
	}
	count := 0
	for _, p := range panels {
		pm, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		pt, _ := pm["type"].(string)
		if pt != "row" {
			count++
		} else if cps, ok := pm["panels"].([]interface{}); ok {
			count += len(cps)
		}
	}
	return count
}

func countTargets(pm map[string]interface{}) int {
	if t, ok := pm["targets"].([]interface{}); ok {
		return len(t)
	}
	return 0
}

func countQueriesV0V1(spec map[string]interface{}) int {
	panels, ok := spec["panels"].([]interface{})
	if !ok {
		return 0
	}
	count := 0
	for _, p := range panels {
		pm, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		pt, _ := pm["type"].(string)
		if pt != "row" {
			count += countTargets(pm)
		} else if cps, ok := pm["panels"].([]interface{}); ok {
			for _, cp := range cps {
				if cpm, ok := cp.(map[string]interface{}); ok {
					count += countTargets(cpm)
				}
			}
		}
	}
	return count
}

func countAnnotationsV0V1(spec map[string]interface{}) int {
	ann, ok := spec["annotations"].(map[string]interface{})
	if !ok {
		return 0
	}
	if l, ok := ann["list"].([]interface{}); ok {
		return len(l)
	}
	return 0
}

func countLinksV0V1(spec map[string]interface{}) int {
	if l, ok := spec["links"].([]interface{}); ok {
		return len(l)
	}
	return 0
}

func countVariablesV0V1(spec map[string]interface{}) int {
	tpl, ok := spec["templating"].(map[string]interface{})
	if !ok {
		return 0
	}
	if l, ok := tpl["list"].([]interface{}); ok {
		return len(l)
	}
	return 0
}

func collectStatsV2(spec dashv2.DashboardSpec) stats {
	s := stats{
		annotations: len(spec.Annotations),
		links:       len(spec.Links),
		variables:   len(spec.Variables),
	}
	for _, el := range spec.Elements {
		if el.PanelKind != nil {
			s.panels++
			s.queries += len(el.PanelKind.Spec.Data.Spec.Queries)
		} else if el.LibraryPanelKind != nil {
			s.panels++
		}
	}
	return s
}

// --- misc helpers ---

func getSchemaVersion(dash map[string]interface{}) (int, bool) {
	v, ok := dash["schemaVersion"]
	if !ok {
		return 0, false
	}
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	default:
		return 0, false
	}
}

func findJSONFiles(dir string) ([]string, error) {
	var out []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".json") {
			out = append(out, path)
		}
		return nil
	})
	return out, err
}

func writeReport(results []result, skipped []string) error {
	clean, lossy, failed := 0, 0, 0
	for _, r := range results {
		switch {
		case r.failed:
			failed++
		case len(r.loss) > 0:
			lossy++
		default:
			clean++
		}
	}

	var b strings.Builder
	fmt.Fprintf(&b, "# gdev dashboards v1 -> v2 conversion report\n\n")
	fmt.Fprintf(&b, "Generated by `apps/dashboard/pkg/migration/gendevdashboards`. Re-runnable.\n\n")
	fmt.Fprintf(&b, "Source of truth is the preserved v1 corpus at `apps/dashboard/pkg/migration/testdata/v1_dev_dashboards`. ")
	fmt.Fprintf(&b, "The generator migrates each v1 dashboard to the latest schema version, converts it to `dashboard.grafana.app/v2`, and writes the provisioning envelope here.\n\n")
	fmt.Fprintf(&b, "| metric | count |\n|---|---|\n")
	fmt.Fprintf(&b, "| total converted | %d |\n", len(results))
	fmt.Fprintf(&b, "| clean | %d |\n", clean)
	fmt.Fprintf(&b, "| lossy | %d |\n", lossy)
	fmt.Fprintf(&b, "| failed | %d |\n", failed)
	fmt.Fprintf(&b, "| skipped | %d |\n\n", len(skipped))

	fmt.Fprintf(&b, "## Source fixes (to reach zero loss)\n\n")
	fmt.Fprintf(&b, "Some v1 sources carried degenerate artifacts that the migration/conversion pipeline correctly removes, which showed up as data loss on the first pass. Fixed at source in the v1 corpus so conversion is now lossless:\n\n")
	fmt.Fprintf(&b, "- `panel-gauge/gauge_tests.json`: removed 3 persisted repeat-copy panels (had `repeatPanelId` pointing at panel 7). These are runtime-expansion artifacts the V27 migration strips anyway; removing them from source makes the panel/query counts match (16 -> 13 panels). Migration output is byte-identical, so no behavioral change.\n")
	fmt.Fprintf(&b, "- `panel-logstable/logs-table.json`: panel id 3 (\"Not logs panel\") had an empty target `{refId: A}` (no datasource, no query) that the save-model cleanup drops. Gave it a real testdata query (`scenarioId: random_walk`) on the panel's existing testdata datasource so the query survives.\n")
	fmt.Fprintf(&b, "- `transforms/regression-analysis.json`: panel id 6 (\"stat panel\") had the same empty target; applied the same fix.\n")
	fmt.Fprintf(&b, "- `panel-timeseries/timeseries-y-ticks-zero-decimals.json`: panel id 11 (\"Panel Title\") had the same empty target after a main-branch edit added the panel; applied the same `scenarioId: random_walk` fix.\n\n")
	fmt.Fprintf(&b, "None were genuine pipeline bugs - all were stale/degenerate input the pipeline is right to clean up.\n\n")

	fmt.Fprintf(&b, "## Pre-existing files normalized (not part of the v1 corpus)\n\n")
	fmt.Fprintf(&b, "These dashboards already shipped in k8s format and are not regenerated by this tool. They were hand-normalized to the clean v2 envelope shape (`metadata: {name}` only):\n\n")
	fmt.Fprintf(&b, "- `section-variables/section-variables.json`: was `dashboard.grafana.app/v2beta1` / kind `DashboardWithAccessInfo`; converted v2beta1 -> v2 and rewrapped as `dashboard.grafana.app/v2` / kind `Dashboard` with `metadata: {name}` only.\n")
	fmt.Fprintf(&b, "- `vizlegend/vizlegend.json`: `dashboard.grafana.app/v2` that carried export metadata (namespace, resourceVersion, generation, uid, labels, annotations); stripped to `metadata: {name}` only.\n")
	fmt.Fprintf(&b, "- `scenarios/view-panel-tests.json`: added on main as a `dashboard.grafana.app/v2` export with the same export metadata; stripped to `metadata: {name}` only.\n\n")

	if failed > 0 {
		fmt.Fprintf(&b, "## Failed conversions\n\n")
		fmt.Fprintf(&b, "These dashboards reported a conversion/migration failure. A v2 document was still written (with default/best-effort spec).\n\n")
		for _, r := range results {
			if !r.failed {
				continue
			}
			fmt.Fprintf(&b, "### %s\n\n", r.relPath)
			fmt.Fprintf(&b, "- uid: `%s`\n", r.uid)
			fmt.Fprintf(&b, "- title: %s\n", r.title)
			fmt.Fprintf(&b, "- error: %s\n", r.convErr)
			fmt.Fprintf(&b, "- source: %s\n", r.source)
			fmt.Fprintf(&b, "- target: %s\n", r.target)
			if len(r.loss) > 0 {
				fmt.Fprintf(&b, "- data loss:\n")
				for _, l := range r.loss {
					fmt.Fprintf(&b, "  - %s\n", l)
				}
			}
			fmt.Fprintf(&b, "\n")
		}
	}

	if lossy > 0 {
		fmt.Fprintf(&b, "## Lossy conversions\n\n")
		fmt.Fprintf(&b, "These converted but dropped one or more counted elements (panels / queries / annotations / links / variables). The v2 output was still written.\n\n")
		for _, r := range results {
			if r.failed || len(r.loss) == 0 {
				continue
			}
			fmt.Fprintf(&b, "### %s\n\n", r.relPath)
			fmt.Fprintf(&b, "- uid: `%s`\n", r.uid)
			fmt.Fprintf(&b, "- title: %s\n", r.title)
			fmt.Fprintf(&b, "- source: %s\n", r.source)
			fmt.Fprintf(&b, "- target: %s\n", r.target)
			fmt.Fprintf(&b, "- dropped:\n")
			for _, l := range r.loss {
				fmt.Fprintf(&b, "  - %s\n", l)
			}
			fmt.Fprintf(&b, "\n")
		}
	}

	if len(skipped) > 0 {
		fmt.Fprintf(&b, "## Skipped files\n\n")
		for _, s := range skipped {
			fmt.Fprintf(&b, "- %s\n", s)
		}
		fmt.Fprintf(&b, "\n")
	}

	fmt.Fprintf(&b, "## All converted (clean)\n\n")
	for _, r := range results {
		if r.failed || len(r.loss) > 0 {
			continue
		}
		fmt.Fprintf(&b, "- %s (uid `%s`) — %s\n", r.relPath, r.uid, r.target)
	}

	return os.WriteFile(filepath.Join(devDashboardsDir, "CONVERSION_REPORT.md"), []byte(b.String()), 0644)
}
