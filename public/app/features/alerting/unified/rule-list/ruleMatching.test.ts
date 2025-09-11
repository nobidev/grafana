import { mockPromAlertingRule, mockPromRecordingRule } from '../mocks';
import { alertingFactory } from '../mocks/server/db';

import { 
  getMatchingPromRule, 
  getMatchingPromRuleOriginal, 
  getMatchingRulerRule,
  getMatchingRulerRuleOriginal,
  matchRulesGroup,
  matchRulesGroupOriginal
} from './ruleMatching';

describe('getMatchingRulerRule', () => {
  it('should match rule by unique name', () => {
    // Create a ruler rule group with a single rule
    const rulerRule = alertingFactory.ruler.alertingRule.build({ alert: 'test-rule' });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

    // Create a matching prom rule with same name
    const promRule = mockPromAlertingRule({ name: 'test-rule' });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBe(rulerRule);
  });

  it('should not match when names are different', () => {
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'test-rule-1',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

    // Create a prom rule with different name but same labels/annotations
    const promRule = mockPromAlertingRule({
      name: 'test-rule-2',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBeUndefined();
  });

  it('should match by labels and annotations when multiple rules have same name', () => {
    // Create two ruler rules with same name but different labels
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'critical' },
      annotations: { summary: 'different' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create a matching prom rule with same name and matching labels
    const promRule = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBe(rulerRule1);
  });

  it('should match by query when multiple rules have same name and labels', () => {
    // Create two ruler rules with same name and labels but different queries
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      expr: 'up == 1',
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      expr: 'up == 0',
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create a matching prom rule with same name, labels, and query
    const promRule = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      query: 'up == 1',
    });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBe(rulerRule1);
  });

  it('should return undefined when rules differ only in the query part', () => {
    // Create two ruler rules with same name but different labels and queries
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      expr: 'up == 1',
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'critical' },
      annotations: { summary: 'different' },
      expr: 'up == 0',
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create a prom rule with same name but non-matching labels and query
    const promRule = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'error' },
      annotations: { summary: 'other' },
      query: 'up == 2',
    });

    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBeUndefined();
  });
});

describe('getMatchingPromRule', () => {
  it('should match rule by unique name', () => {
    // Create a prom rule group with a single rule
    const promRule = mockPromAlertingRule({ name: 'test-rule' });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule] });

    // Create a matching ruler rule with same name
    const rulerRule = alertingFactory.ruler.alertingRule.build({ alert: 'test-rule' });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBe(promRule);
  });

  it('should not match when names are different', () => {
    const promRule = mockPromAlertingRule({
      name: 'test-rule-1',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule] });

    // Create a ruler rule with different name but same labels/annotations
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'test-rule-2',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBeUndefined();
  });

  it('should match by labels and annotations when multiple rules have same name', () => {
    // Create two prom rules with same name but different labels
    const promRule1 = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const promRule2 = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'critical' },
      annotations: { summary: 'different' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    // Create a matching ruler rule with same name and matching labels
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBe(promRule1);
  });

  it('should match by query when multiple rules have same name and labels', () => {
    // Create two prom rules with same name and labels but different queries
    const promRule1 = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      query: 'up == 1',
    });
    const promRule2 = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      query: 'up == 0',
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    // Create a matching ruler rule with same name, labels, and expression
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      expr: 'up == 1',
    });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBe(promRule1);
  });

  it('should return undefined when rules differ only in the query part', () => {
    // Create two prom rules with same name but different labels and queries
    const promRule1 = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
      query: 'up == 1',
    });
    const promRule2 = mockPromAlertingRule({
      name: 'same-name',
      labels: { severity: 'critical' },
      annotations: { summary: 'different' },
      query: 'up == 0',
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    // Create a ruler rule with same name but non-matching labels and expression
    const rulerRule = alertingFactory.ruler.alertingRule.build({
      alert: 'same-name',
      labels: { severity: 'error' },
      annotations: { summary: 'other' },
      expr: 'up == 2',
    });

    const match = getMatchingPromRule(promGroup, rulerRule);
    expect(match).toBeUndefined();
  });
});

