import { css, cx } from '@emotion/css';
import type { DragEvent as ReactDragEvent } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  SceneObjectState,
  SceneGridLayout,
  SceneObjectBase,
  SceneGridRow,
  VizPanel,
  sceneGraph,
  sceneUtils,
  SceneComponentProps,
  SceneGridItemLike,
  useSceneObjectState,
  SceneGridLayoutDragStartEvent,
  SceneObject,
} from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { useStyles2 } from '@grafana/ui';
import { GRID_COLUMN_COUNT } from 'app/core/constants';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty';

import {
  dashboardEditActions,
  NewObjectAddedToCanvasEvent,
  ObjectRemovedFromCanvasEvent,
  ObjectsReorderedOnCanvasEvent,
} from '../../edit-pane/shared';
import { serializeDefaultGridLayout } from '../../serialization/layoutSerializers/DefaultGridLayoutSerializer';
import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import {
  forceRenderChildren,
  getPanelIdForVizPanel,
  NEW_PANEL_HEIGHT,
  NEW_PANEL_WIDTH,
  getVizPanelKeyForPanelId,
  getGridItemKeyForPanelId,
  useDashboard,
  getLayoutOrchestratorFor,
  getDashboardSceneFor,
  buildVizPanelForPromDrop,
  SuggestedPanel,
} from '../../utils/utils';
import { useSoloPanelContext } from '../SoloPanelContext';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { CanvasGridAddActions } from '../layouts-shared/CanvasGridAddActions';
import { clearClipboard, getDashboardGridItemFromClipboard } from '../layouts-shared/paste';
import { dashboardCanvasAddButtonHoverStyles } from '../layouts-shared/styles';
import { getIsLazy } from '../layouts-shared/utils';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { DashboardGridItem } from './DashboardGridItem';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';
import { findSpaceForNewPanel } from './findSpaceForNewPanel';
import { RowActions } from './row-actions/RowActions';

interface DefaultGridLayoutManagerState extends SceneObjectState {
  grid: SceneGridLayout;
}

