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

// @TODO: revisit + options
// --- Panel configs ---
const PANEL_CONFIGS = {
  stat: {
    options: {
      reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '' },
      orientation: 'auto',
      textMode: 'auto',
      colorMode: 'value',
      graphMode: 'area',
      justifyMode: 'auto',
    },
  },
  timeseries: {
    options: {
      legend: { displayMode: 'list', placement: 'bottom' },
      tooltip: { mode: 'single', sort: 'none' },
    },
  },
  heatmap: {
    options: {
      legend: { displayMode: 'list', placement: 'bottom' },
      tooltip: { mode: 'single', sort: 'none' },
    },
  },
  geomap: {
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
  },
  barchart: {
    options: {
      orientation: 'auto',
      legend: { displayMode: 'list', placement: 'bottom' },
      tooltip: { mode: 'single', sort: 'none' },
    },
  },
  piechart: {
    options: {
      legend: { displayMode: 'list', placement: 'right', showLegend: true, values: ['percent'] },
      tooltip: { mode: 'single', sort: 'none' },
      pieType: 'pie',
      reduceOptions: { calcs: ['mean'], fields: '', values: false },
      showLegend: true,
      strokeWidth: 1,
    },
  },
  table: {
    options: {
      showHeader: true,
      sortBy: [],
    },
  },
  logs: {
    options: {
      showTime: false,
      showLabels: false,
      showCommonLabels: false,
      wrapLogMessage: false,
      prettifyLogMessage: false,
      enableLogDetails: true,
      dedupStrategy: 'none',
    },
  },
  gauge: {
    options: {
      orientation: 'auto',
      reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '' },
      showThresholdLabels: false,
      showThresholdMarkers: true,
    },
  },
} as const;

const hasLocationFields = (data: PanelData): boolean => {
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
};

const hasGeographicalContextData = (data: PanelData): boolean => {
  if (!data || !data.series || data.series.length === 0) {
    return false;
  }

  const geographicalKeywords = ['lat', 'lon', 'latitude', 'longitude', 'country', 'city', 'region', 'state'];

  return data.series.some((series) => {
    const hasCoordinates = series.fields.some(
      (field) =>
        field.name.toLowerCase().includes('lat') ||
        field.name.toLowerCase().includes('lon') ||
        field.name.toLowerCase().includes('latitude') ||
        field.name.toLowerCase().includes('longitude')
    );
    const hasGeographicalNames = series.fields.some((field) =>
      geographicalKeywords.some((keyword) => field.name.toLowerCase().includes(keyword))
    );

    return hasCoordinates || hasGeographicalNames;
  });
};

interface DataProfile {
  fieldCount: number;
  hasHighCardinality: boolean;
  hasLowCardinality: boolean;
  hasNullValues: boolean;
  fieldTypes: string[];
  fieldNames: string[];
  seriesCount: number;
}

const analyzeDataCharacteristics = (data?: PanelData): DataProfile => {
  if (!data || !data.series || data.series.length === 0) {
    return {
      fieldCount: 0,
      hasHighCardinality: false,
      hasLowCardinality: false,
      hasNullValues: false,
      fieldTypes: [],
      fieldNames: [],
      seriesCount: 0,
    };
  }

  const series = data.series[0];
  const fields = series.fields || [];

  let hasHighCardinality = false;
  let hasLowCardinality = false;
  let hasNullValues = false;

  fields.forEach((field) => {
    if (field.values && field.values.length > 0) {
      const uniqueValues = new Set(field.values.toArray()).size;
      const totalValues = field.values.length;

      if (field.values.toArray().some((v) => v == null)) {
        hasNullValues = true;
      }

      // cardinality
      const uniqueRatio = uniqueValues / totalValues;
      if (uniqueRatio > 0.8) {
        hasHighCardinality = true;
      } else if (uniqueRatio < 0.1) {
        hasLowCardinality = true;
      }
    }
  });

  return {
    fieldCount: fields.length,
    hasHighCardinality,
    hasLowCardinality,
    hasNullValues,
    fieldTypes: fields.map((f) => f.type.toString()),
    fieldNames: fields.map((f) => f.name),
    seriesCount: data.series.length,
  };
};