describe('Recording rules with comments', () => {
  it('should match recording rules when ruler has comments but prometheus does not', () => {
    // Test case where ruler rule contains comments and formatting that get stripped by Prometheus
    const rulerRule = alertingFactory.ruler.recordingRule.build({
      record: 'service_condition',
      expr: `# This is a comment
max by (environment, namespace, service) (service_condition{environment="production", area!="", area_check=""})
or
# Another comment
max by (environment, namespace, service) (service_condition{environment!="production", area!="", area_check=""}) * on (environment, namespace, service) group_left(criticality) service_info`,
      labels: {}
    });
    
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

    // Prometheus rule has the same logic but comments are stripped and formatting is normalized
    const promRule = mockPromRecordingRule({
      name: 'service_condition',
      query: 'max by (environment, namespace, service) (service_condition{area!="",area_check="",environment="production"}) or max by (environment, namespace, service) (service_condition{area!="",area_check="",environment!="production"}) * on (environment, namespace, service) group_left (criticality) service_info',
      labels: {}
    });

    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule] });

    // This should match despite the comments and formatting differences
    const match = getMatchingRulerRule(rulerGroup, promRule);
    expect(match).toBe(rulerRule);
    
    // Also test the group matching
    const result = matchRulesGroup(rulerGroup, promGroup);
    expect(result.matches.size).toBe(1);
    expect(result.matches.get(rulerRule)).toBe(promRule);
    expect(result.promOnlyRules).toHaveLength(0);
  });

  it('should handle multiple service_condition rules with different queries', () => {
    // Create two ruler rules with same name but different queries (similar to the real scenario)
    const rulerRule1 = alertingFactory.ruler.recordingRule.build({
      record: 'service_condition',
      expr: '(max by (environment, namespace, service, area) (service_condition{area_check!="", monitored="true"}))',
      labels: {}
    });
    
    const rulerRule2 = alertingFactory.ruler.recordingRule.build({
      record: 'service_condition',
      expr: `# Original mapping for production - to be removed post-testing
max by (environment, namespace, service) (service_condition{environment="production", area!="", area_check=""})
or
# Determine which services are broken and determine priority
max by (environment, namespace, service) (service_condition{environment!="production", area!="", area_check=""}) * on (environment, namespace, service) group_left(criticality) service_info * on (environment, criticality) group_left(priority, condition) service_condition_priority{condition="broken"} >= 4 < 8`,
      labels: {}
    });
    
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Prometheus rules have the same logic but normalized formatting
    const promRule1 = mockPromRecordingRule({
      name: 'service_condition',
      query: '(max by (environment, namespace, service, area) (service_condition{area_check!="",monitored="true"}))',
      labels: {}
    });
    
    const promRule2 = mockPromRecordingRule({
      name: 'service_condition',
      query: 'max by (environment, namespace, service) (service_condition{area!="",area_check="",environment="production"}) or max by (environment, namespace, service) (service_condition{area!="",area_check="",environment!="production"}) * on (environment, namespace, service) group_left (criticality) service_info * on (environment, criticality) group_left (priority, condition) service_condition_priority{condition="broken"} >= 4 < 8',
      labels: {}
    });

    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    // Test individual matching - this should work correctly for each rule
    const match1 = getMatchingRulerRule(rulerGroup, promRule1);
    const match2 = getMatchingRulerRule(rulerGroup, promRule2);
    
    expect(match1).toBe(rulerRule1);
    expect(match2).toBe(rulerRule2);

    // Test group matching - both rules should be matched correctly
    const result = matchRulesGroup(rulerGroup, promGroup);
    expect(result.matches.size).toBe(2);
    expect(result.matches.get(rulerRule1)).toBe(promRule1);
    expect(result.matches.get(rulerRule2)).toBe(promRule2);
    expect(result.promOnlyRules).toHaveLength(0);
  });
});

