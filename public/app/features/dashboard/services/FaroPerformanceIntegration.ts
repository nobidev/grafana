import type { Span } from '@opentelemetry/api';

import { store } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';
import { config, logInfo } from '@grafana/runtime';
import { performanceUtils } from '@grafana/scenes';

/**
 * Faro observer that creates OpenTelemetry traces for dashboard performance.
 * Events and metrics are handled by DashboardAnalyticsAggregator.
 */
class FaroTracingObserver implements performanceUtils.ScenePerformanceObserver {
  private debugEnabled = store.get('grafana.debug.sceneProfiling') === 'true';
  private activeSpans = new Map<string, Span>();

  private log(message: string, data?: unknown): void {
    if (this.debugEnabled) {
      console.log(`[FaroTracing] ${message}`, data || '');
    }
  }

  onDashboardInteractionStart = (data: performanceUtils.DashboardInteractionStartData): void => {
    this.log('Creating dashboard trace', data);

    // Create root span for dashboard interaction
    const span = faro.api
      .getOTEL()
      ?.trace.getTracer('grafana-dashboard')
      .startSpan(`dashboard.${data.interactionType}`, {
        attributes: {
          'dashboard.interaction.type': data.interactionType,
          'dashboard.operation.id': data.operationId,
          ...data.metadata,
        },
      });

    if (span) {
      this.activeSpans.set(data.operationId, span);
    }
  };

  onDashboardInteractionMilestone = (data: performanceUtils.DashboardInteractionMilestoneData): void => {
    // Add event to the active span
    const span = this.activeSpans.get(data.operationId);
    if (span) {
      span.addEvent(
        data.milestone,
        {
          'interaction.type': data.interactionType,
          ...data.metadata,
        },
        data.timestamp // Pass the specific timestamp for the event
      );

      // Log special milestones for visibility
      if (data.milestone === 'queries_complete') {
        this.log('Dashboard queries completed', {
          queriesDuration: data.metadata?.queriesDuration,
          operationId: data.operationId,
        });
      } else if (data.milestone === 'actual_interaction_complete') {
        this.log('Actual dashboard interaction completed', {
          actualDuration: data.metadata?.actualDuration,
          slowFramesTime: data.metadata?.slowFramesTime,
          slowFramesCount: data.metadata?.slowFramesCount,
          operationId: data.operationId,
        });
      }
    }
  };

  onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    // Complete the dashboard span
    const span = this.activeSpans.get(data.operationId);
    if (span) {
      span.setAttributes({
        'dashboard.duration': data.duration || 0,
        'dashboard.network.duration': data.networkDuration || 0,
        'dashboard.longframes.count': data.longFramesCount,
        'dashboard.longframes.total_time': data.longFramesTotalTime,
        ...data.metadata,
      });

      if (data.error) {
        span.setStatus({ code: 2, message: data.error }); // 2 = ERROR
      }

      span.end();
      this.activeSpans.delete(data.operationId);
    }
  };

  onPanelOperationStart = (data: performanceUtils.PanelPerformanceData): void => {
    this.log('Creating panel span', data);

    // Find parent dashboard span
    const parentSpan = this.findParentDashboardSpan();
    const tracer = faro.api.getOTEL()?.trace.getTracer('grafana-panel');
    const context = faro.api.getOTEL()?.context;

    if (tracer && parentSpan && context) {
      // Create child span for panel operation
      const ctx = faro.api.getOTEL()?.trace.setSpan(context.active(), parentSpan);

      const span = tracer.startSpan(
        `panel.${data.operation}`,
        {
          attributes: {
            'panel.id': data.panelId,
            'panel.key': data.panelKey,
            'panel.plugin.id': data.pluginId,
            'panel.operation': data.operation,
            'panel.operation.id': data.operationId,
          },
        },
        ctx
      );

      if (span) {
        this.activeSpans.set(data.operationId, span);
      }
    }
  };

  onPanelOperationComplete = (data: performanceUtils.PanelPerformanceData): void => {
    // Complete the panel span
    const span = this.activeSpans.get(data.operationId);
    if (span) {
      span.setAttributes({
        'panel.duration': data.duration || 0,
      });

      if (data.error) {
        span.setStatus({ code: 2, message: data.error });
      }

      span.end();
      this.activeSpans.delete(data.operationId);
    }
  };

  onQueryStart = (data: performanceUtils.QueryPerformanceData): void => {
    this.log('Creating query span', data);

    // Find parent span (could be panel or dashboard)
    const parentSpan = this.findParentSpan(data.origin);
    const tracer = faro.api.getOTEL()?.trace.getTracer('grafana-query');
    const context = faro.api.getOTEL()?.context;

    if (tracer && parentSpan && context) {
      // Create child span for query
      const ctx = faro.api.getOTEL()?.trace.setSpan(context.active(), parentSpan);

      const span = tracer.startSpan(
        'query.execute',
        {
          attributes: {
            'query.id': data.queryId,
            'query.type': data.queryType,
            'query.origin': data.origin,
            'query.operation.id': data.operationId,
          },
        },
        ctx
      );

      if (span) {
        this.activeSpans.set(data.operationId, span);
      }
    }
  };

  onQueryComplete = (data: performanceUtils.QueryPerformanceData): void => {
    // Complete the query span
    const span = this.activeSpans.get(data.operationId);
    if (span) {
      span.setAttributes({
        'query.duration': data.duration || 0,
      });

      if (data.error) {
        span.setStatus({ code: 2, message: data.error });
      }

      span.end();
      this.activeSpans.delete(data.operationId);
    }
  };

  private findParentDashboardSpan(): Span | undefined {
    // Find the most recent dashboard interaction span
    for (const [operationId, span] of this.activeSpans) {
      if (operationId.startsWith('dashboard-')) {
        return span;
      }
    }
    return undefined;
  }

  private findParentSpan(origin: string): Span | undefined {
    // If query originates from a panel, find panel span
    if (origin.includes('VizPanel')) {
      for (const [operationId, span] of this.activeSpans) {
        if (operationId.startsWith('panel-')) {
          return span;
        }
      }
    }
    // Otherwise use dashboard span
    return this.findParentDashboardSpan();
  }

  public cleanup(): void {
    // End any remaining spans
    this.activeSpans.forEach((span, operationId) => {
      this.log(`Cleaning up orphaned span: ${operationId}`);
      span.end();
    });
    this.activeSpans.clear();
  }
}

/**
 * Initialize Faro performance tracking integration for dashboard scenes
 * This connects the ScenePerformanceTracker to Faro for distributed tracing
 */
export function initializeFaroPerformanceIntegration(): () => void {
  // Only initialize if Faro is enabled
  if (!config.grafanaJavascriptAgent.enabled) {
    return () => {};
  }

  // Get tracker and create observer
  const tracker = performanceUtils.getScenePerformanceTracker();
  const faroObserver = new FaroTracingObserver();

  // Register the Faro observer
  const unsubscribe = tracker.addObserver(faroObserver);

  logInfo('[FaroPerformanceIntegration] Initialized - dashboard performance traces will be sent to Faro');

  // Return cleanup function
  return () => {
    unsubscribe();
    faroObserver.cleanup();
    logInfo('[FaroPerformanceIntegration] Cleaned up');
  };
}

// Auto-initialize on module load
let cleanupFn: (() => void) | null = null;

export function setupFaroPerformanceIntegration(): void {
  if (cleanupFn) {
    cleanupFn();
  }
  cleanupFn = initializeFaroPerformanceIntegration();
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = null;
    }
  });
}
