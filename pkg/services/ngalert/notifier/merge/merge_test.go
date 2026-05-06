package merge

import (
	"context"
	_ "embed"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/alerting/definition"
	httpcfg "github.com/grafana/alerting/http/v0mimir"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/pkg/labels"
	commoncfg "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func TestValidateSubtreeMatchers(t *testing.T) {
	testCases := []struct {
		name        string
		matchers    config.Matchers
		expectedErr error
	}{
		{
			name:     "no error if subtree matchers are empty",
			matchers: config.Matchers{},
		},
		{
			name: "error if subtree matchers are not equal",
			matchers: config.Matchers{
				{
					Type:  labels.MatchNotEqual,
					Name:  "label",
					Value: "test",
				},
			},
			expectedErr: ErrInvalidMatchers,
		},
		{
			name: "error if subtree matchers are regex",
			matchers: config.Matchers{
				{
					Type:  labels.MatchRegexp,
					Name:  "label",
					Value: "test",
				},
			},
			expectedErr: ErrInvalidMatchers,
		},
		{
			name: "error if subtree matchers are not-regex",
			matchers: config.Matchers{
				{
					Type:  labels.MatchNotRegexp,
					Name:  "label",
					Value: "test",
				},
			},
			expectedErr: ErrInvalidMatchers,
		},
		{
			name: "error if duplicates",
			matchers: config.Matchers{
				{
					Type:  labels.MatchEqual,
					Name:  "label",
					Value: "test",
				},
				{
					Type:  labels.MatchEqual,
					Name:  "label",
					Value: "test",
				},
			},
			expectedErr: ErrDuplicateMatchers,
		},
		{
			name: "valid if no duplicates and only equal matchers",
			matchers: config.Matchers{
				{
					Type:  labels.MatchEqual,
					Name:  "al",
					Value: "test",
				},
				{
					Type:  labels.MatchEqual,
					Name:  "bl",
					Value: "test",
				},
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual := ValidateSubtreeMatchers(tc.matchers)
			if tc.expectedErr != nil {
				assert.ErrorIs(t, actual, tc.expectedErr)
				return
			}
			assert.NoError(t, actual)
		})
	}
}

func TestCheckIfMatchersUsed(t *testing.T) {
	m := config.Matchers{
		{
			Type:  labels.MatchEqual,
			Name:  "al",
			Value: "av",
		},
		{
			Type:  labels.MatchEqual,
			Name:  "bl",
			Value: "bv",
		},
	}

	mustMatcher := func(mt labels.MatchType, n, v string) *labels.Matcher {
		m, err := labels.NewMatcher(mt, n, v)
		if err != nil {
			t.Fatal(err)
		}
		return m
	}

	testCases := []struct {
		name     string
		route    *v1.Route
		expected bool
	}{
		{
			name: "true if the same matchers",
			route: &v1.Route{
				Matchers: m,
			},
			expected: true,
		},
		{
			name: "true if sub set of matchers",
			route: &v1.Route{
				Matchers: config.Matchers{
					{
						Type:  labels.MatchEqual,
						Name:  "al",
						Value: "av",
					},
				},
			},
			expected: true,
		},
		{
			name: "true if regex that matches",
			route: &v1.Route{
				Matchers: append(m, mustMatcher(labels.MatchRegexp, "al", ".*")),
			},
			expected: true,
		},
		{
			name: "true if superset of matchers",
			route: &v1.Route{
				Matchers: append(m, &labels.Matcher{
					Type:  labels.MatchEqual,
					Name:  "cl",
					Value: "cv",
				}),
			},
			expected: true,
		},
		{
			name: "false if different matchers",
			route: &v1.Route{
				Matchers: config.Matchers{
					{
						Type:  labels.MatchEqual,
						Name:  "al",
						Value: "test",
					},
					{
						Type:  labels.MatchEqual,
						Name:  "bl",
						Value: "bv",
					},
				},
			},
			expected: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual, err := checkIfMatchersUsed(m, []*v1.Route{tc.route})
			require.NoError(t, err)
			assert.Equal(t, tc.expected, actual)
		})
	}
}

