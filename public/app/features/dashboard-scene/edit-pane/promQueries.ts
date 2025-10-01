import { SuggestedPanel } from '../utils/utils';

// Define the metadata types locally to avoid importing from grafana-prometheus
interface PromMetricsMetadataItem {
  type: string;
  help: string;
  unit?: string;
}

interface PromMetricsMetadata {
  [metric: string]: PromMetricsMetadataItem;
}

const queryMap = new Map<string, SuggestedPanel[]>([
  [
    'counter',
    [
      {
        type: 'prometheus-query',
        name: 'Rate per second',
        targets: [
          {
            refId: 'A',
            expr: 'rate({{metric_name}}[5m])',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Increase over 1h',
        targets: [
          {
            refId: 'B',
            expr: 'increase({{metric_name}}[1h])',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Total rate',
        targets: [
          {
            refId: 'C',
            expr: 'sum(rate({{metric_name}}[5m]))',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Rate by instance',
        targets: [
          {
            refId: 'D',
            expr: 'sum by (instance) (rate({{metric_name}}[5m]))',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Instantaneous rate',
        targets: [
          {
            refId: 'E',
            expr: 'irate({{metric_name}}[5m])',
            format: 'time_series',
          },
        ],
      },
    ],
  ],
  [
    'gauge',
    [
      {
        type: 'prometheus-query',
        name: 'Current value',
        targets: [
          {
            refId: 'A',
            expr: '{{metric_name}}',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Average',
        targets: [
          {
            refId: 'B',
            expr: 'avg({{metric_name}})',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Maximum',
        targets: [
          {
            refId: 'C',
            expr: 'max({{metric_name}})',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Minimum',
        targets: [
          {
            refId: 'D',
            expr: 'min({{metric_name}})',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: '5m average',
        targets: [
          {
            refId: 'E',
            expr: 'avg_over_time({{metric_name}}[5m])',
            format: 'time_series',
          },
        ],
      },
    ],
  ],
  [
    'histogram',
    [
      {
        type: 'prometheus-query',
        name: '95th percentile',
        targets: [
          {
            refId: 'A',
            expr: 'histogram_quantile(0.95, rate({{metric_name}}_bucket[5m]))',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: '50th percentile (median)',
        targets: [
          {
            refId: 'B',
            expr: 'histogram_quantile(0.50, rate({{metric_name}}_bucket[5m]))',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Average',
        targets: [
          {
            refId: 'C',
            expr: 'rate({{metric_name}}_sum[5m]) / rate({{metric_name}}_count[5m])',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Request rate',
        targets: [
          {
            refId: 'D',
            expr: 'rate({{metric_name}}_count[5m])',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: '99th percentile',
        targets: [
          {
            refId: 'E',
            expr: 'histogram_quantile(0.99, rate({{metric_name}}_bucket[5m]))',
            format: 'time_series',
          },
        ],
      },
    ],
  ],
  [
    'summary',
    [
      {
        type: 'prometheus-query',
        name: 'Average',
        targets: [
          {
            refId: 'A',
            expr: 'rate({{metric_name}}_sum[5m]) / rate({{metric_name}}_count[5m])',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Rate',
        targets: [
          {
            refId: 'B',
            expr: 'rate({{metric_name}}_count[5m])',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Total sum',
        targets: [
          {
            refId: 'C',
            expr: '{{metric_name}}_sum',
            format: 'time_series',
          },
        ],
      },
      {
        type: 'prometheus-query',
        name: 'Total count',
        targets: [
          {
            refId: 'D',
            expr: '{{metric_name}}_count',
            format: 'time_series',
          },
        ],
      },
    ],
  ],
]);

/**
 * Common Prometheus metric suffixes that are automatically added based on metric type
 * Ordered by specificity - more specific suffixes first to avoid incorrect matches
 */
const PROMETHEUS_SUFFIXES = [
  // Histogram/Summary suffixes (these are always auto-generated)
  '_bucket',
  '_count',
  '_sum',

  // Counter suffixes (these are always auto-generated)
  '_total',

  // Unit suffixes (only common patterns that are likely auto-generated)
  '_seconds_total', // e.g., cpu_seconds_total
  '_bytes_total', // e.g., bytes_total
  '_milliseconds', // duration metrics
  '_seconds', // duration metrics
  '_bytes', // size metrics
];

/**
 * Finds metadata for a metric name by checking the exact name first, then trying without common suffixes
 * @param metricName - The actual metric name from time series (e.g., 'http_requests_total')
 * @param metricsMetadata - The metadata object containing metric information
 * @returns The metadata item if found, undefined otherwise
 */
function findMetadataForMetric(
  metricName: string,
  metricsMetadata: PromMetricsMetadata
): PromMetricsMetadataItem | undefined {
  // First try exact match
  if (metricsMetadata[metricName]) {
    return metricsMetadata[metricName];
  }

  // Try removing common Prometheus suffixes to find the base metric
  for (const suffix of PROMETHEUS_SUFFIXES) {
    if (metricName.endsWith(suffix)) {
      const baseMetricName = metricName.slice(0, -suffix.length);
      if (metricsMetadata[baseMetricName]) {
        return metricsMetadata[baseMetricName];
      }
    }
  }

  return undefined;
}

/**
 * Returns queries for a given metric name with the metric name substituted
 * @param metricName - The name of the metric to substitute in the queries
 * @param metricsMetadata - The metadata object containing metric information
 * @returns Array of SuggestedPanel objects with the metric name substituted, or empty array if type not found
 */
export function getQueriesForMetric(metricName: string, metricsMetadata: PromMetricsMetadata): SuggestedPanel[] {
  const metadata = findMetadataForMetric(metricName, metricsMetadata);
  if (!metadata) {
    return [];
  }

  const panels = queryMap.get(metadata.type);
  if (!panels) {
    return [];
  }

  return panels.map((panel) => ({
    ...panel,
    name: `${metricName} - ${panel.name}`,
    targets: panel.targets.map((target) => ({
      ...target,
      expr: target.expr.replace(/\{\{metric_name\}\}/g, metricName),
    })),
  }));
}

/**
 * Returns all available metric types
 * @returns Array of metric type strings
 */
export function getAvailableMetricTypes(): string[] {
  return Array.from(queryMap.keys());
}

// Export the helper function for testing purposes
export { findMetadataForMetric };