export class DefaultGridLayoutManager
  extends SceneObjectBase<DefaultGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public static Component = DefaultGridLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.default-layout.name', 'Custom');
    },
    get description() {
      return t('dashboard.default-layout.description', 'Position and size each panel individually');
    },
    id: 'GridLayout',
    createFromLayout: DefaultGridLayoutManager.createFromLayout,
    isGridLayout: true,
    icon: 'window-grid',
  };

  public serialize(): DashboardV2Spec['layout'] {
    return serializeDefaultGridLayout(this);
  }

  public readonly descriptor = DefaultGridLayoutManager.descriptor;

  public constructor(state: DefaultGridLayoutManagerState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (config.featureToggles.dashboardNewLayouts) {
      this._subs.add(
        this.subscribeToEvent(SceneGridLayoutDragStartEvent, ({ payload: { evt, panel } }) =>
          getLayoutOrchestratorFor(this)?.startDraggingSync(evt, panel)
        )
      );
    }

    this._subs.add(
      this.state.grid.subscribeToState(({ children: newChildren }, { children: prevChildren }) => {
        if (newChildren.length === prevChildren.length) {
          this.publishEvent(new ObjectsReorderedOnCanvasEvent(this.state.grid), true);
        }
      })
    );
  }

  public addPanel(vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(this);

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    // With new edit mode we add panels to the bottom of the grid
    if (config.featureToggles.dashboardNewLayouts) {
      const emptySpace = findSpaceForNewPanel(this.state.grid);
      const newGridItem = new DashboardGridItem({
        ...emptySpace,
        body: vizPanel,
        key: getGridItemKeyForPanelId(panelId),
      });

      dashboardEditActions.addElement({
        addedObject: vizPanel,
        source: this,
        perform: () => {
          this.state.grid.setState({ children: [...this.state.grid.state.children, newGridItem] });
        },
        undo: () => {
          this.state.grid.setState({
            children: this.state.grid.state.children.filter((child) => child !== newGridItem),
          });
        },
      });
    } else {
      const newGridItem = new DashboardGridItem({
        height: NEW_PANEL_HEIGHT,
        width: NEW_PANEL_WIDTH,
        x: 0,
        y: 0,
        body: vizPanel,
        key: getGridItemKeyForPanelId(panelId),
      });

      this.state.grid.setState({ children: [newGridItem, ...this.state.grid.state.children] });
    }
  }

  public pastePanel() {
    const emptySpace = findSpaceForNewPanel(this.state.grid);
    const newGridItem = getDashboardGridItemFromClipboard(getDashboardSceneFor(this), emptySpace);

    if (config.featureToggles.dashboardNewLayouts) {
      dashboardEditActions.edit({
        description: t('dashboard.edit-actions.paste-panel', 'Paste panel'),
        addedObject: newGridItem.state.body,
        source: this,
        perform: () => {
          this.state.grid.setState({ children: [...this.state.grid.state.children, newGridItem] });
        },
        undo: () => {
          this.state.grid.setState({
            children: this.state.grid.state.children.filter((child) => child !== newGridItem),
          });
        },
      });
    } else {
      this.state.grid.setState({ children: [...this.state.grid.state.children, newGridItem] });
    }

    clearClipboard();
  }

  public removePanel(panel: VizPanel) {
    const gridItem = panel.parent!;

    if (!(gridItem instanceof DashboardGridItem)) {
      throw new Error('Trying to remove panel that is not inside a DashboardGridItem');
    }

    const layout = this.state.grid;

    let row: SceneGridRow | undefined;

    try {
      row = sceneGraph.getAncestor(gridItem, SceneGridRow);
    } catch {
      row = undefined;
    }

    if (row) {
      row.setState({ children: row.state.children.filter((child) => child !== gridItem) });
      layout.forceRender();
      return;
    }

    if (!config.featureToggles.dashboardNewLayouts) {
      // No undo/redo support in legacy edit mode
      layout.setState({ children: layout.state.children.filter((child) => child !== gridItem) });
      return;
    }

    dashboardEditActions.removeElement({
      removedObject: gridItem.state.body,
      source: this,
      perform: () => layout.setState({ children: layout.state.children.filter((child) => child !== gridItem) }),
      undo: () => layout.setState({ children: [...layout.state.children, gridItem] }),
    });
  }

  public duplicatePanel(vizPanel: VizPanel) {
    const gridItem = vizPanel.parent;
    if (!(gridItem instanceof DashboardGridItem)) {
      console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
      return;
    }

    let panelState;
    let panelData;
    let newGridItem;

    const newPanelId = dashboardSceneGraph.getNextPanelId(this);
    const grid = this.state.grid;

    if (gridItem instanceof DashboardGridItem) {
      panelState = sceneUtils.cloneSceneObjectState(gridItem.state.body.state);
      panelData = sceneGraph.getData(gridItem.state.body).clone();
    } else {
      panelState = sceneUtils.cloneSceneObjectState(vizPanel.state);
      panelData = sceneGraph.getData(vizPanel).clone();
    }

    // when we duplicate a panel we don't want to clone the alert state
    delete panelData.state.data?.alertState;

    const newPanel = new VizPanel({
      ...panelState,
      $data: panelData,
      key: getVizPanelKeyForPanelId(newPanelId),
    });

    newGridItem = new DashboardGridItem({
      x: gridItem.state.x,
      y: gridItem.state.y,
      height: gridItem.state.height,
      itemHeight: gridItem.state.height,
      width: gridItem.state.width,
      variableName: gridItem.state.variableName,
      repeatDirection: gridItem.state.repeatDirection,
      maxPerRow: gridItem.state.maxPerRow,
      key: getGridItemKeyForPanelId(newPanelId),
      body: newPanel,
    });

    // No undo/redo support in legacy edit mode
    if (!config.featureToggles.dashboardNewLayouts) {
      if (gridItem.parent instanceof SceneGridRow) {
        const row = gridItem.parent;

        row.setState({ children: [...row.state.children, newGridItem] });
        grid.forceRender();
        return;
      }

      grid.setState({ children: [...grid.state.children, newGridItem] });
      this.publishEvent(new NewObjectAddedToCanvasEvent(newPanel), true);
      return;
    }

    const parent = gridItem.parent instanceof SceneGridRow ? gridItem.parent : grid;
    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.duplicate-panel', 'Duplicate panel'),
      addedObject: newGridItem.state.body,
      source: this,
      perform: () => {
        const oldGridItemIndex = parent.state.children.indexOf(gridItem);
        const newChildrenArray = [...parent.state.children];
        newChildrenArray.splice(oldGridItemIndex + 1, 0, newGridItem);
        parent.setState({ children: newChildrenArray });
      },
      undo: () => {
        parent.setState({
          children: parent.state.children.filter((child) => child !== newGridItem),
        });
      },
    });
  }

  public duplicate(): DashboardLayoutManager {
    const children = this.state.grid.state.children;
    const hasGridItem = children.find((child) => child instanceof DashboardGridItem);
    const clonedChildren: SceneGridItemLike[] = [];

    if (children.length) {
      let panelId = hasGridItem ? dashboardSceneGraph.getNextPanelId(hasGridItem.state.body) : 1;

      children.forEach((child) => {
        if (child instanceof DashboardGridItem) {
          const clone = child.clone({
            key: undefined,
            body: child.state.body.clone({
              key: getVizPanelKeyForPanelId(panelId),
            }),
          });

          clonedChildren.push(clone);
          panelId++;
        } else {
          clonedChildren.push(child.clone({ key: undefined }));
        }
      });
    }

    const clone = this.clone({
      key: undefined,
      grid: this.state.grid.clone({
        key: undefined,
        children: clonedChildren,
      }),
    });

    return clone;
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    this.state.grid.forEachChild((child) => {
      if (!(child instanceof DashboardGridItem) && !(child instanceof SceneGridRow)) {
        throw new Error('Child is not a DashboardGridItem or SceneGridRow, invalid scene');
      }

      if (child instanceof DashboardGridItem && child.state.body instanceof VizPanel) {
        panels.push(child.state.body);
      } else if (child instanceof SceneGridRow) {
        child.forEachChild((child) => {
          if (child instanceof DashboardGridItem && child.state.body instanceof VizPanel) {
            panels.push(child.state.body);
          }
        });
      }
    });

    return panels;
  }

  public addNewRow(): SceneGridRow {
    const id = dashboardSceneGraph.getNextPanelId(this);

    const row = new SceneGridRow({
      key: getVizPanelKeyForPanelId(id),
      title: t('dashboard-scene.default-grid-layout-manager.row.title.row-title', 'Row title'),
      actions: new RowActions({}),
      y: 0,
    });

    const sceneGridLayout = this.state.grid;

    // find all panels until the first row and put them into the newly created row. If there are no other rows,
    // add all panels to the row. If there are no panels just create an empty row
    const indexTillNextRow = sceneGridLayout.state.children.findIndex((child) => child instanceof SceneGridRow);
    const rowChildren = sceneGridLayout.state.children
      .splice(0, indexTillNextRow === -1 ? sceneGridLayout.state.children.length : indexTillNextRow)
      .map((child) => child.clone());

    if (rowChildren) {
      row.setState({ children: rowChildren });
    }

    sceneGridLayout.setState({ children: [row, ...sceneGridLayout.state.children] });

    this.publishEvent(new NewObjectAddedToCanvasEvent(row), true);
    return row;
  }

  public editModeChanged(isEditing: boolean) {
    const updateResizeAndDragging = () => {
      this.state.grid.setState({ isDraggable: isEditing, isResizable: isEditing });
      forceRenderChildren(this.state.grid, true);
    };

    if (config.featureToggles.dashboardNewLayouts) {
      // We do this in a timeout to wait a bit with enabling dragging as dragging enables grid animations
      // if we show the edit pane without animations it opens much faster and feels more responsive
      setTimeout(updateResizeAndDragging, 10);
      return;
    }

    updateResizeAndDragging();
  }

  public activateRepeaters() {
    if (!this.isActive) {
      this.activate();
    }

    if (!this.state.grid.isActive) {
      this.state.grid.activate();
    }

    this.state.grid.forEachChild((child) => {
      if (child instanceof DashboardGridItem && !child.isActive) {
        child.activate();
        return;
      }

      if (child instanceof SceneGridRow && child.state.$behaviors) {
        for (const behavior of child.state.$behaviors) {
          if (behavior instanceof RowRepeaterBehavior && !child.isActive) {
            child.activate();
            break;
          }
        }

        child.state.children.forEach((child) => {
          if (child instanceof DashboardGridItem && !child.isActive) {
            child.activate();
            return;
          }
        });
      }
    });
  }

  public getOutlineChildren(): SceneObject[] {
    const children: SceneObject[] = [];

    for (const child of this.state.grid.state.children) {
      // Flatten repeated grid items
      if (child instanceof DashboardGridItem) {
        children.push(child.state.body, ...(child.state.repeatedPanels || []));
      }
    }

    return children;
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.clone({});
  }

  public removeRow(row: SceneGridRow, removePanels = false) {
    const sceneGridLayout = this.state.grid;

    const children = sceneGridLayout.state.children.filter((child) => child.state.key !== row.state.key);

    if (!removePanels) {
      const rowChildren = row.state.children.map((child) => child.clone());
      const indexOfRow = sceneGridLayout.state.children.findIndex((child) => child.state.key === row.state.key);

      children.splice(indexOfRow, 0, ...rowChildren);
    }

    this.publishEvent(new ObjectRemovedFromCanvasEvent(row), true);

    sceneGridLayout.setState({ children });
  }

  public collapseAllRows() {
    this.state.grid.state.children.forEach((child) => {
      if (!(child instanceof SceneGridRow)) {
        return;
      }

      if (!child.state.isCollapsed) {
        this.state.grid.toggleRow(child);
      }
    });
  }

  public expandAllRows() {
    this.state.grid.state.children.forEach((child) => {
      if (!(child instanceof SceneGridRow)) {
        return;
      }

      if (child.state.isCollapsed) {
        this.state.grid.toggleRow(child);
      }
    });
  }

  public static createFromLayout(currentLayout: DashboardLayoutManager): DefaultGridLayoutManager {
    const panels = currentLayout.getVizPanels();
    const isLazy = getIsLazy(getDashboardSceneFor(currentLayout).state.preload)!;
    return DefaultGridLayoutManager.fromVizPanels(panels, isLazy);
  }

  public static fromVizPanels(panels: VizPanel[] = [], isLazy?: boolean | undefined): DefaultGridLayoutManager {
    const children: DashboardGridItem[] = [];
    const panelHeight = 10;
    const panelWidth = GRID_COLUMN_COUNT / 3;
    let currentY = 0;
    let currentX = 0;

    for (let panel of panels) {
      const variableName = panel.parent instanceof AutoGridItem ? panel.parent.state.variableName : undefined;

      panel.clearParent();

      children.push(
        new DashboardGridItem({
          key: getGridItemKeyForPanelId(getPanelIdForVizPanel(panel)),
          x: currentX,
          y: currentY,
          width: panelWidth,
          height: panelHeight,
          itemHeight: panelHeight,
          body: panel,
          variableName,
        })
      );

      currentX += panelWidth;

      if (currentX + panelWidth > GRID_COLUMN_COUNT) {
        currentX = 0;
        currentY += panelHeight;
      }
    }

    return new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: children,
        isDraggable: true,
        isResizable: true,
        isLazy,
      }),
    });
  }

  public static fromGridItems(
    gridItems: SceneGridItemLike[],
    isDraggable?: boolean,
    isResizable?: boolean,
    isLazy?: boolean | undefined
  ): DefaultGridLayoutManager {
    const children = gridItems.reduce<SceneGridItemLike[]>((acc, gridItem) => {
      gridItem.clearParent();
      acc.push(gridItem);

      return acc;
    }, []);

    return new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children,
        isDraggable,
        isResizable,
        isLazy,
      }),
    });
  }
}