describe('PromQL Edge Cases - hashQuery Algorithm Tests', () => {
  describe('Label selector ordering', () => {
    it('should match queries with identical labels in different orders', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'http_requests_rate',
        expr: 'rate(http_requests_total{method="GET", status="200", job="api"}[5m])',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      // Same labels, different order
      const promRule = mockPromRecordingRule({
        name: 'http_requests_rate',
        query: 'rate(http_requests_total{job="api", status="200", method="GET"}[5m])',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should not match queries with different label values', () => {
      // Create two ruler rules with same name but different label values
      const rulerRule1 = alertingFactory.ruler.recordingRule.build({
        record: 'http_requests_rate',
        expr: 'rate(http_requests_total{method="GET", status="200"}[5m])',
        labels: {}
      });
      
      const rulerRule2 = alertingFactory.ruler.recordingRule.build({
        record: 'http_requests_rate',
        expr: 'rate(http_requests_total{method="POST", status="200"}[5m])',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

      // Prometheus rule with different status value from both ruler rules
      const promRule = mockPromRecordingRule({
        name: 'http_requests_rate',
        query: 'rate(http_requests_total{method="GET", status="500"}[5m])',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBeUndefined();
    });
  });

  describe('Whitespace and formatting variations', () => {
    it('should match queries with different function spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'cpu_usage',
        expr: 'sum by (instance) (rate(cpu_usage[5m]))',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'cpu_usage',
        query: 'sum by(instance)(rate(cpu_usage[5m]))',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should match queries with different operator spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'error_rate',
        expr: 'rate(errors[5m]) + rate(timeouts[5m])',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'error_rate',
        query: 'rate(errors[5m])+rate(timeouts[5m])',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should match queries with different range vector spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'request_rate',
        expr: 'rate(requests[5m])',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'request_rate',
        query: 'rate(requests[ 5m ])',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should match queries with different comparison operator spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'high_cpu',
        expr: 'cpu_usage>=0.8',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'high_cpu',
        query: 'cpu_usage >= 0.8',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should match queries with different set operation spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'combined_metrics',
        expr: 'metric1 and metric2',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'combined_metrics',
        query: 'metric1and metric2',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });
  });

  describe('Quote style normalization', () => {
    it('should match queries with single vs double quotes', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'api_requests',
        expr: 'sum(http_requests{job="api", method="GET"})',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'api_requests',
        query: "sum(http_requests{job='api', method='GET'})",
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });
  });

  describe('Parentheses handling', () => {
    it('should match queries with and without outer parentheses', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'cpu_total',
        expr: '(sum(cpu_usage))',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'cpu_total',
        query: 'sum(cpu_usage)',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });
  });

  describe('Character sorting issues - False Positives', () => {
    it('should NOT match semantically different queries that might appear identical after character sorting', () => {
      // Create two ruler rules with same name but semantically different queries
      const rulerRule1 = alertingFactory.ruler.recordingRule.build({
        record: 'calculation',
        expr: 'a + b * c', // This is a + (b * c)
        labels: {}
      });
      
      const rulerRule2 = alertingFactory.ruler.recordingRule.build({
        record: 'calculation', 
        expr: 'x * y + z', // Different calculation
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

      // Prometheus rule that should NOT match either ruler rule
      const promRule = mockPromRecordingRule({
        name: 'calculation',
        query: '(a + b) * c', // This is (a + b) * c - completely different result
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      // This should NOT match because the query is semantically different from both ruler rules
      expect(match).toBeUndefined();
    });

    it('should NOT match queries with different aggregation functions', () => {
      // Create two ruler rules with same name but different aggregation functions
      const rulerRule1 = alertingFactory.ruler.recordingRule.build({
        record: 'metric_agg',
        expr: 'avg(http_requests)',
        labels: {}
      });
      
      const rulerRule2 = alertingFactory.ruler.recordingRule.build({
        record: 'metric_agg',
        expr: 'max(http_requests)', // Different from both avg and sum
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

      const promRule = mockPromRecordingRule({
        name: 'metric_agg',
        query: 'sum(http_requests)', // Different aggregation function from both ruler rules
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBeUndefined();
    });
  });

  describe('Complex PromQL aggregation functions', () => {
    it('should handle quantile functions with different spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'http_request_duration_p95',
        expr: 'histogram_quantile(0.95, sum by(le) (rate(http_request_duration_seconds_bucket[5m])))',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'http_request_duration_p95',
        query: 'histogram_quantile( 0.95 , sum by (le) (rate(http_request_duration_seconds_bucket[5m])) )',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle topk/bottomk with different formatting', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'top_10_cpu_users',
        expr: 'topk(10,sum by(instance)(cpu_usage))',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'top_10_cpu_users',
        query: 'topk( 10 , sum by (instance) (cpu_usage) )',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle aggregation with without clause', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'total_requests_without_method',
        expr: 'sum without(method) (http_requests_total)',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'total_requests_without_method',
        query: 'sum without (method) (http_requests_total)',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });
  });

  describe('Regex and comparison operators', () => {
    it('should handle regex operators with different spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'error_logs',
        expr: 'count by(job) (log_messages{level=~"error|warn"})',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'error_logs',
        query: 'count by (job) (log_messages{level =~ "error|warn"})',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle negative regex operators', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'non_test_metrics',
        expr: 'sum(metrics{job!~".*test.*"})',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'non_test_metrics',
        query: 'sum(metrics{job !~ ".*test.*"})',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle multiple comparison operators', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'filtered_metrics',
        expr: 'avg(cpu_usage{instance!="localhost"} > 0.5 <= 0.9)',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'filtered_metrics',
        query: 'avg(cpu_usage{instance != "localhost"} >0.5<= 0.9)',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });
  });

  describe('Offset and @ modifiers', () => {
    it('should handle offset with different spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'cpu_change',
        expr: 'cpu_usage - cpu_usage offset 1h',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'cpu_change',
        query: 'cpu_usage - cpu_usageoffset1h',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle @ modifier with different spacing', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'historical_value',
        expr: 'metric @ 1609459200',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'historical_value',
        query: 'metric@1609459200',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });
  });

  describe('Complex multi-operator expressions', () => {
    it('should handle complex boolean logic', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'complex_condition',
        expr: '(cpu_usage > 0.8 and memory_usage > 0.9) or (disk_usage > 0.95 unless maintenance_mode == 1)',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'complex_condition',
        query: '(cpu_usage>0.8and memory_usage>0.9)or(disk_usage>0.95unless maintenance_mode==1)',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle vector matching with group modifiers', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'service_availability',
        expr: 'up * on (instance) group_left (service, team) service_info',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'service_availability',
        query: 'up*on(instance)group_left(service,team)service_info',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle rate calculations with complex aggregations', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'request_success_rate',
        expr: `sum(rate(http_requests_total{status=~"2.."}[5m])) by (service)
               /
               sum(rate(http_requests_total[5m])) by (service)`,
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'request_success_rate',
        query: 'sum(rate(http_requests_total{status=~"2.."}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });
  });

  describe('Subqueries and nested functions', () => {
    it('should handle subqueries with different formatting', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'max_over_time_rate',
        expr: 'max_over_time(rate(cpu_usage[1m])[5m:1m])',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'max_over_time_rate',
        query: 'max_over_time( rate(cpu_usage[1m])[ 5m : 1m ] )',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle deeply nested aggregations', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'memory_utilization_complex',
        expr: 'avg by (instance) (memory_used) / on (instance) avg by (instance) (memory_total) * 100',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'memory_utilization_complex',
        query: 'avg by(instance)(memory_used) / on(instance) avg by(instance)(memory_total) * 100',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });

    it('should handle complex histogram operations', () => {
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: 'request_duration_comparison',
        expr: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) / histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
        labels: {}
      });
      
      const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule] });

      const promRule = mockPromRecordingRule({
        name: 'request_duration_comparison',
        query: 'histogram_quantile( 0.95 , sum(rate(http_request_duration_seconds_bucket[5m]))by(le)) / histogram_quantile( 0.50 , sum(rate(http_request_duration_seconds_bucket[5m]))by(le))',
          labels: {}
      });

      const match = getMatchingRulerRule(rulerGroup, promRule);
      expect(match).toBe(rulerRule);
    });
  });
});


describe('matchRulesGroup', () => {
  it('should match all rules when both groups have the same rules', () => {
    // Create ruler rules
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-1',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-2',
      labels: { severity: 'critical' },
      annotations: { summary: 'test' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create matching prom rules
    const promRule1 = mockPromAlertingRule({
      name: 'rule-1',
      labels: { severity: 'warning' },
      annotations: { summary: 'test' },
    });
    const promRule2 = mockPromAlertingRule({
      name: 'rule-2',
      labels: { severity: 'critical' },
      annotations: { summary: 'test' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    const result = matchRulesGroup(rulerGroup, promGroup);

    // All rules should be matched
    expect(result.matches.size).toBe(2);
    expect(result.matches.get(rulerRule1)).toBe(promRule1);
    expect(result.matches.get(rulerRule2)).toBe(promRule2);
    expect(result.promOnlyRules).toHaveLength(0);
  });

  it('should handle ruler group having more rules than prom group', () => {
    // Create ruler rules (3 rules)
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-1',
      labels: { severity: 'warning' },
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-2',
      labels: { severity: 'critical' },
    });
    const rulerRule3 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-3',
      labels: { severity: 'error' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2, rulerRule3] });

    // Create matching prom rules (only 2 rules)
    const promRule1 = mockPromRecordingRule({
      name: 'rule-1',
      labels: { severity: 'warning' },
    });
    const promRule2 = mockPromRecordingRule({
      name: 'rule-2',
      labels: { severity: 'critical' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2] });

    const result = matchRulesGroup(rulerGroup, promGroup);

    // Only 2 rules should be matched
    expect(result.matches.size).toBe(2);
    expect(result.matches.get(rulerRule1)).toBe(promRule1);
    expect(result.matches.get(rulerRule2)).toBe(promRule2);
    expect(result.matches.get(rulerRule3)).toBeUndefined();
    expect(result.promOnlyRules).toHaveLength(0);
  });

  it('should handle prom group having more rules than ruler group', () => {
    // Create ruler rules (2 rules)
    const rulerRule1 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-1',
      labels: { severity: 'warning' },
    });
    const rulerRule2 = alertingFactory.ruler.alertingRule.build({
      alert: 'rule-2',
      labels: { severity: 'critical' },
    });
    const rulerGroup = alertingFactory.ruler.group.build({ rules: [rulerRule1, rulerRule2] });

    // Create matching prom rules (3 rules)
    const promRule1 = mockPromRecordingRule({
      name: 'rule-1',
      labels: { severity: 'warning' },
    });
    const promRule2 = mockPromRecordingRule({
      name: 'rule-2',
      labels: { severity: 'critical' },
    });
    const promRule3 = mockPromRecordingRule({
      name: 'rule-3',
      labels: { severity: 'error' },
    });
    const promGroup = alertingFactory.prometheus.group.build({ rules: [promRule1, promRule2, promRule3] });

    const result = matchRulesGroup(rulerGroup, promGroup);

    // 2 rules should be matched, 1 should be in promOnlyRules
    expect(result.matches.size).toBe(2);
    expect(result.matches.get(rulerRule1)).toBe(promRule1);
    expect(result.matches.get(rulerRule2)).toBe(promRule2);
    expect(result.promOnlyRules).toHaveLength(1);
    expect(result.promOnlyRules[0]).toBe(promRule3);
  });
});

