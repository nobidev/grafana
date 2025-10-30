import { DataQuery, DataQueryRequest, DataSourceJsonData, TimeRange } from '@grafana/data';

import {
  LokiDataQuery as LokiQueryFromSchema,
  LokiQueryType,
  SupportingQueryType,
  LokiQueryDirection,
} from './dataquery.gen';

export { LokiQueryDirection, LokiQueryType, SupportingQueryType };

export enum LokiResultType {
  Stream = 'streams',
  Vector = 'vector',
  Matrix = 'matrix',
}

export enum LabelType {
  Indexed = 'I',
  StructuredMetadata = 'S',
  Parsed = 'P',
}

export interface LokiQuery extends LokiQueryFromSchema {
  direction?: LokiQueryDirection;
  /** Used only to identify supporting queries, e.g. logs volume, logs sample and data sample */
  supportingQueryType?: SupportingQueryType;
  // CUE autogenerates `queryType` as `?string`, as that's how it is defined
  // in the parent-interface (in DataQuery).
  // the temporary fix (until this gets improved in the codegen), is to
  // override it here
  queryType?: LokiQueryType;
}

export interface LokiOptions extends DataSourceJsonData {
  maxLines?: string;
  derivedFields?: DerivedFieldConfig[];
  alertmanager?: string;
  keepCookies?: string[];
}

export interface LokiStreamResult {
  stream: Record<string, string>;
  values: Array<[string, string]>;
}

export interface LokiTailResponse {
  streams: LokiStreamResult[];
  dropped_entries?: Array<{
    labels: Record<string, string>;
    timestamp: string;
  }> | null;
}

export type DerivedFieldConfig = {
  matcherRegex: string;
  name: string;
  url?: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
  matcherType?: 'label' | 'regex';
  targetBlank?: boolean;
};

export enum LokiVariableQueryType {
  LabelNames,
  LabelValues,
}

export interface LokiVariableQuery extends DataQuery {
  type: LokiVariableQueryType;
  label?: string;
  stream?: string;
}

export interface QueryStats {
  streams: number;
  chunks: number;
  bytes: number;
  entries: number;
  // The error message displayed in the UI when we cant estimate the size of the query.
  message?: string;
}

export interface ContextFilter {
  enabled: boolean;
  label: string;
  value: string;
  nonIndexed: boolean;
}

export interface ParserAndLabelKeysResult {
  extractedLabelKeys: string[];
  structuredMetadataKeys: string[];
  hasJSON: boolean;
  hasLogfmt: boolean;
  hasPack: boolean;
  unwrapLabelKeys: string[];
}

export interface DetectedFieldsResult {
  fields: Array<{
    label: string;
    type: 'bytes' | 'float' | 'int' | 'string' | 'duration';
    cardinality: number;
    parsers: Array<'logfmt' | 'json'> | null;
  }>;
  limit: number;
}

export type LokiGroupedRequest = { request: DataQueryRequest<LokiQuery>; partition: TimeRange[] };

export const LOKI_CONFIG_NOT_SUPPORTED = 'NotSupported';
export type LokiConfigNotSupported = typeof LOKI_CONFIG_NOT_SUPPORTED;
// Note, this is a subset of the full response type
export interface LokiConfigResponse {
  limits: {
    log_level_fields: string[];
    max_entries_limit_per_query: number;
    max_line_size_truncate: boolean;
    /**
     * max_query_bytes_read
     * 0B means no limit
     * valid units are: B, MB, EB, PB, TB, GB, MB, KB
     * https://github.com/grafana/loki/blob/4feca2ef340a3f821037f3bb3539e7865a5cb58a/vendor/github.com/c2h5oh/datasize/datasize.go#L68-L87
     * Examples: 1.1MB, 100.9GB
     */
    max_query_bytes_read: string;
    max_query_length: string;
    max_query_lookback: string;
    max_query_range: string;
    max_query_series: number;
    metric_aggregation_enabled: boolean;
    pattern_persistence_enabled: boolean;
    query_timeout: string;
    retention_period: string;
    volume_enabled: boolean;
    volume_max_series: number;
  };
  version: 'unknown' | string;
}
export interface LokiConfig {
  limits: {
    max_query_bytes_read: number;
  };
}
/**
 * null: haven't received response yet
 * LokiConfigNotSupported: The response was a 404, Loki is likely <3.6
 * LokiConfig: We have valid config
 */
export type LokiConfigState = LokiConfig | LokiConfigNotSupported | null;
