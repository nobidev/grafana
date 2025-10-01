import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2, TimeRange } from '@grafana/data';
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
  timeRange: TimeRange;
};

export function PromMetricSelector({ selectedDatasource, setPanels, timeRange }: Props) {
  const styles = useStyles2(getStyles);

  const promDsInstances = useDatasources({
    dashboard: false,
    mixed: false,
    all: true,
    type: 'prometheus',
    filter: selectedDatasource ? (ds) => ds.uid === selectedDatasource.uid : undefined,
  });

  const effectiveDatasource = selectedDatasource || promDsInstances[0];

  const [selectedMetric, setSelectedMetric] = useState<ComboboxOption | null>(null);
  const [datasourceInstance, setDatasourceInstance] = useState<PrometheusDatasource | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [initialMetrics, setInitialMetrics] = useState<ComboboxOption[]>([]);
  const [isLoadingInitialMetrics, setIsLoadingInitialMetrics] = useState(false);

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
        fetchInitialMetrics(promDs);
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
  }, [effectiveDatasource?.uid]);

  const fetchInitialMetrics = async (promDs: PrometheusDatasource) => {
    setIsLoadingInitialMetrics(true);
    try {
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
