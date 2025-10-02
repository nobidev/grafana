import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PrometheusDatasource } from '@grafana/prometheus';
import { Button, Field, useStyles2 } from '@grafana/ui';

import { SuggestedPanel } from '../utils/utils';

import { MetricSelectorSidePanel } from './MetricSelectorSidePanel';

type Props = {
  datasourceInstance: PrometheusDatasource;
  setPanels: (panels: SuggestedPanel[]) => void;
  timeRange: TimeRange;
};

export function PromMetricSelector({ datasourceInstance, setPanels, timeRange }: Props) {
  const styles = useStyles2(getStyles);

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
        <Field label={t('dashboard.metric-select-button.aria-label', 'Metric')} noMargin>
          <Button
            variant="secondary"
            fill="outline"
            size="md"
            onClick={handleOpenSidePanel}
            className={styles.metricSelectorButton}
          >
            {selectedMetric || t('dashboard-scene.prom-metric-selector.select-metric', 'Select metric')}
          </Button>
        </Field>
      </div>

      <MetricSelectorSidePanel
        isOpen={isSidePanelOpen}
        onClose={handleCloseSidePanel}
        datasourceInstance={datasourceInstance}
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
      padding: theme.spacing(2),
      paddingTop: 0,
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
