import { css } from '@emotion/css';
import { useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { useDatasources } from '../../datasources/hooks';
import { SuggestedPanel } from '../utils/utils';

import { MetricSelectorSidePanel } from './MetricSelectorSidePanel';

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
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  const handleOpenSidePanel = () => {
    setIsSidePanelOpen(true);
  };

  const handleCloseSidePanel = () => {
    setIsSidePanelOpen(false);
  };

  const handleMetricSelected = (metric: string) => {
    setSelectedMetric(metric);
  };

  return (
    <div className={styles.container}>
      <div className={styles.selectorButton}>
        <Button
          variant="secondary"
          fill="outline"
          size="md"
          onClick={handleOpenSidePanel}
          className={styles.metricSelectorButton}
        >
          {selectedMetric || t('dashboard-scene.prom-metric-selector.select-metric', 'Select metric')}
        </Button>
      </div>

      <MetricSelectorSidePanel
        isOpen={isSidePanelOpen}
        onClose={handleCloseSidePanel}
        selectedDatasource={effectiveDatasource}
        setPanels={setPanels}
        timeRange={timeRange}
        onMetricSelected={handleMetricSelected}
      />
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
    selectorButton: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    metricSelectorButton: css({
      width: '100%',
      justifyContent: 'flex-start',
      textAlign: 'left',
    }),
  };
}
