# TableNG ad-hoc filtering experiment

Based on PR #132542 at `c07b4768ec836bca7f1c1afd418ef42dfc11b7bc`.
Branch: `codex/table-adhoc-filter-sort`.

## Try it

Enable `table.refresh` and `table.refreshNewFeatures`, then open the development
dashboard **Panel Tests - Table - Ad-hoc filters and sorting**
(`table-adhoc-filter-sort`). The previous review instance used this URL; its servers
are currently stopped:

http://localhost:3017/d/table-adhoc-filter-sort/panel-tests-table-ad-hoc-filters-and-sorting

- Open **duration → Filter values**. Move either histogram handle or enter raw
  bounds of 50 and 200. The preview shows 60 of 126 rows; Apply commits the view.
- Add a region filter. Reopen duration: its distribution includes every other
  active filter but excludes its own predicate, allowing the range to widen again.
- Refresh data or hide a filtered column: the view remains active. Clear filters restores the rows.
- Open **observed_at → Filter values**. Start `2026-09-17 12:00` and end
  `2026-09-17 12:30`, in the displayed America/New_York timezone, match 31 rows.
- The remaining panels exercise multiple frames, saved transformations, the column
  sidebar, and nested frames. Child predicates apply only to the selected parent.
- Inspect uses the same controls with `table.inspectDataTableNG`. Flamegraph's top
  table requires `flameGraph.tableNg` as well. Their view state is local.

Filters are viewer-only and are not saved to panel options or the URL. Sorting still uses the existing TableNG implementation and panel-option callbacks. A page reload starts a fresh filter view.

## Execution and ownership

Applied filters are ordinary `filterByValue` configurations, one per field and frame/parent
scope. They are the source of truth for both the displayed rows and applied filter controls.
`inSet` supports raw or formatted membership; `numericRange` supports inclusive optional
bounds and explicit missing-value handling. Stable field identities and optional frame/parent
targets keep these capabilities reusable outside tables. Existing transformation defaults
and the flag-off TableNG path retain their behavior.

Popup search/operator choices and unsubmitted inputs remain local drafts. Dashboard hosts
store configs through the ad-hoc API; standalone tables store the same configs locally.
JSON round-tripping the configs restores applied filters without supplemental table state.
Nested predicates run before parent predicates, and all filters run before column organization.

| Host                  | State owner                        | Input and row identity                                                                                                                                                                             |
| --------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard Table panel | Panel's ad-hoc transformation API  | Saved panel transformations run first; row operations precede ad-hoc column organization. Original source fields are rebuilt with field overrides so row callbacks and links use original indices. |
| Explore table         | Local TableNG controller per frame | Uses Explore's supplied frame and preserves datasource filtering/link callbacks. Frames sharing a refId receive distinct component keys.                                                           |
| Inspect               | Local TableNG controller           | Uses exactly the preview data supplied by Inspect. Never writes to a surrounding dashboard API or changes the export source.                                                                       |
| Flamegraph top table  | Local TableNG controller           | Filters the derived symbol table. Original row indices preserve symbol/search/sandwich actions and leave profile topology unchanged.                                                               |

A frame key includes query ID, frame name, field schema/labels, and occurrence.
Field labels distinguish fields sharing a raw name. Ambiguous duplicate display
names or field identities have filtering/sorting disabled. Child predicates include
a parent-value identity guard so a replaced parent does not inherit an old filter.

Numeric/time predicates use raw values and inclusive, optional bounds. Missing and
non-finite values have an explicit inclusion control. Categorical predicates retain
formatted-value selection, including mappings. Numeric controls use a linear
histogram, two slider handles, raw-value inputs, preview, Apply, Cancel, and Clear.
Dates use absolute bounds interpreted in the host timezone.

## Validation

Original experiment checks: 940 Jest tests and 24 snapshots passed; three browser scenarios
plus authentication passed. App and grafana-ui typechecks and changed-file lint passed.
The optional benchmark and existing skips are excluded from that Jest pass count.

Targeted coverage includes TableNG, transform operators, dashboard ad-hoc composition,
Inspect isolation, Explore table plumbing, Flamegraph actions after filtering,
flag-off behavior, nested predicates, duplicate query IDs and labelled fields,
refresh, source row indices, mappings, and nanosecond alignment.

Browser tests cover preview versus commit, refresh, hiding a filtered column,
clearing, timezone-aware dates, keyboard slider editing, focus return, and a scoped
axe accessibility scan. Jest's existing duplicate-manual-mock warning remains.
Meticulous cloud validation was unavailable because the CLI was not authenticated.

The empty-result crash, unequal-frame exclusion length, and nanosecond alignment
regressions were each checked by removing the fix, observing a failing test, then
restoring the fix and verifying green.

## Follow-up decisions

