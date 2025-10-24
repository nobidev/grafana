package api

import (
	"net/url"
	"strings"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// FieldSelection represents which fields to include when fetching alert rules
type FieldSelection struct {
	// Core fields are always included
	IncludeData                bool
	IncludeAnnotations         bool
	IncludeLabels              bool
	IncludeNotificationSettings bool
	IncludeMetadata            bool
}

// DefaultFieldSelection returns default field selection (all fields included)
func DefaultFieldSelection() FieldSelection {
	return FieldSelection{
		IncludeData:                true,
		IncludeAnnotations:         true,
		IncludeLabels:              true,
		IncludeNotificationSettings: true,
		IncludeMetadata:            true,
	}
}

// MinimalFieldSelection returns minimal field selection (only core fields)
func MinimalFieldSelection() FieldSelection {
	return FieldSelection{
		IncludeData:                false,
		IncludeAnnotations:         false,
		IncludeLabels:              false,
		IncludeNotificationSettings: false,
		IncludeMetadata:            false,
	}
}

// ParseFieldSelection parses query parameters to determine which fields to include
func ParseFieldSelection(query url.Values) FieldSelection {
	// Check for "fields" parameter
	fieldsParam := strings.ToLower(query.Get("fields"))

	if fieldsParam == "minimal" || fieldsParam == "core" {
		return MinimalFieldSelection()
	}

	if fieldsParam == "all" || fieldsParam == "" {
		return DefaultFieldSelection()
	}

	// Custom field selection
	fields := strings.Split(fieldsParam, ",")
	selection := MinimalFieldSelection()

	for _, field := range fields {
		field = strings.TrimSpace(strings.ToLower(field))
		switch field {
		case "data", "queries":
			selection.IncludeData = true
		case "annotations":
			selection.IncludeAnnotations = true
		case "labels":
			selection.IncludeLabels = true
		case "notification", "notifications", "notification_settings":
			selection.IncludeNotificationSettings = true
		case "metadata":
			selection.IncludeMetadata = true
		}
	}

	return selection
}

// ApplyFieldSelection applies field selection to an alert rule
// This sets fields to nil/empty based on the selection
func ApplyFieldSelection(rule *ngmodels.AlertRule, selection FieldSelection) {
	if !selection.IncludeData {
		rule.Data = nil
	}
	if !selection.IncludeAnnotations {
		rule.Annotations = nil
	}
	if !selection.IncludeLabels {
		rule.Labels = nil
	}
	if !selection.IncludeNotificationSettings {
		rule.NotificationSettings = nil
	}
	if !selection.IncludeMetadata {
		rule.Metadata = ngmodels.AlertRuleMetadata{}
	}
}

// ApplyFieldSelectionToGroup applies field selection to a group of alert rules
func ApplyFieldSelectionToGroup(rules ngmodels.RulesGroup, selection FieldSelection) {
	for _, rule := range rules {
		ApplyFieldSelection(rule, selection)
	}
}

// ApplyFieldSelectionToGroups applies field selection to multiple groups
func ApplyFieldSelectionToGroups(groups map[ngmodels.AlertRuleGroupKey]ngmodels.RulesGroup, selection FieldSelection) {
	for _, rules := range groups {
		ApplyFieldSelectionToGroup(rules, selection)
	}
}