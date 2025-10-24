package ualert

import "github.com/grafana/grafana/pkg/services/sqlstore/migrator"

// AddAlertRulePerformanceIndexMigration adds a composite index to improve alert rule fetching performance.
// This index covers the ORDER BY clause used in the main query for listing alert rules.
func AddAlertRulePerformanceIndexMigration(mg *migrator.Migrator) {
	// Create a composite index that matches the ORDER BY clause in GetAlertRulesForScheduling
	// and other query methods in pkg/services/ngalert/store/alert_rule.go:268
	// ORDER BY alert_rule.org_id, alert_rule.namespace_uid, alert_rule.rule_group, alert_rule.rule_group_idx, alert_rule.id

	alertRulePerfIndex := &migrator.Index{
		Name: "IDX_alert_rule_fetch_perf",
		Cols: []string{"org_id", "namespace_uid", "rule_group", "rule_group_idx", "id"},
		Type: migrator.IndexType,
	}

	mg.AddMigration(
		"add composite index for alert rule fetching performance",
		migrator.NewAddIndexMigration(
			migrator.Table{Name: "alert_rule"},
			alertRulePerfIndex,
		),
	)

	// Also add an index on is_paused to support filtered queries
	isPausedIndex := &migrator.Index{
		Name: "IDX_alert_rule_is_paused",
		Cols: []string{"org_id", "is_paused"},
		Type: migrator.IndexType,
	}

	mg.AddMigration(
		"add index on is_paused column for alert rule filtering",
		migrator.NewAddIndexMigration(
			migrator.Table{Name: "alert_rule"},
			isPausedIndex,
		),
	)
}