import { getQueriesForMetric, findMetadataForMetric } from './promQueries';

describe('promQueries', () => {
  const mockMetadata = {
    'http_request_duration': {
      type: 'histogram',
      help: 'Duration of HTTP requests',
    },
    'http_request_duration_bucket': {
      type: 'counter',
      help: 'Cumulative counters for the observation buckets (Duration of HTTP requests)',
    },
    'http_request_duration_count': {
      type: 'counter',
      help: 'Count of events that have been observed for the histogram metric (Duration of HTTP requests)',
    },
    'http_request_duration_sum': {
      type: 'counter',
      help: 'Total sum of all observed values for the histogram metric (Duration of HTTP requests)',
    },
    'cpu_usage': {
      type: 'gauge',
      help: 'CPU usage percentage',
    },
    'requests_total': {
      type: 'counter',
      help: 'Total number of requests',
    },
  };

  describe('findMetadataForMetric', () => {
    it('should return histogram metadata for _bucket suffix', () => {
      const result = findMetadataForMetric('http_request_duration_bucket', mockMetadata);
      expect(result?.type).toBe('histogram');
      expect(result?.help).toBe('Duration of HTTP requests');
    });

    it('should return histogram metadata for _count suffix', () => {
      const result = findMetadataForMetric('http_request_duration_count', mockMetadata);
      expect(result?.type).toBe('histogram');
      expect(result?.help).toBe('Duration of HTTP requests');
    });

    it('should return histogram metadata for _sum suffix', () => {
      const result = findMetadataForMetric('http_request_duration_sum', mockMetadata);
      expect(result?.type).toBe('histogram');
      expect(result?.help).toBe('Duration of HTTP requests');
    });

    it('should return exact match for non-histogram metrics', () => {
      const result = findMetadataForMetric('cpu_usage', mockMetadata);
      expect(result?.type).toBe('gauge');
      expect(result?.help).toBe('CPU usage percentage');
    });

    it('should return counter metadata for counter metrics', () => {
      const result = findMetadataForMetric('requests_total', mockMetadata);
      expect(result?.type).toBe('counter');
      expect(result?.help).toBe('Total number of requests');
    });

    it('should return undefined for non-existent metrics', () => {
      const result = findMetadataForMetric('non_existent_metric', mockMetadata);
      expect(result).toBeUndefined();
    });
  });

  describe('getQueriesForMetric', () => {
    it('should return histogram queries for _bucket suffix metrics', () => {
      const result = getQueriesForMetric('http_request_duration_bucket', mockMetadata);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that we get histogram-specific queries
      const percentileQuery = result.find(panel => panel.name === '95th percentile');
      expect(percentileQuery).toBeDefined();
      expect(percentileQuery?.targets[0].expr).toBe('histogram_quantile(0.95, rate(http_request_duration_bucket[5m]))');
    });

    it('should return histogram queries for _count suffix metrics', () => {
      const result = getQueriesForMetric('http_request_duration_count', mockMetadata);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that we get histogram-specific queries with base metric name
      const percentileQuery = result.find(panel => panel.name === '95th percentile');
      expect(percentileQuery).toBeDefined();
      expect(percentileQuery?.targets[0].expr).toBe('histogram_quantile(0.95, rate(http_request_duration_bucket[5m]))');
    });

    it('should return histogram queries for _sum suffix metrics', () => {
      const result = getQueriesForMetric('http_request_duration_sum', mockMetadata);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that we get histogram-specific queries with base metric name
      const averageQuery = result.find(panel => panel.name === 'Average');
      expect(averageQuery).toBeDefined();
      expect(averageQuery?.targets[0].expr).toBe('rate(http_request_duration_sum[5m]) / rate(http_request_duration_count[5m])');
    });

    it('should return gauge queries for gauge metrics', () => {
      const result = getQueriesForMetric('cpu_usage', mockMetadata);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that we get gauge-specific queries
      const currentValueQuery = result.find(panel => panel.name === 'Current value');
      expect(currentValueQuery).toBeDefined();
      expect(currentValueQuery?.targets[0].expr).toBe('cpu_usage');
    });

    it('should return counter queries for counter metrics', () => {
      const result = getQueriesForMetric('requests_total', mockMetadata);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that we get counter-specific queries
      const rateQuery = result.find(panel => panel.name === 'Rate per second');
      expect(rateQuery).toBeDefined();
      expect(rateQuery?.targets[0].expr).toBe('rate(requests_total[5m])');
    });

    it('should return empty array for non-existent metrics', () => {
      const result = getQueriesForMetric('non_existent_metric', mockMetadata);
      expect(result).toEqual([]);
    });
  });
});
