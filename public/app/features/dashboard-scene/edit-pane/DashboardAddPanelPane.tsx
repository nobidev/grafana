import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { DataSourceInstanceSettings, getDataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { PrometheusDatasource } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { sceneGraph, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { Icon, useStyles2, clearButtonStyles, AxisPlacement, TooltipDisplayMode } from '@grafana/ui';

// import { useDatasources } from '../../datasources/hooks';
import { getDashboardSceneFor, SuggestedPanel } from '../utils/utils';

import { DashboardEditPane } from './DashboardEditPane';
import { DataSourceButton } from './DataSourceButton';
import { DataSourceSelectPane } from './DataSourceSelectPane';
import { PromMetricSelector } from './PromMetricSelector';

interface Props {
  editPane: DashboardEditPane;
}

interface Panel {
  suggestedPanel: SuggestedPanel;
  vizPanel: VizPanel;
}

export function DashboardAddPanelPane({ editPane }: Props) {
  // This should probably be the same if this pane is opened again. Also store in dashboard state?
  const [currentDatasource, setCurrentDatasource] = useState<DataSourceInstanceSettings | undefined>();
  const [datasourceInstance, setDatasourceInstance] = useState<PrometheusDatasource | null>(null);

  // Initialize datasource instance when currentDatasource changes
  useEffect(() => {
    if (!currentDatasource?.uid) {
      setDatasourceInstance(null);
      return;
    }

    let isCancelled = false;

    const initializeDatasource = async () => {
      try {
        const ds = await getDataSourceSrv().get(currentDatasource.uid);
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const promDs = ds as PrometheusDatasource;

        if (isCancelled) {
          return;
        }

        setDatasourceInstance(promDs);
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to get datasource instance:', error);
          setDatasourceInstance(null);
        }
      }
    };

    initializeDatasource();

    return () => {
      isCancelled = true;
    };
  }, [currentDatasource?.uid]);

  // Get dashboard timerange
  const dashboard = getDashboardSceneFor(editPane);
  const { value: timeRange } = sceneGraph.getTimeRange(dashboard).useState();

  const [panels, setPanels] = useState<Panel[]>([
    {
      suggestedPanel: {
        type: 'prometheus-query',
        name: 'Up',
        targets: [
          {
            refId: 'cidr-A',
            expr: 'up',
          },
        ],
      },
      vizPanel: getVizPanel(
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
        undefined
      )!,
    },
  ]);

  // This defaults to open, but should probably not be open if there is a current datasource.
  // FIXME [HACK] it was set as false for fast development purposes
  const [isDsPickerOpen, setIsDsPickerOpen] = useState(false);

  const styles = useStyles2(getStyles);
  const clearButton = useStyles2(clearButtonStyles);

  return (
    <div>
      <div className={styles.title}>
        <button
          type="button"
          className={clearButton}
          onClick={() => editPane.setState({ isAdding: false })}
          aria-label={t('dashboard.add-panel-pane.close', 'Close add panel')}
        >
          <Icon name="arrow-left" size="xl" className={styles.iconMuted} />
        </button>
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

          {!!datasourceInstance && (
            <PromMetricSelector
              datasourceInstance={datasourceInstance}
              setPanels={(panels) =>
                setPanels(panels.map((p) => ({ suggestedPanel: p, vizPanel: getVizPanel(p, currentDatasource)! })))
              }
              timeRange={timeRange}
            />
          )}

          <div className={styles.list}>
            {panels.map((p) => (
              <div
                key={p.suggestedPanel.name}
                style={{ width: '100%' }}
                draggable={true}
                onDragStart={(e) => {
                  p.suggestedPanel.datasourceUid = currentDatasource?.uid;
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData('application/x-grafana-query', JSON.stringify(p.suggestedPanel));
                }}
              >
                <div style={{ height: '100px' }}>
                  <p.vizPanel.Component model={p.vizPanel} />
                </div>
              </div>
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

function getVizPanel(panel: SuggestedPanel, currentDatasource: DataSourceInstanceSettings | undefined) {
  const p = new VizPanel({});
  p.setState({
    title: panel.name,
    pluginId: 'timeseries',
    options: {
      legend: {
        showLegend: false,
        displayMode: 'list',
        placement: 'bottom',
        calcs: [],
      },
      tooltip: {
        mode: TooltipDisplayMode.None,
      },
    },
    fieldConfig: {
      defaults: {
        custom: {
          axisPlacement: AxisPlacement.Hidden,
        },
      },
      overrides: [],
    },
  });

  const dsSettings = currentDatasource
    ? getDataSourceSrv().getInstanceSettings(currentDatasource)
    : getDataSourceSrv().getInstanceSettings(null);
  if (!dsSettings) {
    return null;
  }
  const dsRef = getDataSourceRef(dsSettings);
  const runner = new SceneQueryRunner({ queries: panel.targets, datasource: dsRef });
  p.setState({ $data: runner });
  p.activate();

  return p;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    title: css({
      padding: theme.spacing(1, 2),
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      marginBottom: theme.spacing(1),
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
      alignItems: 'flex-start',
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
      marginTop: theme.spacing(0.25), // Slight offset to align with first line of text
      flexShrink: 0, // Prevent icon from shrinking
    }),
    itemText: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minWidth: 0, // Allow flex item to shrink below its content size
    }),
    itemName: css({
      fontWeight: theme.typography.fontWeightMedium,
      wordBreak: 'break-word',
      lineHeight: theme.typography.body.lineHeight,
    }),
    itemMeta: css({
      color: theme.colors.text.secondary,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    iconMuted: css({
      color: theme.colors.text.secondary,
    }),
  };
}

DashboardAddPanelPane.displayName = 'DashboardAddPanelPane';