function DefaultGridLayoutManagerRenderer({ model }: SceneComponentProps<DefaultGridLayoutManager>) {
  const { children } = useSceneObjectState(model.state.grid, { shouldActivateOrKeepAlive: true });
  const dashboard = useDashboard(model);
  const { isEditing } = dashboard.useState();
  const hasClonedParents = isRepeatCloneOrChildOf(model);
  const styles = useStyles2(getStyles);
  const showCanvasActions = isEditing && config.featureToggles.dashboardNewLayouts && !hasClonedParents;
  const soloPanelContext = useSoloPanelContext();

  if (soloPanelContext) {
    return children.map((child) => <child.Component model={child} key={child.state.key!} />);
  }

  // If we are top level layout and we have no children, show empty state
  if (model.parent === dashboard && children.length === 0) {
    return (
      <DashboardEmpty dashboard={dashboard} canCreate={!!dashboard.state.meta.canEdit} key="dashboard-empty-state" />
    );
  }

  const onCanvasDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!isEditing) {
      return;
    }
    if (e.dataTransfer.types.includes('application/x-grafana-query')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onCanvasDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!isEditing) {
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

      const currentTarget = e.currentTarget;
      const containerRect = currentTarget ? currentTarget.getBoundingClientRect() : new DOMRect(0, 0, 0, 0);
      const colWidth = containerRect.width / GRID_COLUMN_COUNT;
      const baseCol = Math.floor((e.clientX - containerRect.left) / colWidth);

      const occupied = new Set<string>();
      let maxY = 0;
      const addOcc = (x: number, y: number, w: number, h: number) => {
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            occupied.add(`${x + dx},${y + dy}`);
          }
        }
        if (y + h > maxY) {
          maxY = y + h;
        }
      };
      for (const child of model.state.grid.state.children) {
        if (child instanceof SceneGridRow) {
          for (const rowChild of child.state.children) {
            addOcc(rowChild.state.x!, rowChild.state.y!, rowChild.state.width!, rowChild.state.height!);
          }
        } else {
          addOcc(child.state.x!, child.state.y!, child.state.width!, child.state.height!);
        }
      }

      const canFitAt = (x: number, y: number, w: number, h: number) => {
        if (x < 0 || x + w > GRID_COLUMN_COUNT) {
          return false;
        }
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            if (occupied.has(`${x + dx},${y + dy}`)) {
              return false;
            }
          }
        }
        return true;
      };

      const DESIRED_W = 12;
      const DESIRED_H = 8;
      const MIN_W = 8;
      const MIN_H = 6;
      let placeX = baseCol;
      let placeY = 0;
      let placeW = DESIRED_W;
      let placeH = DESIRED_H;
      let found = false;

      for (let y = 0; y <= maxY + 40 && !found; y++) {
        const desiredX = Math.max(0, Math.min(GRID_COLUMN_COUNT - DESIRED_W, baseCol - Math.floor(DESIRED_W / 2)));
        if (canFitAt(desiredX, y, DESIRED_W, DESIRED_H)) {
          placeX = desiredX;
          placeY = y;
          found = true;
          break;
        }

        const minX = Math.max(0, Math.min(GRID_COLUMN_COUNT - MIN_W, baseCol - Math.floor(MIN_W / 2)));
        if (canFitAt(minX, y, MIN_W, MIN_H)) {
          placeX = minX;
          placeY = y;
          placeW = MIN_W;
          placeH = MIN_H;
          found = true;
          break;
        }
      }

      if (!found) {
        const cell = findSpaceForNewPanel(model.state.grid) || { x: 0, y: maxY, width: DESIRED_W, height: DESIRED_H };
        placeX = cell.x;
        placeY = cell.y;
        placeW = cell.width;
        placeH = cell.height;
      }

      const panelId = dashboardSceneGraph.getNextPanelId(model);
      vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
      const newGridItem = new DashboardGridItem({
        x: placeX,
        y: placeY,
        width: placeW,
        height: placeH,
        itemHeight: placeH,
        body: vizPanel,
        key: getGridItemKeyForPanelId(panelId),
      });

      dashboardEditActions.addElement({
        addedObject: vizPanel,
        source: model,
        perform: () => {
          model.state.grid.setState({ children: [...model.state.grid.state.children, newGridItem] });
        },
        undo: () => {
          model.state.grid.setState({
            children: model.state.grid.state.children.filter((child) => child !== newGridItem),
          });
        },
      });
    } catch (err) {
      return;
    }
  };

  return (
    <div
      className={cx(styles.container, isEditing && styles.containerEditing)}
      onDragOver={onCanvasDragOver}
      onDrop={onCanvasDrop}
    >
      {model.state.grid.Component && <model.state.grid.Component model={model.state.grid} />}
      {showCanvasActions && (
        <div className={styles.actionsWrapper}>
          <CanvasGridAddActions layoutManager={model} />
        </div>
      )}
    </div>
  );
}

const OriginalSceneGridRowRenderer = SceneGridRow.Component;
// @ts-expect-error
SceneGridRow.Component = SceneGridRowRenderer;

function SceneGridRowRenderer({ model }: SceneComponentProps<SceneGridRow>) {
  const soloPanelContext = useSoloPanelContext();

  if (soloPanelContext) {
    return model.state.children.map((child) => <child.Component model={child} key={child.state.key!} />);
  }

  return <OriginalSceneGridRowRenderer model={model} />;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      width: '100%',
      display: 'flex',
      flexGrow: 1,
      flexDirection: 'column',
    }),
    containerEditing: css({
      // In editing the add actions should live at the bottom of the grid so we have to
      // disable flex grow on the SceneGridLayouts first div
      '> div:first-child': {
        flexGrow: `0 !important`,
        minHeight: '250px',
      },
      ...dashboardCanvasAddButtonHoverStyles,
    }),
    actionsWrapper: css({
      position: 'relative',
      paddingBottom: theme.spacing(5),
    }),
  };
}