- The dashboard prototype executes row transforms in the ad-hoc stage and again
  to project original row indices in TableNG. This preserves callbacks and complete
  distributions, but adds allocations and work. A production version should carry
  an explicit row-selection/provenance result from the stage into the renderer.
- Distributions eagerly recompute with all other predicates. Many filters and wide
  frames need profiling, caching, and possibly deferred histogram computation.
- Linear bins make long tails obvious but can compress the main distribution.
  Quantile/log scales, unit-aware input parsing, richer date presets, and relative
  date ranges remain future work. Absolute dates currently have millisecond precision.
- Identical unnamed frames are distinguished by occurrence; datasource-provided
  stable identities would handle indistinguishable frames changing order better.
- Parent identity changes retire child predicates. Stable parent keys could preserve
  them across parent reordering. Nested column management stays deferred as in the base PR.
- URL sharing/persistence and promoting a viewer filter into a saved transformation
  need a separate product/API decision.

## Scenes ownership and commit order

The branch now layers the changes in dependency order:

1. Original ad-hoc column-management API and table controls from PR #132542.
2. Galen's panel-owned runtime controller integration from Grafana PR #132963,
   through `bae985e7dd28fa2f10c03bec69690c328a2b9b21`.
3. This filtering experiment, adapted to the keyed runtime API.

Both `@grafana/scenes` and `@grafana/scenes-react` use
`8.19.0--canary.1651.35354177939.0` from Scenes PR #1651. The older
SceneDataTransformer runtime-group experiment is superseded.

`PanelContext.adHocTransformations` references `VizPanel.getRuntimeTransformations()`
directly. Grafana no longer owns an AdHocTransformations class, source-capture tap,
runtime registry, or transformer-replacement subscription. Scenes owns configuration
snapshots, source capture, subscriptions, plugin cleanup, clone isolation, field-value
retention, and reprocessing without a query. Runtime state survives replacement of
`$data`, but is not serialized or persisted across page reloads.

Table row and column controls share the `table:view` owner. Row transformations
always precede column organization within that owner's list, including when the
user hides a column before filtering. Other consumers can use separate
owner keys. TableNG receives the owner's key explicitly from its host; standalone
Explore, Inspect, and Flamegraph tables continue using local controllers.

The registered `filterByValue` transformation runs directly in the real Scenes pipeline.
Inspect/export therefore receive transformed dashboard data; additional controls in
Inspect remain local to its supplied preview data.

Integration validation: 1,179 Jest tests and 24 snapshots passed across 40 suites,
including the real canary pipeline with both hide-first and filter-first interactions,
hidden filter keys, clearing filters, independent runtime owners, and dashboard
change tracking. Reversing row/column execution order makes the new integration test
fail. App and grafana-ui typechecks passed. Browser scenarios were retained but not
rerun for this integration.

The original experiment history remains at
`backup/table-adhoc-before-vizpanel-20260918`.

## Column pinning follow-up

The pinning experiment is on `codex/table-adhoc-pinning` in
`/private/tmp/grafana-table-adhoc-pinning`, based on the integrated branch above.

TableNG owns pinned column identities per frame, seeded from the configured frozen
column count. It derives the visible frozen count from those identities, so hiding
a pinned column does not freeze an unrelated replacement. Pinning puts pinned
fields first through the existing column-order callback; dashboard panels therefore
use their ad-hoc organize transformation. No transformation changes panel options.
Unpinning preserves the current organized order (moving behind any remaining pinned
columns), and dragging preserves a pinned prefix. There is no private pre-pin order
history: `organize.options.indexByName` is the authority for dashboard column order. Query refreshes and frame switching retain the local pin state; page reloads
reset it. Changing the configured frozen count reseeds the frame's pin state.

Standalone Inspect, Explore, and Flamegraph tables use their existing local column
state. Nested and ambiguously named columns retain their existing restrictions.

The local demo runs at `http://localhost:3017` with frontend assets on port 3337.
Its isolated SQLite database and provisioning live under `data/pinning`; all 154
gdev dashboards are provisioned into the `gdev dashboards` folder. Start with
`/d/table-adhoc-filter-sort/panel-tests-table-ad-hoc-filters-and-sorting` and use the
column menu or sidebar pin button. Login is `admin` / `admin`. The testdata examples
work without external services; dashboards for other data sources still need those
services. Local server configuration and generated data are ignored by Git.

Pinning validation: 129 focused Jest tests passed, along with app and grafana-ui
typechecks and changed-file lint. Removing pin-driven reordering makes the new
regression test fail. A live browser check confirmed pinning CPU freezes it first,
dashboard refresh retains the pin. A serialization round-trip test restores the
pin-driven organize configuration into fresh Scenes and TableNG instances: order
survives without pin state. Restoring a frozen-column option separately freezes the
organized prefix; unpinning retains that organized order. URL encoding and ephemeral
option/override persistence remain separate future work.
