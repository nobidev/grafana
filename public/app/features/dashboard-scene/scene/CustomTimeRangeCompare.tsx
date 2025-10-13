import { Unsubscribable } from 'rxjs';

import { reportInteraction } from '@grafana/runtime';
import {
  SceneTimeRangeCompare,
  SceneComponentProps,
  VizPanel,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { TimeCompareOptions } from '@grafana/schema';

interface CustomTimeRangeCompareState extends SceneObjectState {
  timeRangeCompare: SceneTimeRangeCompare | undefined;
}

export class CustomTimeRangeCompare extends SceneObjectBase<CustomTimeRangeCompareState> {
  public get vizPanel(): VizPanel {
    return sceneGraph.getAncestor(this, VizPanel);
  }

  private _changedSub: Unsubscribable | undefined;

  constructor() {
    super({ timeRangeCompare: undefined });

    this.addActivationHandler(() => this._activationHandler());
  }

  private _hasTimeCompare(options: VizPanel['state']['options']): options is TimeCompareOptions {
    return !!options && typeof options === 'object' && 'timeCompare' in options;
  }

  private _getTimeCompareValue(): boolean {
    const { options } = this.vizPanel.state;

    if (!this._hasTimeCompare(options)) {
      return false;
    }

    return !!options.timeCompare;
  }

  private _setTimeRangeCompare() {
    this._changedSub?.unsubscribe();

    const timeRangeCompare = new SceneTimeRangeCompare({});

    this._changedSub = timeRangeCompare.subscribeToState((newState, oldState) => {
      if (newState.compareWith !== oldState.compareWith) {
        reportInteraction('panel_time_comparison', {
          viz_type: this.vizPanel?.getPlugin()?.meta.id || 'unknown',
          select_type: 'option_selected',
          option_type: newState.compareWith,
        });
      }
    });

    this.setState({ timeRangeCompare });
  }

  private _unsetTimeRangeCompare() {
    this._changedSub?.unsubscribe();
    this._changedSub = undefined;
    this.setState({ timeRangeCompare: undefined });
  }

  private _activationHandler() {
    // Create the time range compare if it is enabled
    // Useful when loading a saved dashboard
    if (this._getTimeCompareValue()) {
      this._setTimeRangeCompare();
    }

    // Create or unset the time range compare when the panel options are updated
    this._subs.add(
      this.vizPanel.subscribeToState(() => {
        const isEnabled = this._getTimeCompareValue();

        if (!isEnabled && this.state.timeRangeCompare) {
          this._unsetTimeRangeCompare();
        }

        if (isEnabled && !this.state.timeRangeCompare) {
          this._setTimeRangeCompare();
        }
      })
    );

    return () => {
      this._changedSub?.unsubscribe();
    };
  }

  static Component = ({ model }: SceneComponentProps<CustomTimeRangeCompare>) => {
    const { timeRangeCompare } = model.useState();

    if (!timeRangeCompare) {
      return null;
    }

    return <timeRangeCompare.Component model={timeRangeCompare} />;
  };
}