function addSmartSuggestions(builder: VisualizationSuggestionsBuilder) {
  const { dataSummary: ds } = builder;
  const hasLocationData = builder.data ? hasLocationFields(builder.data) : false;

  const dataProfile = analyzeDataCharacteristics(builder.data);

  if (hasLocationData && ds.hasNumberField && !ds.hasTimeField && builder.data) {
    const hasGeographicalContext = hasGeographicalContextData(builder.data);
    if (hasGeographicalContext) {
      const geomapList = builder.getListAppender<{}, {}>({
        name: t('smart-suggestions.geomap', 'Geomap'),
        pluginId: 'geomap',
        options: PANEL_CONFIGS.geomap.options,
        fieldConfig: {
          defaults: { color: { mode: 'palette-classic' }, custom: {} },
          overrides: [],
        },
        score: VisualizationSuggestionScore.Best,
      });
      geomapList.append({
        description: t(
          'smart-suggestions.geomap-description',
          'Perfect for visualizing geographical data and location-based metrics'
        ),
      });
    }
  }

  if (ds.hasTimeField && ds.hasNumberField) {
    const timeSeriesList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.time-series', 'Time Series'),
      pluginId: 'timeseries',
      options: PANEL_CONFIGS.timeseries.options,
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.Best,
    });

    const timeDescription =
      dataProfile.fieldCount > 3
        ? t('smart-suggestions.time-series-multi-description', 'Excellent for tracking multiple metrics over time')
        : t('smart-suggestions.time-series-description', 'Ideal for visualizing trends and patterns over time');

    timeSeriesList.append({
      description: timeDescription,
    });

    if (ds.frameCount === 1 && ds.fieldCount >= 2) {
      const statList = builder.getListAppender<{}, {}>({
        name: t('smart-suggestions.stat-panel', 'Current Values'),
        pluginId: 'stat',
        options: PANEL_CONFIGS.stat.options,
        fieldConfig: {
          defaults: { color: { mode: 'palette-classic' }, custom: {} },
          overrides: [],
        },
        score: VisualizationSuggestionScore.Good,
      });
      statList.append({
        description: t('smart-suggestions.stat-panel-description', 'Display the latest values from your time series'),
      });
    }

    const heatmapList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.heatmap', 'Heatmap'),
      pluginId: 'heatmap',
      options: PANEL_CONFIGS.heatmap.options,
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.OK,
    });
    heatmapList.append({
      description: t('smart-suggestions.heatmap-description', 'Discover patterns and correlations in time-based data'),
    });
  }

  if (ds.hasStringField && ds.hasNumberField && !ds.hasTimeField) {
    const barChartList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.bar-chart', 'Bar Chart'),
      pluginId: 'barchart',
      options: PANEL_CONFIGS.barchart.options,
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.Best,
    });

    const barDescription = dataProfile.hasLowCardinality
      ? t(
          'smart-suggestions.bar-chart-low-cardinality-description',
          'Perfect for comparing values across your categories'
        )
      : t('smart-suggestions.bar-chart-description', 'Excellent for comparing values across categories');

    barChartList.append({
      description: barDescription,
    });

    const pieScore =
      dataProfile.hasLowCardinality && dataProfile.fieldCount <= 6
        ? VisualizationSuggestionScore.Good
        : VisualizationSuggestionScore.OK;

    const pieChartList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.pie-chart', 'Pie Chart'),
      pluginId: 'piechart',
      options: PANEL_CONFIGS.piechart.options,
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: pieScore,
    });

    const pieDescription = dataProfile.hasLowCardinality
      ? t('smart-suggestions.pie-chart-description', 'Perfect for showing proportions and percentages')
      : t('smart-suggestions.pie-chart-fallback-description', 'Show data distribution as proportions');

    pieChartList.append({
      description: pieDescription,
    });
  }

  if (ds.hasNumberField && !ds.hasTimeField && !ds.hasStringField) {
    const statNumericalList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.stat-panel-numerical', 'Key Metrics'),
      pluginId: 'stat',
      options: PANEL_CONFIGS.stat.options,
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.Best,
    });

    const statDescription =
      dataProfile.fieldCount === 1
        ? t('smart-suggestions.stat-single-description', 'Perfect for highlighting your key metric')
        : t('smart-suggestions.stat-panel-numerical-description', 'Display your most important numerical values');

    statNumericalList.append({
      description: statDescription,
    });

    if (dataProfile.fieldCount === 1) {
      const gaugeList = builder.getListAppender<{}, {}>({
        name: t('smart-suggestions.gauge', 'Gauge'),
        pluginId: 'gauge',
        options: PANEL_CONFIGS.gauge.options,
        fieldConfig: {
          defaults: { color: { mode: 'palette-classic' }, custom: {} },
          overrides: [],
        },
        score: VisualizationSuggestionScore.Good,
      });
      gaugeList.append({
        description: t('smart-suggestions.gauge-description', 'Show progress towards goals with visual thresholds'),
      });
    }
  }

  const tableScore =
    dataProfile.hasHighCardinality || dataProfile.fieldCount > 5
      ? VisualizationSuggestionScore.Best
      : VisualizationSuggestionScore.Good;

  const tableList = builder.getListAppender<{}, {}>({
    name: t('smart-suggestions.table', 'Table'),
    pluginId: 'table',
    options: PANEL_CONFIGS.table.options,
    fieldConfig: {
      defaults: { color: { mode: 'palette-classic' }, custom: {} },
      overrides: [],
    },
    score: tableScore,
  });

  const tableDescription = dataProfile.hasHighCardinality
    ? t(
        'smart-suggestions.table-high-cardinality-description',
        'Best for exploring detailed data with many unique values'
      )
    : t('smart-suggestions.table-description', 'Comprehensive view with sorting and filtering capabilities');

  tableList.append({
    description: tableDescription,
  });

  if (ds.hasStringField && !ds.hasNumberField && !ds.hasTimeField) {
    const logsList = builder.getListAppender<{}, {}>({
      name: t('smart-suggestions.logs', 'Logs'),
      pluginId: 'logs',
      options: PANEL_CONFIGS.logs.options,
      fieldConfig: {
        defaults: { color: { mode: 'palette-classic' }, custom: {} },
        overrides: [],
      },
      score: VisualizationSuggestionScore.Good,
    });
    logsList.append({
      description: t(
        'smart-suggestions.logs-description',
        'Ideal for displaying and searching through text-based log entries'
      ),
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

export const getSmartSuggestions = (data?: PanelData): VisualizationSuggestion[] => {
  if (!data || !data.series || data.series.length === 0) {
    return [];
  }

  const builder = new VisualizationSuggestionsBuilder(data);
  addSmartSuggestions(builder);

  return builder.getList();
};
