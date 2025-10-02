import {
  PanelData,
  VisualizationSuggestion,
  VisualizationSuggestionsBuilder,
  PanelModel,
  VisualizationSuggestionScore,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

export const panelsToCheckFirst = [
  'timeseries',
  'barchart',
  'gauge',
  'stat',
  'piechart',
  'bargauge',
  'table',
  'state-timeline',
  'status-history',
  'logs',
  'candlestick',
  'flamegraph',
  'traces',
  'nodeGraph',
];

function hasLocationFields(data: PanelData): boolean {
  if (!data || !data.series || data.series.length === 0) {
    return false;
  }

  const locationKeywords = [
    'lat',
    'lon',
    'latitude',
    'longitude',
    'location',
    'country',
    'city',
    'region',
    'state',
    'address',
    'geo',
    'coord',
    'coordinates',
  ];

  return data.series.some((series) =>
    series.fields.some((field) => locationKeywords.some((keyword) => field.name.toLowerCase().includes(keyword)))
  );
}

function addSmartSuggestions(builder: VisualizationSuggestionsBuilder) {
  const { dataSummary: ds } = builder;
  const hasLocationData = builder.data ? hasLocationFields(builder.data) : false;

  if (ds.hasTimeField && ds.hasNumberField) {
    if (ds.frameCount === 1 && ds.fieldCount === 2) {
      const statList = builder.getListAppender<{}, {}>({
        name: t('smart-suggestions.stat-panel', 'Stat Panel'),
        pluginId: 'stat',
        options: {
          reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '' },
          orientation: 'auto',
          textMode: 'auto',
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto',
        },
        fieldConfig: {
          defaults: { color: { mode: 'palette-classic' }, custom: {} },
          overrides: [],
        },
      });
      statList.append({
        description: t('smart-suggestions.stat-panel-description', 'Perfect for displaying single metric values'),
      });
    }

    const timeSeriesList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.time-series', 'Time Series'),
      pluginId: 'timeseries',
      options: {
        legend: { displayMode: 'list', placement: 'bottom' },
        tooltip: { mode: 'single', sort: 'none' },
      },
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.Best,
    });
    timeSeriesList.append({
      description: t('smart-suggestions.time-series-description', 'Ideal for visualizing data over time'),
    });

    const heatmapList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.heatmap', 'Heatmap'),
      pluginId: 'heatmap',
      options: {
        legend: { displayMode: 'list', placement: 'bottom' },
        tooltip: { mode: 'single', sort: 'none' },
      },
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.OK,
    });
    heatmapList.append({
      description: t('smart-suggestions.heatmap-description', 'Great for showing patterns in time-series data'),
    });
  }

  if (hasLocationData && ds.hasNumberField) {
    const geomapList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.geomap', 'Geomap'),
      pluginId: 'geomap',
      options: {
        basemap: { type: 'default' },
        controls: {
          showZoom: true,
          showAttribution: true,
          showScale: false,
          showMeasure: false,
          showDebug: false,
        },
        layers: [],
        view: { id: 'zero', lat: 0, lon: 0, zoom: 1 },
      },
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
    });
    geomapList.append({
      description: t('smart-suggestions.geomap-description', 'Best for location-based data visualization'),
    });
  }

  if (ds.hasStringField && ds.hasNumberField) {
    const barChartList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.bar-chart', 'Bar Chart'),
      pluginId: 'barchart',
      options: {
        orientation: 'auto',
        legend: { displayMode: 'list', placement: 'bottom' },
        tooltip: { mode: 'single', sort: 'none' },
      },
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.Best,
    });
    barChartList.append({
      description: t('smart-suggestions.bar-chart-description', 'Excellent for comparing values across categories'),
    });

    const pieChartList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.pie-chart', 'Pie Chart'),
      pluginId: 'piechart',
      options: {
        legend: { displayMode: 'list', placement: 'bar' },
        tooltip: { mode: 'single', sort: 'none' },
        pieType: 'pie',
        displayLabels: ['name', 'value'],
      },
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.OK,
    });
    pieChartList.append({
      description: t('smart-suggestions.pie-chart-description', 'Perfect for showing proportions and percentages'),
    });
  }

  if (ds.hasNumberField && !ds.hasTimeField) {
    const statNumericalList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.stat-panel-numerical', 'Stat Panel'),
      pluginId: 'stat',
      options: {
        reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '' },
        orientation: 'auto',
        textMode: 'auto',
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
      },
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.Best,
    });
    statNumericalList.append({
      description: t('smart-suggestions.stat-panel-numerical-description', 'Ideal for displaying numerical values'),
    });
  }

  if (ds.hasStringField || ds.hasNumberField) {
    const tableList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.table', 'Table'),
      pluginId: 'table',
      options: {
        showHeader: true,
        sortBy: [],
      },
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.OK,
    });
    tableList.append({
      description: t('smart-suggestions.table-description', 'Comprehensive view of all your data'),
    });
  }

  if (ds.hasStringField && !ds.hasNumberField && !ds.hasTimeField) {
    const logsList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.logs', 'Logs'),
      pluginId: 'logs',
      options: {
        showTime: false,
        showLabels: false,
        showCommonLabels: false,
        wrapLogMessage: false,
        prettifyLogMessage: false,
        enableLogDetails: true,
        dedupStrategy: 'none',
      },
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
    });
    logsList.append({
      description: t('smart-suggestions.logs-description', 'Perfect for displaying text-based log data'),
    });
  }
}

export async function getAllSuggestions(data?: PanelData, panel?: PanelModel): Promise<VisualizationSuggestion[]> {
  const builder = new VisualizationSuggestionsBuilder(data, panel);

  for (const pluginId of panelsToCheckFirst) {
    const plugin = await importPanelPlugin(pluginId);
    const supplier = plugin.getSuggestionsSupplier();

    if (supplier) {
      supplier.getSuggestionsForData(builder);
    }
  }

  const list = builder.getList();

  if (builder.dataSummary.fieldCount === 0) {
    for (const plugin of Object.values(config.panels)) {
      if (!plugin.skipDataQuery || plugin.hideFromList) {
        continue;
      }

      list.push({
        name: plugin.name,
        pluginId: plugin.id,
        description: plugin.info.description,
        cardOptions: {
          imgSrc: plugin.info.logos.small,
        },
      });
    }
  }

  return list.sort((a, b) => {
    if (builder.dataSummary.preferredVisualisationType) {
      if (a.pluginId === builder.dataSummary.preferredVisualisationType) {
        return -1;
      }
      if (b.pluginId === builder.dataSummary.preferredVisualisationType) {
        return 1;
      }
    }
    return (b.score ?? VisualizationSuggestionScore.OK) - (a.score ?? VisualizationSuggestionScore.OK);
  });
}

export function getSmartSuggestions(data?: PanelData): VisualizationSuggestion[] {
  if (!data || !data.series || data.series.length === 0) {
    return [];
  }

  const builder = new VisualizationSuggestionsBuilder(data);
  addSmartSuggestions(builder);
  return builder.getList().slice(0, 4);
}