func TestMergeReceivers(t *testing.T) {
	r := func(name string) *v1.PostableApiReceiver {
		return &v1.PostableApiReceiver{
			Receiver: definition.Receiver{
				Name: name,
			},
		}
	}

	suffix := "-dupe"

	r1 := r("r1")
	r2 := r("r2")
	r2s := r("r2" + suffix)
	r3 := r("r3")

	testCases := []struct {
		name            string
		existing        []*v1.PostableApiReceiver
		incoming        []*v1.PostableApiReceiver
		expected        []*v1.PostableApiReceiver
		expectedRenames map[string]string
	}{
		{
			name: "should append copies of incoming to existing",
			existing: []*v1.PostableApiReceiver{
				r2,
			},
			incoming: []*v1.PostableApiReceiver{
				r1,
				r3,
			},
			expected: []*v1.PostableApiReceiver{
				r2,
				r1,
				r3,
			},
			expectedRenames: map[string]string{},
		},
		{
			name: "should rename incoming if there is existing",
			existing: []*v1.PostableApiReceiver{
				r2,
			},
			incoming: []*v1.PostableApiReceiver{
				r("r2"),
			},
			expected: []*v1.PostableApiReceiver{
				r2,
				r("r2" + suffix),
			},
			expectedRenames: map[string]string{
				"r2": "r2" + suffix,
			},
		},
		{
			name: "should rename incoming if there is existing after dedup",
			existing: []*v1.PostableApiReceiver{
				r2,
				r2s,
			},
			incoming: []*v1.PostableApiReceiver{
				r("r2"),
			},
			expected: []*v1.PostableApiReceiver{
				r2,
				r2s,
				r("r2" + suffix + "_01"),
			},
			expectedRenames: map[string]string{
				"r2": "r2" + suffix + "_01",
			},
		},
		{
			name: "should keep names unique across both sets",
			existing: []*v1.PostableApiReceiver{
				r2,
				r2s,
			},
			incoming: []*v1.PostableApiReceiver{
				r("r2"),
				r("r2" + suffix + "_01"),
			},
			expected: []*v1.PostableApiReceiver{
				r2,
				r2s,
				r("r2" + suffix + "_02"),
				r("r2" + suffix + "_01"),
			},
			expectedRenames: map[string]string{
				"r2": "r2" + suffix + "_02",
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var existingNames, incomingNames []string
			for _, r := range tc.existing {
				existingNames = append(existingNames, r.Name)
			}
			for _, r := range tc.incoming {
				incomingNames = append(incomingNames, r.Name)
			}

			actual, actualRenames := MergeReceivers(tc.existing, tc.incoming, suffix)
			require.Len(t, actual, len(tc.expected))
			assert.EqualValues(t, tc.expectedRenames, actualRenames)
			for i := range tc.expected {
				assert.EqualValues(t, tc.expected[i], actual[i])
				if i < len(tc.existing) {
					assert.Same(t, tc.existing[i], actual[i])
				} else {
					idx := i - len(tc.existing)
					assert.NotSame(t, tc.incoming[idx], actual[i])
				}
			}

			t.Run("items of the lists should not be changed", func(t *testing.T) {
				var names []string
				for _, r := range tc.existing {
					names = append(names, r.Name)
				}
				assert.Equal(t, existingNames, names)
				names = nil
				for _, r := range tc.incoming {
					names = append(names, r.Name)
				}
				assert.Equal(t, incomingNames, names)
			})
		})
	}
}

