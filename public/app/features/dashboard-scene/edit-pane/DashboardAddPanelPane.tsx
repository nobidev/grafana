import { css } from '@emotion/css';
import { useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';

import { DashboardEditPane } from './DashboardEditPane';
import { DataSourceButton } from './DataSourceButton';
import { DataSourceSelectPane } from './DataSourceSelectPane';

interface Props {
  editPane: DashboardEditPane;
}

const queries = [
  { name: 'Up', query: 'up' },
  { name: 'HTTP rate (5m)', query: 'rate(http_requests_total[5m])' },
  { name: 'CPU usage (5m)', query: 'sum(rate(container_cpu_usage_seconds_total{image!=""}[5m]))' },
  {
    name: '95th latency (5m)',
    query: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
  },
  { name: 'Memory usage by job', query: 'sum by (job) (process_resident_memory_bytes)' },
];

export function DashboardAddPanelPane({ editPane }: Props) {
  // This should probably be the same if this pane is opened again. Also store in dashboard state?
  const [currentDatasource, setCurrentDatasource] = useState<DataSourceInstanceSettings | undefined>(undefined);

  // This defaults to open, but should probably not be open if there is a current datasource.
  const [isDsPickerOpen, setIsDsPickerOpen] = useState(true);

  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.title}>
        <Trans i18nKey="dashboard-scene.dashboard-add-panel-pane.add-data-to-dashboard">Add data to dashboard</Trans>
      </div>

      {!isDsPickerOpen && (
        <>
          <div>
            <DataSourceButton
              current={currentDatasource}
              ariaLabel={t('dashboard.data-source-button.aria-label', 'Change data source')}
              onOpen={() => setIsDsPickerOpen(true)}
            />
          </div>
          <div className={styles.list}>
            {queries.map((q) => (
              <button
                key={q.name}
                type="button"
                className={styles.listItem}
                draggable
                onDragStart={(e) => {
                  const payload = {
                    type: 'prometheus-query',
                    name: q.name,
                    query: q.query,
                    datasourceUid: currentDatasource?.uid,
                  };
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData('application/x-grafana-query', JSON.stringify(payload));
                }}
                aria-label={t('dashboard.add-panel-pane.drag-query', 'Drag to dashboard')}
              >
                <span className={styles.logoWrap}>
                  <Icon name="search" />
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{q.name}</span>
                  <span className={styles.itemMeta}>
                    <Icon name="info-circle" /> {t('dashboard.add-panel-pane.query-language', 'PromQL')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {isDsPickerOpen && (
        <DataSourceSelectPane
          current={currentDatasource}
          onSelect={(ds) => {
            setCurrentDatasource(ds);
            setIsDsPickerOpen(false);
          }}
          onClose={() => setIsDsPickerOpen(false)}
        />
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    title: css({
      padding: theme.spacing(2),
    }),
    list: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(2),
      paddingTop: theme.spacing(0),
    }),
    listItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1),
      marginBottom: theme.spacing(1),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      ':hover': {
        background: theme.colors.action.hover,
      },
    }),
    logoWrap: css({
      width: theme.spacing(3),
      height: theme.spacing(3),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    itemText: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    itemName: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    itemMeta: css({
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
  };
}

DashboardAddPanelPane.displayName = 'DashboardAddPanelPane';
