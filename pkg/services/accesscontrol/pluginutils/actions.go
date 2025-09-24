package pluginutils

import (
	"strings"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// ParseActions splits a comma-separated action string into individual actions
// and trims whitespace from each action.
// Example: "action1, action2, action3" -> ["action1", "action2", "action3"]
func ParseActions(actions string) []string {
	if actions == "" {
		return nil
	}

	parts := strings.Split(actions, ",")
	result := make([]string, 0, len(parts))

	for _, action := range parts {
		trimmed := strings.TrimSpace(action)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result
}

// HasAnyAction checks if the user has access to any of the comma-separated actions.
// This implements OR logic - user needs at least one of the actions.
func HasAnyAction(accessControl ac.AccessControl, evaluator ac.Evaluator, actions string) bool {
	if actions == "" {
		return true
	}

	actionList := ParseActions(actions)
	if len(actionList) == 0 {
		return true
	}

	// If only one action, use the existing evaluator directly
	if len(actionList) == 1 {
		return evaluator.Evaluate(accessControl.GetUserPermissions(nil, nil))
	}

	// For multiple actions, check if user has any of them
	permissions := accessControl.GetUserPermissions(nil, nil)
	for _, action := range actionList {
		// Create a simple evaluator for each action
		singleEval := ac.EvalPermission(action)
		if singleEval.Evaluate(permissions) {
			return true
		}
	}

	return false
}

// HasAllActions checks if the user has access to all of the comma-separated actions.
// This implements AND logic - user needs all of the actions.
func HasAllActions(accessControl ac.AccessControl, evaluator ac.Evaluator, actions string) bool {
	if actions == "" {
		return true
	}

	actionList := ParseActions(actions)
	if len(actionList) == 0 {
		return true
	}

	// If only one action, use the existing evaluator directly
	if len(actionList) == 1 {
		return evaluator.Evaluate(accessControl.GetUserPermissions(nil, nil))
	}

	// For multiple actions, check if user has all of them
	permissions := accessControl.GetUserPermissions(nil, nil)
	for _, action := range actionList {
		// Create a simple evaluator for each action
		singleEval := ac.EvalPermission(action)
		if !singleEval.Evaluate(permissions) {
			return false
		}
	}

	return true
}
