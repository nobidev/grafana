import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import { useEffect, useMemo, useState } from 'react';

import { DataSourceInstanceSettings, getDefaultTimeRange, GrafanaTheme2 } from '@grafana/data';
import { PrometheusDatasource } from '@grafana/prometheus';
import { METRIC_LABEL } from '@grafana/prometheus/src/constants';
import { formatPrometheusLabelFilters } from '@grafana/prometheus/src/querybuilder/components/formatter';
import { regexifyLabelValuesQueryString } from '@grafana/prometheus/src/querybuilder/parsingUtils';
import { getDataSourceSrv } from '@grafana/runtime';
import { Card, Icon, Input, useStyles2 } from '@grafana/ui';

import { useDatasources } from '../../datasources/hooks';
import { SuggestedPanel } from '../utils/utils';

import { getQueriesForMetric } from './promQueries';

type Props = {
  selectedDatasource?: DataSourceInstanceSettings | undefined;
  setPanels: (panels: SuggestedPanel[]) => void;
};

export function PromMetricSelector({ selectedDatasource }: Props) {
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

  const [searchText, setSearchText] = useState('');
  const [datasourceInstance, setDatasourceInstance] = useState<PrometheusDatasource | null>(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);

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
          return promDs.languageProvider.queryMetricsMetadata(100000);
        })
        .then(() => {
          setIsMetadataLoaded(true);
          setIsMetadataLoading(false);
        })
        .catch((error) => {
          console.error('Failed to get datasource instance or metadata:', error);
          setDatasourceInstance(null);
          setIsMetadataLoading(false);
          setIsMetadataLoaded(false);
        });
    }
  }, [selectedDatasource?.uid]);

  const handleMetricSearchChange = (text: string) => {
    setSearchText(text);
    debouncedBackendSearch(text);
  };

  const debouncedBackendSearch = useMemo(
    () =>
      debounce(async (text: string) => {
        if (!datasourceInstance || !isMetadataLoaded) {
          console.warn('Datasource instance or metadata not available for search');
          return;
        }

        // FIXME use the dashboard's timerange
        const timeRange = getDefaultTimeRange();
        const queryString = regexifyLabelValuesQueryString(text);
        // FIXME when we have label filters use this
        const queryLabels = undefined;
        const filterArray = queryLabels ? formatPrometheusLabelFilters(queryLabels) : [];
        const match = `{__name__=~"(?i).*${queryString}"${filterArray ? filterArray.join('') : ''}}`;

        try {
          const metrics = await datasourceInstance.languageProvider.queryLabelValues(timeRange, METRIC_LABEL, match);
          const metricMetadata = datasourceInstance.languageProvider.retrieveMetricsMetadata();
          const suggestedPanels = metrics.map((m) => getQueriesForMetric(m, metricMetadata));
          console.log(suggestedPanels);
        } catch (error) {
          console.error('Error during metric search:', error);
        }
      }, 300),
    [datasourceInstance, isMetadataLoaded]
  );

  return (
    <>
      <div className={styles.metricSelector}>
        <Input
          prefix={<Icon name="search" />}
          onChange={(e) => handleMetricSearchChange(e.currentTarget.value)}
          value={searchText}
          disabled={!isMetadataLoaded}
          placeholder={isMetadataLoading ? 'Loading metrics...' : 'Search metrics...'}
        />

        <Card noMargin isCompact>
          <Card.Heading>http_requests_total</Card.Heading>
          <Card.Description>counter | Total number of HTTP requests received</Card.Description>
        </Card>
        <Card noMargin isCompact>
          <Card.Heading>http_requests_total</Card.Heading>
          <Card.Description>counter | Total number of HTTP requests received</Card.Description>
        </Card>
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