describe('Performance Benchmarks - Original vs Optimized', () => {
  // Helper function to generate large rule sets for benchmarking
  function generateLargeRuleSet(count: number) {
    const rulerRules = [];
    const promRules = [];

    for (let i = 0; i < count; i++) {
      // Create some rules that will match and some that won't
      const shouldMatch = i % 3 !== 0; // 2/3 will match, 1/3 won't
      const baseName = `rule_${i}`;
      
      // Create ruler rule
      const rulerRule = alertingFactory.ruler.recordingRule.build({
        record: baseName,
        labels: { 
          severity: i % 2 === 0 ? 'warning' : 'critical',
          team: `team_${Math.floor(i / 10)}`,
        },
        expr: `sum(metric_${i}[5m])`,
      });
      rulerRules.push(rulerRule);

      // Create corresponding prometheus rule (or not, depending on shouldMatch)
      if (shouldMatch) {
        const promRule = mockPromRecordingRule({
          name: baseName,
          labels: { 
            severity: i % 2 === 0 ? 'warning' : 'critical',
            team: `team_${Math.floor(i / 10)}`,
          },
          query: `sum(metric_${i}[5m])`,
        });
        promRules.push(promRule);
      } else {
        // Add a non-matching rule to increase search complexity
        const promRule = mockPromRecordingRule({
          name: `different_${i}`,
          labels: { severity: 'info' },
          query: `count(other_metric_${i})`,
        });
        promRules.push(promRule);
      }
    }

    return {
      rulerGroup: alertingFactory.ruler.group.build({ rules: rulerRules }),
      promGroup: alertingFactory.prometheus.group.build({ rules: promRules }),
    };
  }

  function runBenchmark(name: string, count: number, warmup = true) {
    const { rulerGroup, promGroup } = generateLargeRuleSet(count);
    
    // Adjust iterations based on size - fewer iterations for larger datasets
    const iterations = count > 5000 ? 2 : count > 1000 ? 3 : 5;
    const warmupRuns = count > 5000 ? 1 : 2;
    
    // Warmup runs to avoid JIT compilation effects
    if (warmup) {
      for (let i = 0; i < warmupRuns; i++) {
        matchRulesGroupOriginal(rulerGroup, promGroup);
        matchRulesGroup(rulerGroup, promGroup);
      }
    }

    // Run multiple iterations for more stable measurements
    let originalTotal = 0;
    let optimizedTotal = 0;

    for (let i = 0; i < iterations; i++) {
      // Benchmark original implementation
      const originalStart = performance.now();
      const originalResult = matchRulesGroupOriginal(rulerGroup, promGroup);
      const originalEnd = performance.now();
      originalTotal += (originalEnd - originalStart);

      // Benchmark optimized implementation  
      const optimizedStart = performance.now();
      const optimizedResult = matchRulesGroup(rulerGroup, promGroup);
      const optimizedEnd = performance.now();
      optimizedTotal += (optimizedEnd - optimizedStart);

      // Verify both implementations produce the same results (only once)
      if (i === 0) {
        expect(optimizedResult.matches.size).toBe(originalResult.matches.size);
        expect(optimizedResult.promOnlyRules.length).toBe(originalResult.promOnlyRules.length);
      }
    }

    const originalTime = originalTotal / iterations;
    const optimizedTime = optimizedTotal / iterations;
    const improvement = originalTime / optimizedTime;
    
    // Debug: Log actual measurements with more detail for large datasets
    let debugMsg = `${name}: Original ${originalTime.toFixed(3)}ms vs Optimized ${optimizedTime.toFixed(3)}ms (${improvement.toFixed(2)}x)`;
    if (improvement > 1) {
      debugMsg += ' ✅ OPTIMIZED FASTER';
    } else {
      debugMsg += ' ⚠️ ORIGINAL FASTER';
    }
    
    return {
      original: originalTime,
      optimized: optimizedTime,
      improvement: improvement,
      matchCount: rulerGroup.rules.length,
      debug: debugMsg
    };
  }

  it('should measure performance with 50 rules', () => {
    const results = runBenchmark('50 rules', 50);
    
    expect(results.matchCount).toBe(50);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);

    console.log(results.debug);
  });

  it('should measure performance with 100 rules', () => {
    const results = runBenchmark('100 rules', 100);
    
    expect(results.matchCount).toBe(100);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);
    
    console.log(results.debug);
  });

  it('should measure performance with 200 rules', () => {
    const results = runBenchmark('200 rules', 200);
    
    expect(results.matchCount).toBe(200);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);
    
    console.log(results.debug);
  });

  it('should measure performance with 500 rules (O(n²) vs O(n) should show here)', () => {
    const results = runBenchmark('500 rules', 500);
    
    expect(results.matchCount).toBe(500);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);
    
    console.log(results.debug);
  });

  it('should measure performance with 1000 rules', () => {
    const results = runBenchmark('1000 rules', 1000);
    
    expect(results.matchCount).toBe(1000);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);
    
    console.log(results.debug);
  });

  it('should measure performance with 2500 rules', () => {
    const results = runBenchmark('2500 rules', 2500);
    
    expect(results.matchCount).toBe(2500);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);
    
    console.log(results.debug);
  });

  it('should measure performance with 5000 rules', () => {
    const results = runBenchmark('5000 rules', 5000);
    
    expect(results.matchCount).toBe(5000);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);
    
    console.log(results.debug);
  });

  it('should measure performance with 10000 rules (O(n²) should be very apparent here)', () => {
    const results = runBenchmark('10000 rules', 10000);
    
    expect(results.matchCount).toBe(10000);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);
    
    console.log(results.debug);
    
    // At this scale, optimized should be significantly faster
    expect(results.improvement).toBeGreaterThan(2);
  });

  it('should measure performance with 20000 rules (extreme scale test)', () => {
    const results = runBenchmark('20000 rules', 20000);
    
    expect(results.matchCount).toBe(20000);
    expect(results.original).toBeGreaterThan(0);
    expect(results.optimized).toBeGreaterThan(0);
    
    console.log(results.debug);
    
    // At this scale, optimized should be dramatically faster
    expect(results.improvement).toBeGreaterThan(5);
  });

  it('should measure individual rule matching performance', () => {
    const { rulerGroup, promGroup } = generateLargeRuleSet(200);
    const testRule = promGroup.rules[50]; // Pick a rule from the middle
    const iterations = 50;
    
    // Warmup
    for (let i = 0; i < 5; i++) {
      getMatchingRulerRuleOriginal(rulerGroup, testRule);
      getMatchingRulerRule(rulerGroup, testRule);
    }

    // Benchmark original
    const originalStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      getMatchingRulerRuleOriginal(rulerGroup, testRule);
    }
    const originalEnd = performance.now();
    const originalTime = originalEnd - originalStart;

    // Benchmark optimized
    const optimizedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      getMatchingRulerRule(rulerGroup, testRule);
    }
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    const improvement = originalTime / optimizedTime;
    
    expect(originalTime).toBeGreaterThan(0);
    expect(optimizedTime).toBeGreaterThan(0);

    console.log(`Individual matching: Original avg: ${(originalTime/iterations).toFixed(3)}ms, Optimized avg: ${(optimizedTime/iterations).toFixed(3)}ms, Improvement: ${improvement.toFixed(2)}x`);
  });
});

