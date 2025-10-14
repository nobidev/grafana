import { css } from '@emotion/css';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { isAssistantAvailable, OpenAssistantButton, createAssistantContextItem } from '@grafana/assistant';
import { GrafanaTheme2, PanelData, PanelModel, VisualizationSuggestion, FieldType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import config from 'app/core/config';

import { getAllSuggestions, getSmartSuggestions } from '../../state/getAllSuggestions';

import { VisualizationSuggestionCard } from './VisualizationSuggestionCard';
import { VizTypeChangeDetails } from './types';

export interface Props {
  searchQuery: string;
  onChange: (options: VizTypeChangeDetails) => void;
  data?: PanelData;
  panel?: PanelModel;
  trackSearch?: (q: string, count: number) => void;
}

export function VisualizationSuggestions({ searchQuery, onChange, data, panel, trackSearch }: Props) {
  const styles = useStyles2(getStyles);
  const [assistantEnabled, setAssistantEnabled] = useState(false);

  useEffect(() => {
    const subscription = isAssistantAvailable().subscribe((available) => {
      setAssistantEnabled(available);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { value: suggestions } = useAsync(() => getAllSuggestions(data, panel), [data, panel]);

  const [smartSuggestions, setSmartSuggestions] = useState<VisualizationSuggestion[]>([]);

  const generateSmartSuggestions = useCallback(() => {
    if (!config.featureToggles.assistantForVizSuggestions) {
      setSmartSuggestions([]);
      return;
    }

    if (!data || !data.series || data.series.length === 0) {
      setSmartSuggestions([]);
      return;
    }

    try {
      const suggestions = getSmartSuggestions(data);
      setSmartSuggestions(suggestions.slice(0, 4));
    } catch (error) {
      console.error('Error generating smart suggestions:', error);
      setSmartSuggestions([]);
    }
  }, [data]);

  useEffect(() => {
    generateSmartSuggestions();
  }, [generateSmartSuggestions]);

  const filteredSuggestions = useMemo(() => {
    const result = filterSuggestionsBySearch(searchQuery, suggestions);
    if (trackSearch) {
      trackSearch(searchQuery, result.length);
    }
    return result;
  }, [searchQuery, suggestions, trackSearch]);

  return (
    // This div is needed in some places to make AutoSizer work
    <div>
      <AutoSizer disableHeight style={{ width: '100%', height: '100%' }}>
        {({ width }) => {
          if (!width) {
            return null;
          }

          width = width - 1;
          const columnCount = Math.floor(width / 200);
          const spaceBetween = 8 * (columnCount! - 1);
          const previewWidth = Math.floor((width - spaceBetween) / columnCount!);

          return (
            <div>
              {/* Smart suggestions */}
              {config.featureToggles.assistantForVizSuggestions &&
                data &&
                data.series &&
                data.series.length > 0 &&
                panel?.datasource?.type &&
                smartSuggestions.length > 0 && (
                  <div className={styles.smartSuggestionsContainer}>
                    <div className={styles.filterRow}>
                      <div className={styles.infoText}>
                        <Trans i18nKey="panel.visualization-suggestions.enhanced-suggestions">
                          Enhanced suggestions
                        </Trans>
                      </div>
                      {assistantEnabled && (
                        <OpenAssistantButton
                          origin="grafana/smart-panel-suggestions"
                          prompt="Analyze suggestions"
                          context={[
                            createAssistantContextItem('datasource', { datasourceUid: panel?.datasource?.uid || '' }),
                            createAssistantContextItem('structured', {
                              data: {
                                series: data.series,
                                timeRange: data.timeRange,
                                query: '',
                                datasourceType: panel?.datasource?.type || '',
                              },
                            }),
                            createAssistantContextItem('structured', {
                              title: t('smart-suggestions.context-title', 'Panel suggestions analysis'),
                              data: {
                                pageType: 'panel-suggestions-analysis',
                                dashboardTitle: panel?.title || 'New dashboard',
                                dataCharacteristics: {
                                  seriesCount: data.series?.length || 0,
                                  fieldCount: data.series?.[0]?.fields?.length || 0,
                                  fieldTypes: data.series?.[0]?.fields?.map((f) => `${f.name}:${f.type}`) || [],
                                  hasTimeField:
                                    data.series?.some((s) => s.fields.some((f) => f.type === FieldType.time)) || false,
                                  hasNumberField:
                                    data.series?.some((s) => s.fields.some((f) => f.type === FieldType.number)) ||
                                    false,
                                  hasStringField:
                                    data.series?.some((s) => s.fields.some((f) => f.type === FieldType.string)) ||
                                    false,
                                  hasLocationData:
                                    data.series?.some((s) =>
                                      s.fields.some((f) =>
                                        [
                                          'lat',
                                          'lng',
                                          'latitude',
                                          'longitude',
                                          'country',
                                          'city',
                                          'location',
                                          'coordinates',
                                        ].some((geo) => f.name.toLowerCase().includes(geo))
                                      )
                                    ) || false,
                                  dataSize: data.series?.[0]?.length || 0,
                                },
                                generatedSuggestions: smartSuggestions.map((s) => ({
                                  name: s.name,
                                  pluginId: s.pluginId,
                                  description: s.description,
                                  score: s.score,
                                })),
                                analysisRequest: t(
                                  'smart-suggestions.analysis-description',
                                  'Analyze these visualization suggestions and explain which one would be best for this data. Consider the data characteristics, field types, and use cases for each visualization type.'
                                ),
                              },
                            }),
                          ]}
                          title={t('panel.visualization-suggestions.title-analyze-suggestions', 'Analyze suggestions')}
                        />
                      )}
                    </div>
                    <div
                      className={styles.grid}
                      style={{ gridTemplateColumns: `repeat(auto-fill, ${previewWidth}px)` }}
                    >
                      {smartSuggestions.map((suggestion, index) => (
                        <VisualizationSuggestionCard
                          key={`smart-${index}`}
                          data={data!}
                          suggestion={suggestion}
                          onChange={onChange}
                          width={previewWidth - 1}
                        />
                      ))}
                    </div>
                  </div>
                )}

              <div className={styles.filterRow}>
                <div className={styles.infoText}>
                  <Trans i18nKey="panel.visualization-suggestions.based-on-current-data">Based on current data</Trans>
                </div>
              </div>
              <div className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, ${previewWidth}px)` }}>
                {filteredSuggestions.map((suggestion, index) => (
                  <VisualizationSuggestionCard
                    key={index}
                    data={data!}
                    suggestion={suggestion}
                    onChange={onChange}
                    width={previewWidth - 1}
                  />
                ))}
                {searchQuery && filteredSuggestions.length === 0 && (
                  <div className={styles.infoText}>
                    <Trans i18nKey="panel.visualization-suggestions.no-results-matched-your-query">
                      No results matched your query
                    </Trans>
                  </div>
                )}
              </div>
            </div>
          );
        }}
      </AutoSizer>
    </div>
  );
}

function filterSuggestionsBySearch(
  searchQuery: string,
  suggestions?: VisualizationSuggestion[]
): VisualizationSuggestion[] {
  if (!searchQuery || !suggestions) {
    return suggestions || [];
  }

  const regex = new RegExp(searchQuery, 'i');

  return suggestions.filter((s) => regex.test(s.name) || regex.test(s.pluginId));
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      ...theme.typography.h5,
      margin: theme.spacing(0, 0.5, 1),
    }),
    smartSuggestionsContainer: css({
      marginBottom: theme.spacing(3),
      paddingBottom: theme.spacing(2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    filterRow: css({
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: '8px',
    }),
    infoText: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
    }),
    grid: css({
      display: 'grid',
      gridGap: theme.spacing(1),
      gridTemplateColumns: 'repeat(auto-fill, 144px)',
      marginBottom: theme.spacing(1),
      justifyContent: 'space-evenly',
    }),
  };
};
