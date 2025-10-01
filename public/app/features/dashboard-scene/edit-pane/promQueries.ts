import { PromQuery } from '@grafana/prometheus';
import { QueryEditorMode } from '@grafana/prometheus/src/querybuilder/shared/types';

const queryMap = new Map<string, PromQuery[]>([
  ['counter', [
    {
      refId: 'A',
      expr: 'rate({{metric_name}}[5m])',
      legendFormat: 'Rate per second',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'B',
      expr: 'increase({{metric_name}}[1h])',
      legendFormat: 'Increase over 1h',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'C',
      expr: 'sum(rate({{metric_name}}[5m]))',
      legendFormat: 'Total rate',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'D',
      expr: 'sum by (instance) (rate({{metric_name}}[5m]))',
      legendFormat: 'Rate by instance',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'E',
      expr: 'irate({{metric_name}}[5m])',
      legendFormat: 'Instantaneous rate',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
  ]],
  ['gauge', [
    {
      refId: 'A',
      expr: '{{metric_name}}',
      legendFormat: 'Current value',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'B',
      expr: 'avg({{metric_name}})',
      legendFormat: 'Average',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'C',
      expr: 'max({{metric_name}})',
      legendFormat: 'Maximum',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'D',
      expr: 'min({{metric_name}})',
      legendFormat: 'Minimum',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'E',
      expr: 'avg_over_time({{metric_name}}[5m])',
      legendFormat: '5m average',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
  ]],
  ['histogram', [
    {
      refId: 'A',
      expr: 'histogram_quantile(0.95, rate({{metric_name}}_bucket[5m]))',
      legendFormat: '95th percentile',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'B',
      expr: 'histogram_quantile(0.50, rate({{metric_name}}_bucket[5m]))',
      legendFormat: '50th percentile (median)',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'C',
      expr: 'rate({{metric_name}}_sum[5m]) / rate({{metric_name}}_count[5m])',
      legendFormat: 'Average',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'D',
      expr: 'rate({{metric_name}}_count[5m])',
      legendFormat: 'Request rate',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
    {
      refId: 'E',
      expr: 'histogram_quantile(0.99, rate({{metric_name}}_bucket[5m]))',
      legendFormat: '99th percentile',
      format: 'time_series',
      editorMode: QueryEditorMode.Code,
    },
  ]],
]);

/**
 * Returns queries for a given metric name and type with the metric name substituted
 * @param metricName - The name of the metric to substitute in the queries
 * @param metricType - The type of metric ('counter', 'gauge', 'histogram')
 * @returns Array of PromQuery objects with the metric name substituted, or empty array if type not found
 */
export function getQueriesForMetric(metricName: string, metricType: string): PromQuery[] {
  const queries = queryMap.get(metricType);
  if (!queries) {
    return [];
  }

  return queries.map((query) => ({
    ...query,
    expr: query.expr.replace(/\{\{metric_name\}\}/g, metricName),
  }));
}

/**
 * Returns all available metric types
 * @returns Array of metric type strings
 */
export function getAvailableMetricTypes(): string[] {
  return Array.from(queryMap.keys());
}
