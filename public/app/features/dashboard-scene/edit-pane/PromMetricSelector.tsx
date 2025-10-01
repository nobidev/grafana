import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { DataSourceInstanceSettings, getDefaultTimeRange, GrafanaTheme2 } from '@grafana/data';
import { PrometheusDatasource } from '@grafana/prometheus';
import { METRIC_LABEL } from '@grafana/prometheus/src/constants';
import { formatPrometheusLabelFilters } from '@grafana/prometheus/src/querybuilder/components/formatter';
import { regexifyLabelValuesQueryString } from '@grafana/prometheus/src/querybuilder/parsingUtils';
import { getDataSourceSrv } from '@grafana/runtime';
import { Combobox, ComboboxOption, useStyles2 } from '@grafana/ui';

import { useDatasources } from '../../datasources/hooks';
import { SuggestedPanel } from '../utils/utils';

import { getQueriesForMetric } from './promQueries';

type Props = {
  selectedDatasource?: DataSourceInstanceSettings | undefined;
  setPanels: (panels: SuggestedPanel[]) => void;
};

export function PromMetricSelector({ selectedDatasource, setPanels }: Props) {
  const styles = useStyles2(getStyles);

  const preselectedDs = useDatasources({
    dashboard: false,
    mixed: false,
    all: true,
    type: 'prometheus',
    filter: (ds) => ds.uid === 'zxS5e5W4k',
  })[0];

  if (!selectedDatasource) {
    selectedDatasource = preselectedDs;
  }

  const [selectedMetric, setSelectedMetric] = useState<ComboboxOption | null>(null);
  const [datasourceInstance, setDatasourceInstance] = useState<PrometheusDatasource | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [initialMetrics, setInitialMetrics] = useState<ComboboxOption[]>([]);
  const [isLoadingInitialMetrics, setIsLoadingInitialMetrics] = useState(false);

  // Initialize datasource instance when component mounts or selectedDatasource changes
  useEffect(() => {
    if (selectedDatasource?.uid) {
      setIsMetadataLoading(true);
      setIsMetadataLoaded(false);
      setDatasourceInstance(null);

      getDataSourceSrv()
        .get(selectedDatasource.uid)
        .then((ds) => {
          const promDs = ds as PrometheusDatasource;
          setDatasourceInstance(promDs);

          // Fetch metadata immediately after setting datasource instance
          // limit = 0 means fetch all without limit
          return promDs.languageProvider.queryMetricsMetadata(100000).then(() => promDs);
        })
        .then((promDs) => {
          setIsMetadataLoaded(true);
          setIsMetadataLoading(false);
          // Fetch initial metrics after metadata is loaded
          fetchInitialMetrics(promDs);
        })
        .catch((error) => {
          console.error('Failed to get datasource instance or metadata:', error);
          setDatasourceInstance(null);
          setIsMetadataLoading(false);
          setIsMetadataLoaded(false);
        });
    }
  }, [selectedDatasource?.uid]);

  const fetchInitialMetrics = async (promDs: PrometheusDatasource) => {
    setIsLoadingInitialMetrics(true);
    try {
      // FIXME use the dashboard's timerange
      const timeRange = getDefaultTimeRange();
      const metrics = await promDs.languageProvider.queryLabelValues(timeRange, METRIC_LABEL, undefined, 500);
      // Limit to first 500 metrics for performance
      const limitedMetrics = metrics.slice(0, 500);
      const options = limitedMetrics.map((metric) => ({
        label: metric,
        value: metric,
      }));

      setInitialMetrics(options);
      setIsLoadingInitialMetrics(false);
    } catch (error) {
      console.error('Error loading initial metrics:', error);
      setInitialMetrics([]);
      setIsLoadingInitialMetrics(false);
    }
  };

  const loadMetricOptions = async (inputValue: string): Promise<ComboboxOption[]> => {
    if (!datasourceInstance || !isMetadataLoaded) {
      return [];
    }

    // If no input, return initial metrics
    if (!inputValue.trim()) {
      return initialMetrics;
    }

    setIsLoadingOptions(true);
    try {
      // FIXME use the dashboard's timerange
      const timeRange = getDefaultTimeRange();
      const queryString = regexifyLabelValuesQueryString(inputValue);
      // FIXME when we have label filters use this
      const queryLabels = undefined;
      const filterArray = queryLabels ? formatPrometheusLabelFilters(queryLabels) : [];
      const match = `{__name__=~"(?i).*${queryString}"${filterArray ? filterArray.join('') : ''}}`;

      const metrics = await datasourceInstance.languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match);
      const options = metrics.map((metric) => ({
        label: metric,
        value: metric,
      }));

      setIsLoadingOptions(false);
      return options;
    } catch (error) {
      console.error('Error loading metric options:', error);
      setIsLoadingOptions(false);
      return [];
    }
  };

  const handleMetricSelection = (option: ComboboxOption | null) => {
    setSelectedMetric(option);

    if (option && datasourceInstance) {
      const metricMetadata = datasourceInstance.languageProvider.retrieveMetricsMetadata();
      const suggestedPanels = getQueriesForMetric(option.value, metricMetadata);
      setPanels(suggestedPanels);
    } else {
      setPanels([]);
    }
  };

  return (
    <>
      <div className={styles.metricSelector}>
        <Combobox
          options={loadMetricOptions}
          value={selectedMetric}
          onChange={handleMetricSelection}
          placeholder={
            isMetadataLoading || isLoadingInitialMetrics ? 'Loading metrics...' : 'Search and select a metric...'
          }
          disabled={!isMetadataLoaded}
          loading={isLoadingOptions || isLoadingInitialMetrics}
        />
      </div>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    selectorWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      margin: theme.spacing(1),
    }),
    metricSelector: css({
      display: 'flex',
      flexDirection: 'column',
      margin: theme.spacing(1),
    }),
    metricButton: css({
      textAlign: 'left',
    }),
  };
}