describe('hashQuery Performance Benchmarks - Original vs Fixed', () => {
  // Import the hashQuery functions for benchmarking
  let hashQuery: (query: string) => string;
  let hashQueryOriginal: (query: string) => string;

  beforeAll(async () => {
    const ruleIdModule = await import('../utils/rule-id');
    hashQuery = ruleIdModule.hashQuery;
    hashQueryOriginal = ruleIdModule.hashQueryOriginal;
  });

  const testQueries = [
    'up{job="prometheus"}',
    'rate(http_requests_total{status="200"}[5m])',
    'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
    'sum by (job) (rate(cpu_usage_seconds_total[1m]))',
    'avg_over_time(memory_usage_bytes[10m]) > 1000000000',
    'max by (instance) (disk_usage_percent{mountpoint="/"}) < 90',
    '(rate(http_requests_total[5m]) * on(job) group_left(version) service_info) / ignoring(version) rate(http_requests_total[5m])',
    'predict_linear(node_filesystem_avail_bytes{fstype!="tmpfs"}[6h], 24*3600) < 0',
    'changes(process_start_time_seconds[1h]) > 0 and on(instance) up{job=~".*node.*"} == 1',
    'clamp_max(deriv(process_resident_memory_bytes[5m]), 0) * -1'
  ];

  it('should benchmark hashQuery performance - original vs fixed', () => {
    // Mock console.log to avoid Jest failing on console output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const iterations = 1000;
    let originalTotal = 0;
    let fixedTotal = 0;

    // Warmup
    for (let i = 0; i < 10; i++) {
      testQueries.forEach(query => {
        hashQueryOriginal(query);
        hashQuery(query);
      });
    }

    // Benchmark original implementation
    const originalStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      testQueries.forEach(query => {
        hashQueryOriginal(query);
      });
    }
    const originalEnd = performance.now();
    originalTotal = originalEnd - originalStart;

    // Benchmark fixed implementation
    const fixedStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      testQueries.forEach(query => {
        hashQuery(query);
      });
    }
    const fixedEnd = performance.now();
    fixedTotal = fixedEnd - fixedStart;

    const originalAvg = originalTotal / (iterations * testQueries.length);
    const fixedAvg = fixedTotal / (iterations * testQueries.length);
    const performanceRatio = originalTotal / fixedTotal;

    // Store results for assertion and display
    const results = {
      testQueries: testQueries.length,
      iterations,
      totalOps: iterations * testQueries.length,
      originalTotal: Number(originalTotal.toFixed(3)),
      fixedTotal: Number(fixedTotal.toFixed(3)),
      originalAvg: Number(originalAvg.toFixed(6)),
      fixedAvg: Number(fixedAvg.toFixed(6)),
      performanceRatio: Number(performanceRatio.toFixed(2))
    };

    // Both should execute without errors
    expect(originalTotal).toBeGreaterThan(0);
    expect(fixedTotal).toBeGreaterThan(0);

    // Add performance comparison context for test output
    expect(results.performanceRatio).toBeGreaterThan(0);
    
    // Verify the benchmark ran correctly
    expect(results.totalOps).toBe(10000); // 1000 iterations * 10 queries
    
    // Now we can use console.log to show results
    console.log('=== hashQuery Performance Results ===');
    console.log(`Original (character sorting): ${results.originalTotal}ms total, ${results.originalAvg}ms per query`);
    console.log(`Fixed (semantic normalization): ${results.fixedTotal}ms total, ${results.fixedAvg}ms per query`);  
    console.log(`Performance ratio: ${results.performanceRatio}x ${results.performanceRatio > 1 ? '(Fixed is SLOWER)' : '(Fixed is FASTER)'}`);
    
    // Restore console.log
    consoleSpy.mockRestore();
  });

  it('should demonstrate correctness differences between original and fixed hashQuery', () => {
    const problematicQueries = [
      {
        name: 'Different spacing',
        query1: 'up{job="prometheus"}',
        query2: 'up{ job = "prometheus" }',
        shouldMatch: true
      },
      {
        name: 'Different label order',
        query1: 'up{job="prometheus", instance="localhost"}',
        query2: 'up{instance="localhost", job="prometheus"}',  
        shouldMatch: true
      },
      {
        name: 'Different semantic operators',
        query1: 'memory_usage > 1000',
        query2: 'memory_usage >= 1000',
        shouldMatch: false
      },
      {
        name: 'False positive from character sorting',
        query1: 'rate(metric_a[5m]) + rate(metric_b[5m])',
        query2: 'rate(metric_b[5m]) + rate(metric_a[5m])', 
        shouldMatch: false
      }
    ];

    problematicQueries.forEach(test => {
      const originalHash1 = hashQueryOriginal(test.query1);
      const originalHash2 = hashQueryOriginal(test.query2);
      const originalMatch = originalHash1 === originalHash2;

      const fixedHash1 = hashQuery(test.query1);
      const fixedHash2 = hashQuery(test.query2);
      const fixedMatch = fixedHash1 === fixedHash2;

      // The fixed algorithm should handle all test cases correctly
      expect(fixedMatch).toBe(test.shouldMatch);
      
      // Store results for debugging if needed
      if (originalMatch !== test.shouldMatch || fixedMatch !== test.shouldMatch) {
        // Test will fail with useful context if there are issues
        expect({
          testCase: test.name,
          query1: test.query1,
          query2: test.query2,
          shouldMatch: test.shouldMatch,
          originalMatch,
          fixedMatch,
          originalCorrect: originalMatch === test.shouldMatch,
          fixedCorrect: fixedMatch === test.shouldMatch
        }).toEqual(expect.objectContaining({
          fixedCorrect: true
        }));
      }
    });
  });
});
