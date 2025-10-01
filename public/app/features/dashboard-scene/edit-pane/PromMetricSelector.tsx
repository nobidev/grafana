import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2, TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { PrometheusDatasource } from '@grafana/prometheus';
import { METRIC_LABEL } from '@grafana/prometheus/src/constants';
import { formatPrometheusLabelFilters } from '@grafana/prometheus/src/querybuilder/components/formatter';
import { regexifyLabelValuesQueryString } from '@grafana/prometheus/src/querybuilder/parsingUtils';
import { QueryBuilderLabelFilter } from '@grafana/prometheus/src/querybuilder/shared/types';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, ClickOutsideWrapper, Input, ScrollContainer, TagsInput, useStyles2 } from '@grafana/ui';

import { useDatasources } from '../../datasources/hooks';
import { SuggestedPanel } from '../utils/utils';

import { getQueriesForMetric } from './promQueries';

type Props = {
  selectedDatasource?: DataSourceInstanceSettings | undefined;
  setPanels: (panels: SuggestedPanel[]) => void;
  timeRange: TimeRange;
};

export function PromMetricSelector({ selectedDatasource, setPanels, timeRange }: Props) {
  const styles = useStyles2(getStyles);

  const promDsInstances = useDatasources({
    dashboard: false,
    mixed: false,
    all: true,
    type: 'prometheus',
    // FIXME only for development purposes. Don't commit
    filter: (ds) => ds.uid === 'zxS5e5W4k',
  });

  const effectiveDatasource = selectedDatasource || promDsInstances[0];

  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [datasourceInstance, setDatasourceInstance] = useState<PrometheusDatasource | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<string[]>([]);
  const [labelFilters, setLabelFilters] = useState<string[]>([]);
  const [metricSearchTerm, setMetricSearchTerm] = useState('');
  const [showMetricsList, setShowMetricsList] = useState(false);

  const fetchMetrics = useCallback(
    async (promDs: PrometheusDatasource, filters: QueryBuilderLabelFilter[]) => {
      setIsLoadingMetrics(true);
      try {
        const filterArray = filters.length > 0 ? formatPrometheusLabelFilters(filters) : [];
        const match = filterArray.length > 0 ? `{${filterArray.join('').substring(1)}}` : undefined;

        const metricNames = await promDs.languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match, 500);
        // Limit to first 500 metrics for performance
        const limitedMetrics = metricNames.slice(0, 500);

        setMetrics(limitedMetrics);
        setIsLoadingMetrics(false);
      } catch (error) {
        console.error('Error loading metrics:', error);
        setMetrics([]);
        setIsLoadingMetrics(false);
      }
    },
    [timeRange]
  );

  // Initialize datasource instance when component mounts or effective datasource changes
  useEffect(() => {
    if (!effectiveDatasource?.uid) {
      return;
    }

    let isCancelled = false;

    const initializeDatasource = async () => {
      setIsMetadataLoading(true);
      setIsMetadataLoaded(false);
      setDatasourceInstance(null);

      try {
        const ds = await getDataSourceSrv().get(effectiveDatasource.uid);
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const promDs = ds as PrometheusDatasource;

        if (isCancelled) {
          return;
        }

        setDatasourceInstance(promDs);

        // Fetch metadata immediately after setting datasource instance
        await promDs.languageProvider.queryMetricsMetadata(100000);

        if (isCancelled) {
          return;
        }

        setIsMetadataLoaded(true);
        setIsMetadataLoading(false);

        // Fetch initial metrics after metadata is loaded
        fetchMetrics(promDs, []);
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to get datasource instance or metadata:', error);
          setDatasourceInstance(null);
          setIsMetadataLoading(false);
          setIsMetadataLoaded(false);
        }
      }
    };

    initializeDatasource();

    return () => {
      isCancelled = true;
    };
  }, [effectiveDatasource?.uid, fetchMetrics]);

  // Parse label filter strings like "instance=my-instance" into QueryBuilderLabelFilter objects
  const parseLabelFilters = useCallback((filterStrings: string[]): QueryBuilderLabelFilter[] => {
    const validOperators: string[] = ['=', '!=', '=~', '!~'] as const;

    return filterStrings
      .map((filterStr) => {
        // Match patterns like: label=value, label="value", label=~"regex", etc.
        const match = filterStr.match(/^([^=!~]+)(=~?|!=|!~)(.+)$/);
        if (match) {
          const [, label, op, value] = match;
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '');

          if (validOperators.includes(op)) {
            return { label: label.trim(), op, value: cleanValue };
          }
        }
        // Default to equality if no operator found
        const [label, ...valueParts] = filterStr.split('=');
        return { label: label.trim(), op: '=', value: valueParts.join('=').replace(/^["']|["']$/g, '') };
      })
      .filter((filter) => filter.label && filter.value);
  }, []);

  // Filter metrics based on search term
  useEffect(() => {
    if (!metricSearchTerm.trim()) {
      setFilteredMetrics(metrics);
      return;
    }

    const searchRegex = new RegExp(regexifyLabelValuesQueryString(metricSearchTerm), 'i');
    const filtered = metrics.filter((metric) => searchRegex.test(metric));
    setFilteredMetrics(filtered);
  }, [metrics, metricSearchTerm]);

  // Refetch metrics when label filters change
  useEffect(() => {
    if (datasourceInstance && isMetadataLoaded) {
      const filters = parseLabelFilters(labelFilters);
      fetchMetrics(datasourceInstance, filters);
    }
  }, [datasourceInstance, fetchMetrics, isMetadataLoaded, labelFilters, parseLabelFilters, timeRange]);

  const handleMetricSelection = useCallback(
    (metric: string) => {
      setSelectedMetric(metric);
      setMetricSearchTerm(metric); // Set the input value to the selected metric
      setShowMetricsList(false); // Hide the metrics list

      if (metric && datasourceInstance) {
        const metricMetadata = datasourceInstance.languageProvider.retrieveMetricsMetadata();
        const suggestedPanels = getQueriesForMetric(metric, metricMetadata);
        setPanels(suggestedPanels);
      } else {
        setPanels([]);
      }
    },
    [datasourceInstance, setPanels]
  );

  const handleLabelFiltersChange = useCallback((filters: string[]) => {
    setLabelFilters(filters);
  }, []);

  const handleMetricSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setMetricSearchTerm(event.target.value);
      if (!showMetricsList) {
        setShowMetricsList(true); // Show metrics list when typing
      }
    },
    [showMetricsList]
  );

  const handleInputFocus = useCallback(() => {
    setShowMetricsList(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    // Hide the list when input loses focus
    setShowMetricsList(false);
  }, []);

  const handleClickOutside = useCallback(() => {
    setShowMetricsList(false);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.filtersSection}>
        <TagsInput
          placeholder={t(
            'dashboard-scene.prom-metric-selector.placeholder-add-label-filters-eg-instancemyinstance',
            'Add label filters (e.g., instance=my-instance)'
          )}
          tags={labelFilters}
          onChange={handleLabelFiltersChange}
          disabled={!isMetadataLoaded}
          autoColors={false}
        />
      </div>

      <div className={styles.searchSection}>
        <ClickOutsideWrapper onClick={handleClickOutside}>
          <div className={styles.inputContainer}>
            <Input
              placeholder={
                isMetadataLoading
                  ? t('dashboard-scene.prom-metric-selector.loading-metrics', 'Loading metrics...')
                  : t('dashboard-scene.prom-metric-selector.click-to-search-metrics', 'Click to search metrics...')
              }
              value={metricSearchTerm}
              onChange={handleMetricSearchChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={!isMetadataLoaded}
            />

            {showMetricsList && (
              <div className={styles.metricsDropdown}>
                <ScrollContainer height={300}>
                  {isLoadingMetrics ? (
                    <div className={styles.loadingMessage}>
                      <Trans i18nKey="dashboard-scene.prom-metric-selector.loading-metrics">Loading metrics...</Trans>
                    </div>
                  ) : filteredMetrics.length === 0 ? (
                    <div className={styles.emptyMessage}>
                      {metricSearchTerm || labelFilters.length > 0 ? (
                        <Trans i18nKey="dashboard-scene.prom-metric-selector.no-metrics-found-matching-criteria">
                          No metrics found matching your criteria
                        </Trans>
                      ) : (
                        <Trans i18nKey="dashboard-scene.prom-metric-selector.no-metrics-available">
                          No metrics available
                        </Trans>
                      )}
                    </div>
                  ) : (
                    <div className={styles.metricsList}>
                      {filteredMetrics.map((metric) => (
                        <Button
                          key={metric}
                          variant={selectedMetric === metric ? 'primary' : 'secondary'}
                          fill="text"
                          className={styles.metricItem}
                          onClick={() => handleMetricSelection(metric)}
                          onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                        >
                          {metric}
                        </Button>
                      ))}
                    </div>
                  )}
                </ScrollContainer>
              </div>
            )}
          </div>
        </ClickOutsideWrapper>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      margin: theme.spacing(1),
    }),
    filtersSection: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    searchSection: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    inputContainer: css({
      position: 'relative',
    }),
    metricsDropdown: css({
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 1000,
      backgroundColor: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      marginTop: theme.spacing(0.5),
    }),
    metricsList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1),
    }),
    metricItem: css({
      width: '100%',
      justifyContent: 'flex-start',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      '&:last-child': {
        borderBottom: 'none',
      },
    }),
    loadingMessage: css({
      textAlign: 'center',
      padding: theme.spacing(2),
      color: theme.colors.text.secondary,
    }),
    emptyMessage: css({
      textAlign: 'center',
      padding: theme.spacing(2),
      color: theme.colors.text.secondary,
    }),
  };
}