func TestMergeTimeIntervals(t *testing.T) {
	ti := func(name string) v1.TimeInterval {
		return v1.TimeInterval{
			Name: name,
		}
	}
	mti := func(name string) v1.MuteTimeInterval {
		return v1.MuteTimeInterval{
			Name: name,
		}
	}

	suffix := "-dupe"

	testCases := []struct {
		name                  string
		existingMuteIntervals []v1.MuteTimeInterval
		existingTimeIntervals []v1.TimeInterval
		incomingMuteIntervals []v1.MuteTimeInterval
		incomingTimeIntervals []v1.TimeInterval
		expected              []v1.TimeInterval
		expectedRenames       map[string]string
	}{
		{
			name: "should append copies of incoming to existing time intervals",
			existingMuteIntervals: []v1.MuteTimeInterval{
				mti("mti1"),
			},
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti2"),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("ti4"),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("mti3"),
			},
			expected: []v1.TimeInterval{
				ti("ti2"),
				ti("ti4"),
				ti("mti3"),
			},
			expectedRenames: map[string]string{},
		},
		{
			name: "should rename incoming if there is existing",
			existingMuteIntervals: []v1.MuteTimeInterval{
				mti("mti1"),
			},
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti2"),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("mti1"),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti2"),
			},
			expected: []v1.TimeInterval{
				ti("ti2"),
				ti("mti1" + suffix),
				ti("ti2" + suffix),
			},
			expectedRenames: map[string]string{
				"ti2":  "ti2" + suffix,
				"mti1": "mti1" + suffix,
			},
		},
		{
			name: "should rename incoming if there is existing after dedup",
			existingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti1"),
			},
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti1" + suffix),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("ti1" + suffix),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti1"),
			},
			expected: []v1.TimeInterval{
				ti("ti1" + suffix),
				ti("ti1" + suffix + suffix),
				ti("ti1" + suffix + "_01"),
			},
			expectedRenames: map[string]string{
				"ti1" + suffix: "ti1" + suffix + suffix,
				"ti1":          "ti1" + suffix + "_01",
			},
		},
		{
			name: "should rename dupe among incoming",
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti2"),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("ti2"),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti2"),
			},
			expected: []v1.TimeInterval{ // mute intervals have precedence over time intervals in the case of duplicates (see https://github.com/grafana/alerting/blob/85dab908dcb43f7718a638b4c3cf9c214f7e48da/notify/grafana_alertmanager.go#L676-L685)
				ti("ti2"),
				ti("ti2" + suffix),
				ti("ti2" + suffix + "_01"),
			},
			expectedRenames: map[string]string{
				"ti2": "ti2" + suffix + "_01",
			},
		},
		{
			name: "should ensure uniqueness across existing and incoming",
			existingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti1"),
			},
			existingTimeIntervals: []v1.TimeInterval{
				ti("ti1" + suffix),
			},
			incomingTimeIntervals: []v1.TimeInterval{
				ti("ti1"),
				ti("ti2"),
			},
			incomingMuteIntervals: []v1.MuteTimeInterval{
				mti("ti1" + suffix + "_01"),
			},
			expected: []v1.TimeInterval{
				ti("ti1" + suffix),
				ti("ti1" + suffix + "_02"),
				ti("ti2"),
				ti("ti1" + suffix + "_01"),
			},
			expectedRenames: map[string]string{
				"ti1": "ti1" + suffix + "_02",
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var existingNames, incomingNames []string
			for _, r := range tc.existingMuteIntervals {
				existingNames = append(existingNames, r.Name)
			}
			for _, r := range tc.existingTimeIntervals {
				existingNames = append(existingNames, r.Name)
			}
			for _, r := range tc.incomingTimeIntervals {
				incomingNames = append(incomingNames, r.Name)
			}
			for _, r := range tc.incomingMuteIntervals {
				incomingNames = append(incomingNames, r.Name)
			}

			actualTimeIntervals, actualRenames := MergeTimeIntervals(tc.existingMuteIntervals, tc.existingTimeIntervals, tc.incomingMuteIntervals, tc.incomingTimeIntervals, suffix)
			assert.Equal(t, tc.expected, actualTimeIntervals)
			assert.EqualValues(t, tc.expectedRenames, actualRenames)

			// check that existing and incoming lists are not changed
			var names []string
			for _, r := range tc.existingMuteIntervals {
				names = append(names, r.Name)
			}
			for _, r := range tc.existingTimeIntervals {
				names = append(names, r.Name)
			}
			assert.Equal(t, existingNames, names)
			names = nil
			for _, r := range tc.incomingTimeIntervals {
				names = append(names, r.Name)
			}
			for _, r := range tc.incomingMuteIntervals {
				names = append(names, r.Name)
			}
			assert.Equal(t, incomingNames, names)
		})
	}
}

