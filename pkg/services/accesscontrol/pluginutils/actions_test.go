package pluginutils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseActions(t *testing.T) {
	testCases := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "empty string",
			input:    "",
			expected: nil,
		},
		{
			name:     "single action",
			input:    "grafana-collector-app:admin",
			expected: []string{"grafana-collector-app:admin"},
		},
		{
			name:     "multiple actions",
			input:    "grafana-collector-app:admin,grafana-collector-app.fleet-management:read",
			expected: []string{"grafana-collector-app:admin", "grafana-collector-app.fleet-management:read"},
		},
		{
			name:     "multiple actions with spaces",
			input:    "action1, action2 , action3",
			expected: []string{"action1", "action2", "action3"},
		},
		{
			name:     "actions with empty parts",
			input:    "action1,,action2, ,action3",
			expected: []string{"action1", "action2", "action3"},
		},
		{
			name:     "trailing comma",
			input:    "action1,action2,",
			expected: []string{"action1", "action2"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := ParseActions(tc.input)
			assert.Equal(t, tc.expected, result)
		})
	}
}
