import { css } from '@emotion/css';
import { useEffect, type DragEvent as ReactDragEvent, React } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { config, locationService } from '@grafana/runtime';
import { Button, LinkButton, useStyles2, Text, Box, Stack, TextLink, Icon } from '@grafana/ui';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import {
  onAddLibraryPanel as onAddLibraryPanelImpl,
  onCreateNewPanel,
  onImportDashboard,
} from 'app/features/dashboard/utils/dashboard';
import { buildPanelEditScene } from 'app/features/dashboard-scene/panel-edit/PanelEditor';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { buildVizPanelForPromDrop, SuggestedPanel } from 'app/features/dashboard-scene/utils/utils';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { useDispatch, useSelector } from 'app/types/store';

import { setInitialDatasource } from '../state/reducers';

export interface Props {
  dashboard: DashboardModel | DashboardScene;
  canCreate: boolean;
}

const DashboardEmpty = ({ dashboard, canCreate }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);

  // Get repository information to check if it's read-only
  const { isReadOnlyRepo } = useGetResourceRepositoryView({
    folderName: dashboard instanceof DashboardScene ? dashboard.state.meta?.folderUid : dashboard.meta?.folderUid,
  });

  const onAddVisualization = () => {
    let id;
    if (dashboard instanceof DashboardScene) {
      const panel = dashboard.onCreateNewPanel();
      dashboard.setState({ editPanel: buildPanelEditScene(panel, true) });
      locationService.partial({ firstPanel: true });
    } else {
      id = onCreateNewPanel(dashboard, initialDatasource);
      dispatch(setInitialDatasource(undefined));
      locationService.partial({ editPanel: id, firstPanel: true });
    }

    DashboardInteractions.emptyDashboardButtonClicked({ item: 'add_visualization' });
  };

  const onAddLibraryPanel = () => {
    DashboardInteractions.emptyDashboardButtonClicked({ item: 'import_from_library' });
    if (dashboard instanceof DashboardScene) {
      dashboard.onShowAddLibraryPanelDrawer();
    } else {
      onAddLibraryPanelImpl(dashboard);
    }
  };

  const isProvisioned = dashboard instanceof DashboardScene && dashboard.isManagedRepository();

  // Automatically open the add panel pane when DashboardEmpty is rendered for DashboardScene
  useEffect(() => {
    if (dashboard instanceof DashboardScene && canCreate && !isReadOnlyRepo) {
      // Only open if not already adding and dashboard is editable
      if (!dashboard.state.editPane.state.isAdding && dashboard.state.editable) {
        dashboard.state.editPane.setState({ isAdding: true });
      }
    }
  }, [dashboard, canCreate, isReadOnlyRepo]);

  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!(dashboard instanceof DashboardScene)) {
      return;
    }
    if (e.dataTransfer.types.includes('application/x-grafana-query')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!(dashboard instanceof DashboardScene)) {
      return;
    }

    const raw = e.dataTransfer.getData('application/x-grafana-query');
    if (!raw) {
      return;
    }

    try {
      const payload: SuggestedPanel = JSON.parse(raw);

      if (payload.type !== 'prometheus-query') {
        return;
      }

      const vizPanel = buildVizPanelForPromDrop(payload);
      if (!vizPanel) {
        return;
      }

      // Create AutoGridLayoutManager
      const autoGridLayoutManager = new AutoGridLayoutManager({});

      // Change the dashboard's layout manager first
      dashboard.setState({ body: autoGridLayoutManager });

      // Enter edit mode if not already editing
      if (!dashboard.state.isEditing) {
        dashboard.onEnterEditMode();
      }

      // Now add the panel using the layout manager's addPanel method
      autoGridLayoutManager.addPanel(vizPanel);
    } catch (err) {
      return;
    }
  };

  let content = (
    <div className={styles.wrapper}>
      <Stack alignItems="stretch" justifyContent="center" gap={4} direction="column">
        <Box borderColor="strong" borderStyle="dashed" padding={4}>
          <Stack direction="column" alignItems="center" gap={2}>
            <Text element="h1" textAlignment="center" weight="medium">
              <Trans i18nKey="dashboard.empty.add-visualization-header">
                Start your new dashboard by adding a visualization
              </Trans>
            </Text>
            <Box marginBottom={2} paddingX={4}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.add-visualization-body">
                  Select a data source and then query and visualize your data with charts, stats and tables or create
                  lists, markdowns and other widgets.
                </Trans>
              </Text>
            </Box>
            <Button
              size="lg"
              icon="plus"
              data-testid={selectors.pages.AddDashboard.itemButton('Create new panel button')}
              onClick={onAddVisualization}
              disabled={!canCreate || isReadOnlyRepo}
            >
              <Trans i18nKey="dashboard.empty.add-visualization-button">Add visualization</Trans>
            </Button>
          </Stack>
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} wrap="wrap" gap={4}>
          <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
            <Stack direction="column" alignItems="center" gap={1}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-library-panel-header">Import panel</Trans>
              </Text>
              <Box marginBottom={2}>
                <Text element="p" textAlignment="center" color="secondary">
                  <Trans i18nKey="dashboard.empty.add-library-panel-body">
                    Add visualizations that are shared with other dashboards.
                  </Trans>
                </Text>
              </Box>
              <Button
                icon="plus"
                fill="outline"
                data-testid={selectors.pages.AddDashboard.itemButton('Add a panel from the panel library button')}
                onClick={onAddLibraryPanel}
                disabled={!canCreate || isProvisioned || isReadOnlyRepo}
              >
                <Trans i18nKey="dashboard.empty.add-library-panel-button">Add library panel</Trans>
              </Button>
            </Stack>
          </Box>
          <Box borderColor="strong" borderStyle="dashed" padding={3} flex={1}>
            <Stack direction="column" alignItems="center" gap={1}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.import-a-dashboard-header">Import a dashboard</Trans>
              </Text>
              <Box marginBottom={2}>
                <Text element="p" textAlignment="center" color="secondary">
                  <Trans i18nKey="dashboard.empty.import-a-dashboard-body">
                    Import dashboards from files or{' '}
                    <TextLink external href="https://grafana.com/grafana/dashboards/">
                      grafana.com
                    </TextLink>
                    .
                  </Trans>
                </Text>
              </Box>
              <Button
                icon="upload"
                fill="outline"
                data-testid={selectors.pages.AddDashboard.itemButton('Import dashboard button')}
                onClick={() => {
                  DashboardInteractions.emptyDashboardButtonClicked({ item: 'import_dashboard' });
                  onImportDashboard();
                }}
                disabled={!canCreate || isReadOnlyRepo}
              >
                <Trans i18nKey="dashboard.empty.import-dashboard-button">Import dashboard</Trans>
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Stack>
    </div>
  );

  if (config.featureToggles.dashboardNewLayouts) {
    content = (
      <div className={styles.wrapper} onDragOver={onDragOver} onDrop={onDrop}>
        <Stack alignItems="center" justifyContent="center" gap={4} direction="column">
          <Box paddingTop={10}>
            <Stack direction="column" alignItems="center" gap={2}>
              <Text element="h1" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.drag-data-here-to-start-your-dashboard">
                  Drag data here to start your dashboard
                </Trans>
              </Text>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.drag-and-drop-data-from-the-sidebar-to-create-your-first-panel">
                  Drag and drop data from the sidebar to create your first panel
                </Trans>
              </Text>
            </Stack>
          </Box>
          <Box marginTop={6}>
            <Stack alignItems="center">
              <Box borderColor="strong" backgroundColor="info" paddingX={6} paddingY={3}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={6}>
                  <Stack direction="row" alignItems="center" gap={3} flex={1}>
                    <Stack direction="column" alignItems="center">
                      <Icon size="xxxl" name="database" />
                    </Stack>
                    <Stack direction="column" gap={1}>
                      <Text element="p" weight="medium">
                        <Trans i18nKey="dashboard.empty.cantfindyourdata">Can&apos;t find your data?</Trans>
                      </Text>
                      <Text element="p" color="secondary">
                        <Trans i18nKey="dashboard.empty.cantfindyourdata-body">
                          Add a new data source to get started.
                        </Trans>
                      </Text>
                    </Stack>
                  </Stack>
                  <LinkButton
                    variant="secondary"
                    fill="solid"
                    href="/datasources/new"
                    target="_blank"
                    data-testid={selectors.pages.AddDashboard.itemButton('Configure a data source button')}
                    onClick={() => {
                      DashboardInteractions.emptyDashboardButtonClicked({ item: 'configure_data_source' });
                    }}
                  >
                    <Trans i18nKey="dashboard.empty.cantfindyourdata-button">Configure a data source</Trans>
                  </LinkButton>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </div>
    );
  }

  return (
    <Stack alignItems="center" justifyContent="center">
      {content}
    </Stack>
  );
};

export default DashboardEmpty;

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      label: 'dashboard-empty-wrapper',
      flexDirection: 'column',
      maxWidth: '890px',
      gap: theme.spacing.gridSize * 4,
      paddingTop: theme.spacing(2),

      [theme.breakpoints.up('sm')]: {
        paddingTop: theme.spacing(12),
      },

      // For new layouts, extend the drop area to full height
      ...(config.featureToggles.dashboardNewLayouts && {
        maxWidth: '100%',
        width: '100%',
        height: '100%',
        minHeight: '100vh',
      }),
    }),
  };
}