//go:embed testdata/mimir_no_intervals.yaml
var fullMimirNoIntervals string

//go:embed testdata/mimir_with_extra_receiver.yaml
var fullMimirWithExtraReceiver string

//go:embed testdata/mimir_with_only_extra_receiver.yaml
var fullMimirWithOnlyExtraReceiver string

//go:embed testdata/mimir_swapped_intervals.yaml
var fullMimirSwappedIntervals string

func load(t *testing.T, yaml string, mutate ...func(p *v1.PostableApiAlertingConfig)) *v1.PostableApiAlertingConfig {
	t.Helper()
	orig, err := definition.LoadCompat([]byte(yaml))
	require.NoError(t, err)
	p := v1.PostableApiAlertingConfigToModel(*orig)
	for _, m := range mutate {
		m(&p)
	}
	return &p
}

//go:embed testdata/grafana_config.yaml
var fullGrafanaConfig string

//go:embed testdata/mimir_config.yaml
var fullMimirConfig string

//go:embed testdata/merged_config.yaml
var fullMergedConfig string

func TestMergeExtraConfig(t *testing.T) {
	identifier := "_mimir-12345"
	subtreeMatchers := config.Matchers{
		{Type: labels.MatchEqual, Name: "__datasource_uid__", Value: "12345"},
		{Type: labels.MatchEqual, Name: "__mimir__", Value: "true"},
	}

	// withExtra wraps grafana and a raw mimir YAML string into a PostableUserConfig with ExtraConfigs.
	// Optional mutateFn can adjust the ExtraConfiguration before it's used.
	withExtra := func(t *testing.T, grafana *v1.PostableApiAlertingConfig, mimirYAML string, mutateFn ...func(*v1.ExtraConfiguration)) v1.AMConfigV1 {
		t.Helper()
		extra := v1.ExtraConfiguration{
			Identifier:         identifier,
			MergeMatchers:      subtreeMatchers,
			AlertmanagerConfig: mimirYAML,
		}
		for _, fn := range mutateFn {
			fn(&extra)
		}
		return v1.AMConfigV1{
			AlertmanagerConfig: *grafana,
			ExtraConfigs:       []v1.ExtraConfiguration{extra},
		}
	}

	assertResult := func(t *testing.T, expected, actual MergeResult) {
		t.Helper()
		diff := cmp.Diff(expected, actual,
			cmpopts.IgnoreUnexported(commoncfg.ProxyConfig{}, httpcfg.ProxyConfig{}, labels.Matcher{}, v1.AMConfigV1{}),
			cmpopts.SortSlices(func(a, b *labels.Matcher) bool { return a.Name < b.Name }),
			cmpopts.SortSlices(func(a, b *v1.PostableApiReceiver) bool { return a.Name < b.Name }),
			cmpopts.EquateEmpty(),
			cmpopts.IgnoreFields(MergeResult{}, "ExtraRoute", "ExtraInhibitRules"),
		)
		if !assert.Empty(t, diff) {
			data, err := yaml.Marshal(actual.Config)
			require.NoError(t, err)
			t.Fatalf("YAML:\n%v", string(data))
		}
	}

	t.Run("should merge all resources, no renames", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig)
		result, err := MergeExtraConfig(context.Background(), &input)
		require.NoError(t, err)

		assertResult(t, MergeResult{
			Config:     v1.AMConfigV1{AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) { p.Global = nil })},
			Identifier: identifier,
		}, result)
	})

	t.Run("should populate intervals by defaults", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirNoIntervals)
		result, err := MergeExtraConfig(context.Background(), &input)
		require.NoError(t, err)

		assertResult(t, MergeResult{
			Config: v1.AMConfigV1{AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) {
				p.Global = nil
				gw := model.Duration(dispatch.DefaultRouteOpts.GroupWait)
				gi := model.Duration(dispatch.DefaultRouteOpts.GroupInterval)
				ri := model.Duration(dispatch.DefaultRouteOpts.RepeatInterval)
				p.Route.Routes[0].GroupWait = &gw
				p.Route.Routes[0].GroupInterval = &gi
				p.Route.Routes[0].RepeatInterval = &ri
			})},
			Identifier: identifier,
		}, result)
	})

	t.Run("should rename receivers and refactor usages", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirWithExtraReceiver)
		result, err := MergeExtraConfig(context.Background(), &input)
		require.NoError(t, err)

		assertResult(t, MergeResult{
			Config: v1.AMConfigV1{AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) {
				p.Global = nil
				p.Route.Routes[0].Routes = append(p.Route.Routes[0].Routes, &v1.Route{
					Receiver: "grafana-default-email" + identifier,
					Matchers: config.Matchers{{Type: labels.MatchEqual, Name: "label", Value: "test"}},
				})
				p.Receivers = append(p.Receivers, &v1.PostableApiReceiver{
					Receiver: definition.Receiver{Name: "grafana-default-email" + identifier},
				})
			})},
			RenameResources: RenameResources{
				Receivers: map[string]string{"grafana-default-email": "grafana-default-email" + identifier},
			},
			Identifier: identifier,
		}, result)
	})

	t.Run("should append index suffix if rename still collides", func(t *testing.T) {
		grafana := load(t, fullGrafanaConfig, func(p *v1.PostableApiAlertingConfig) {
			p.Receivers = append(p.Receivers, &v1.PostableApiReceiver{
				Receiver: definition.Receiver{Name: "grafana-default-email" + identifier},
			})
		})
		input := withExtra(t, grafana, fullMimirWithOnlyExtraReceiver)
		result, err := MergeExtraConfig(context.Background(), &input)
		require.NoError(t, err)

		assertResult(t, MergeResult{
			Config: v1.AMConfigV1{AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) {
				p.Global = nil
				p.Receivers = append(p.Receivers,
					&v1.PostableApiReceiver{Receiver: definition.Receiver{Name: "grafana-default-email" + identifier}},
					&v1.PostableApiReceiver{Receiver: definition.Receiver{Name: "grafana-default-email" + identifier + "_01"}},
				)
			})},
			RenameResources: RenameResources{
				Receivers: map[string]string{"grafana-default-email": "grafana-default-email" + identifier + "_01"},
			},
			Identifier: identifier,
		}, result)
	})

	t.Run("should rename time intervals and refactor usages", func(t *testing.T) {
		// fullMimirSwappedIntervals has mute_time_intervals=[ti-1] and time_intervals=[ti-2, mti-1],
		// intentionally swapping names to verify uniqueness is enforced across both fields.
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirSwappedIntervals)
		result, err := MergeExtraConfig(context.Background(), &input)
		require.NoError(t, err)

		assertResult(t, MergeResult{
			Config: v1.AMConfigV1{AlertmanagerConfig: *load(t, fullMergedConfig, func(p *v1.PostableApiAlertingConfig) {
				p.Global = nil
				// fullMimirSwappedIntervals removed mti-2 from mute_time_intervals, so the
				// recv2 sub-route no longer has a mute interval.
				p.Route.Routes[0].Routes[0].MuteTimeIntervals = nil
				// remove mti-2 that was replaced by ti-1 in fullMimirSwappedIntervals
				expected := p.TimeIntervals[:len(p.TimeIntervals)-1]
				expected = append(expected, v1.TimeInterval{Name: "mti-1" + identifier})
				expected = append(expected, v1.TimeInterval{Name: "ti-1" + identifier})
				p.TimeIntervals = expected
				p.Route.Routes[0].Routes = append(p.Route.Routes[0].Routes, &v1.Route{
					Matchers:            config.Matchers{{Type: labels.MatchEqual, Name: "label", Value: "test"}},
					MuteTimeIntervals:   []string{"ti-1" + identifier},
					ActiveTimeIntervals: []string{"mti-1" + identifier},
				})
			})},
			RenameResources: RenameResources{
				TimeIntervals: map[string]string{
					"ti-1":  "ti-1" + identifier,
					"mti-1": "mti-1" + identifier,
				},
			},
			Identifier: identifier,
		}, result)
	})

	t.Run("should fail if merging matchers conflict with Grafana, exact match", func(t *testing.T) {
		grafana := load(t, fullGrafanaConfig, func(p *v1.PostableApiAlertingConfig) {
			p.Route.Routes = append(p.Route.Routes, &v1.Route{Matchers: subtreeMatchers})
		})
		input := withExtra(t, grafana, fullMimirConfig)
		_, err := MergeExtraConfig(context.Background(), &input)
		assert.ErrorIs(t, err, ErrSubtreeMatchersConflict)
	})

	t.Run("should fail if merging matchers conflict with Grafana, subset match", func(t *testing.T) {
		grafana := load(t, fullGrafanaConfig, func(p *v1.PostableApiAlertingConfig) {
			m, err := labels.NewMatcher(labels.MatchEqual, "label", "test")
			require.NoError(t, err)
			p.Route.Routes = append(p.Route.Routes, &v1.Route{
				Matchers: append(subtreeMatchers, m),
			})
		})
		input := withExtra(t, grafana, fullMimirConfig)
		_, err := MergeExtraConfig(context.Background(), &input)
		assert.ErrorIs(t, err, ErrSubtreeMatchersConflict)
	})

	t.Run("should not modify the base Grafana config", func(t *testing.T) {
		g := load(t, fullGrafanaConfig)
		input := withExtra(t, g, fullMimirConfig)
		_, err := MergeExtraConfig(context.Background(), &input)
		require.NoError(t, err)
		assert.Equal(t, load(t, fullGrafanaConfig), g)
	})

	t.Run("should skip merging routes and inhibition rules if matchers are empty", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig, func(e *v1.ExtraConfiguration) {
			e.MergeMatchers = config.Matchers{}
		})
		result, err := MergeExtraConfig(context.Background(), &input)
		require.NoError(t, err)

		full := load(t, fullMergedConfig)
		full.Route.Routes = full.Route.Routes[1:]
		full.InhibitRules = load(t, fullGrafanaConfig).InhibitRules
		full.Global = nil

		assertResult(t, MergeResult{
			Config:     v1.AMConfigV1{AlertmanagerConfig: *full},
			Identifier: identifier,
		}, result)
	})

	t.Run("should return base config unchanged if no extra configs", func(t *testing.T) {
		input := v1.AMConfigV1{AlertmanagerConfig: *load(t, fullGrafanaConfig)}
		result, err := MergeExtraConfig(context.Background(), &input)
		require.NoError(t, err)
		assert.Equal(t, input, result.Config)
	})

	t.Run("should fail if identifier is empty", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig, func(e *v1.ExtraConfiguration) {
			e.Identifier = ""
		})
		_, err := MergeExtraConfig(context.Background(), &input)
		require.ErrorContains(t, err, "identifier is required")
	})

	t.Run("should fail if matcher type is not equal", func(t *testing.T) {
		input := withExtra(t, load(t, fullGrafanaConfig), fullMimirConfig, func(e *v1.ExtraConfiguration) {
			e.MergeMatchers = config.Matchers{{Type: labels.MatchNotEqual, Name: "cluster", Value: "prod"}}
		})
		_, err := MergeExtraConfig(context.Background(), &input)
		require.ErrorContains(t, err, "only matchers with type equal are supported")
	})

	t.Run("should fail if base route is nil and matchers are set", func(t *testing.T) {
		grafana := load(t, fullGrafanaConfig, func(p *v1.PostableApiAlertingConfig) {
			p.Route = nil
		})
		input := withExtra(t, grafana, fullMimirConfig)
		_, err := MergeExtraConfig(context.Background(), &input)
		require.ErrorContains(t, err, "cannot merge into undefined routing tree")
	})
}
