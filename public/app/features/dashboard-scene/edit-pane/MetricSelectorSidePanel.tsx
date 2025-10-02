import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import Highlighter from 'react-highlight-words';

import { DataSourceInstanceSettings, GrafanaTheme2, TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { PrometheusDatasource } from '@grafana/prometheus';
import { METRIC_LABEL } from '@grafana/prometheus/src/constants';
import { formatPrometheusLabelFilters } from '@grafana/prometheus/src/querybuilder/components/formatter';
import { regexifyLabelValuesQueryString } from '@grafana/prometheus/src/querybuilder/parsingUtils';
import { QueryBuilderLabelFilter } from '@grafana/prometheus/src/querybuilder/shared/types';
import { getDataSourceSrv } from '@grafana/runtime';
import { Card, Drawer, Input, ScrollContainer, TagsInput, useStyles2 } from '@grafana/ui';

import { SuggestedPanel } from '../utils/utils';

import { findMetadataForMetric, getQueriesForMetric } from './promQueries';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedDatasource?: DataSourceInstanceSettings | undefined;
  setPanels: (panels: SuggestedPanel[]) => void;
  timeRange: TimeRange;
  onMetricSelected: (metric: string) => void;
};

export function MetricSelectorSidePanel({
  isOpen,
  onClose,
  selectedDatasource,
  setPanels,
  timeRange,
  onMetricSelected,
}: Props) {
  const styles = useStyles2(getStyles);

  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [datasourceInstance, setDatasourceInstance] = useState<PrometheusDatasource | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metrics, setMetrics] = useState<string[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<string[]>([]);
  const [labelFilters, setLabelFilters] = useState<string[]>([]);
  const [metricSearchTerm, setMetricSearchTerm] = useState('');
  
  // Ref for the metric search input to focus on it when drawer opens
  const metricSearchInputRef = useRef<HTMLInputElement>(null);

  const fetchMetrics = useCallback(
    async (promDs: PrometheusDatasource, filters: QueryBuilderLabelFilter[]) => {
      setIsLoadingMetrics(true);
      try {
        const filterArray = filters.length > 0 ? formatPrometheusLabelFilters(filters) : [];
        const match = filterArray.length > 0 ? `{${filterArray.join('').substring(1)}}` : undefined;

        const metricNames = await promDs.languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match, 500);

        setMetrics(metricNames);
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
    if (!selectedDatasource?.uid || !isOpen) {
      return;
    }

    let isCancelled = false;

    const initializeDatasource = async () => {
      setIsMetadataLoading(true);
      setIsMetadataLoaded(false);
      setDatasourceInstance(null);

      try {
        const ds = await getDataSourceSrv().get(selectedDatasource.uid);
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
  }, [selectedDatasource?.uid, fetchMetrics, isOpen]);

  // Focus on metric search input when drawer opens and input is enabled
  useEffect(() => {
    if (isOpen && isMetadataLoaded && metricSearchInputRef.current) {
      // Use a small timeout to ensure the drawer animation is complete
      const timeoutId = setTimeout(() => {
        metricSearchInputRef.current?.focus();
      }, 150);
      
      return () => clearTimeout(timeoutId);
    }
    
    return undefined;
  }, [isOpen, isMetadataLoaded]);

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
      onMetricSelected(metric);

      if (metric && datasourceInstance) {
        const metricMetadata = datasourceInstance.languageProvider.retrieveMetricsMetadata();
        const suggestedPanels = getQueriesForMetric(metric, metricMetadata);
        setPanels(suggestedPanels);
      } else {
        setPanels([]);
      }

      // Close the side panel after selection
      onClose();
    },
    [datasourceInstance, setPanels, onMetricSelected, onClose]
  );

  const handleLabelFiltersChange = useCallback((filters: string[]) => {
    setLabelFilters(filters);
  }, []);

  const handleMetricSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setMetricSearchTerm(event.target.value);
  }, []);

  const formatMetricDescription = useCallback(
    (metric: string) => {
      if (!datasourceInstance) {
        return '';
      }

      const metadata = findMetadataForMetric(metric, datasourceInstance.languageProvider.retrieveMetricsMetadata());
      if (!metadata) {
        return '';
      }

      const type = metadata.type || 'unknown';
      const description = metadata.help || 'No description available';

      return `${type} | ${description}`;
    },
    [datasourceInstance]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Drawer
      title={t('dashboard-scene.metric-selector-side-panel.title', 'Select Metric')}
      subtitle={selectedDatasource?.name}
      onClose={onClose}
      size="md"
      scrollableContent={false}
    >
      <div className={styles.container}>
        <div className={styles.filtersSection}>
          <div className={styles.sectionTitle}>
            <Trans i18nKey="dashboard-scene.metric-selector-side-panel.label-filters">Label Filters</Trans>
          </div>
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
          <div className={styles.sectionTitle}>
            <Trans i18nKey="dashboard-scene.metric-selector-side-panel.metric-search">Metric Search</Trans>
          </div>
          <Input
            ref={metricSearchInputRef}
            placeholder={
              isMetadataLoading
                ? t('dashboard-scene.prom-metric-selector.loading-metrics', 'Loading metrics...')
                : t('dashboard-scene.prom-metric-selector.search-metrics', 'Search metrics...')
            }
            value={metricSearchTerm}
            onChange={handleMetricSearchChange}
            disabled={!isMetadataLoaded}
          />
        </div>

        <div className={styles.metricsSection}>
          <div className={styles.sectionTitle}>
            <Trans i18nKey="dashboard-scene.metric-selector-side-panel.available-metrics">Available Metrics</Trans>(
            {filteredMetrics.length})
          </div>
          <div className={styles.metricsContainer}>
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
              <ScrollContainer>
                <div className={styles.metricsList}>
                  {filteredMetrics.map((metric) => (
                    <Card
                      key={metric}
                      noMargin
                      className={`${styles.metricCard} ${selectedMetric === metric ? styles.selectedMetric : ''}`}
                      onClick={() => handleMetricSelection(metric)}
                    >
                      <Card.Heading>
                        <Highlighter
                          textToHighlight={metric}
                          searchWords={[metricSearchTerm]}
                          autoEscape
                          highlightClassName={styles.matchHighLight}
                        />
                      </Card.Heading>
                      <Card.Description>{formatMetricDescription(metric)}</Card.Description>
                    </Card>
                  ))}
                </div>
              </ScrollContainer>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
      padding: theme.spacing(2),
      height: '100%',
      maxHeight: '100vh',
      overflow: 'hidden',
    }),
    filtersSection: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    searchSection: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    metricsSection: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      flex: 1,
      minHeight: 0,
    }),
    sectionTitle: css({
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.primary,
    }),
    metricsContainer: css({
      flex: 1,
      minHeight: 0,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
    }),
    metricsList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1),
      width: '100%',
      boxSizing: 'border-box',
    }),
    metricCard: css({
      overflow: 'hidden',
    }),
    selectedMetric: css({
      backgroundColor: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.colors.primary.shade,
      },
    }),
    loadingMessage: css({
      textAlign: 'center',
      padding: theme.spacing(3),
      color: theme.colors.text.secondary,
    }),
    emptyMessage: css({
      textAlign: 'center',
      padding: theme.spacing(3),
      color: theme.colors.text.secondary,
    }),
    matchHighLight: css({
      background: 'inherit',
      color: theme.components.textHighlight.text,
      backgroundColor: theme.components.textHighlight.background,
    }),
  };
}
