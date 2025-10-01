import { css } from '@emotion/css';
import { useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor, SuggestedPanel } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';
import { DataSourceButton } from './DataSourceButton';
import { DataSourceSelectPane } from './DataSourceSelectPane';
import { PromMetricSelector } from './PromMetricSelector';

interface Props {
  editPane: DashboardEditPane;
}

export function DashboardAddPanelPane({ editPane }: Props) {
  // This should probably be the same if this pane is opened again. Also store in dashboard state?
  const [currentDatasource, setCurrentDatasource] = useState<DataSourceInstanceSettings | undefined>(undefined);

  // Get dashboard timerange
  const dashboard = getDashboardSceneFor(editPane);
  const { value: timeRange } = sceneGraph.getTimeRange(dashboard).useState();

  const [panels, setPanels] = useState<SuggestedPanel[]>([
    {
      type: 'prometheus-query',
      name: 'Up',
      targets: [
        {
          refId: 'cidr-A',
          expr: 'up',
        },
      ],
    },
  ]);

  // This defaults to open, but should probably not be open if there is a current datasource.
  // FIXME [HACK] it was set as false for fast development purposes
  const [isDsPickerOpen, setIsDsPickerOpen] = useState(false);

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

          <PromMetricSelector selectedDatasource={currentDatasource} setPanels={setPanels} timeRange={timeRange} />

          <div className={styles.list}>
            {panels.map((p) => (
              <button
                key={p.name}
                type="button"
                className={styles.listItem}
                draggable
                onDragStart={(e) => {
                  p.datasourceUid = currentDatasource?.uid;
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData('application/x-grafana-query', JSON.stringify(p));
                }}
                aria-label={t('dashboard.add-panel-pane.drag-query', 'Drag to dashboard')}
              >
                <span className={styles.logoWrap}>
                  <Icon name="search" />
                </span>
                <span className={styles.itemText}>
                  <span className={styles.itemName}>{p.name}</span>
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
