import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Card, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

// Import JSON data files
import alertsByCategoryData from './noise-data/alerts-by-category.json';
import alertsToFixData from './noise-data/alerts-to-fix.json';
import fatigueTrendData from './noise-data/fatigue-trend.json';
import timeline24hData from './noise-data/timeline-24h.json';
import topNoiseSourcesData from './noise-data/top-noise-sources.json';

export default function AlertNoise() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={3}>
      {/* Alerts to Fix */}
      <Card className={styles.chartCard} noMargin>
        <Card.Heading>
          <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" gap={1} alignItems="center">
              <Icon name="wrench" />
              <Text variant="h5">
                <Trans i18nKey="alerting.alert-noise.alerts-to-fix.title">
                  Alerts to Fix (Stack-Ranked by Impact)
                </Trans>
              </Text>
            </Stack>
            <Badge
              text={t(
                'alerting.alert-noise.alerts-to-fix.badge',
                'Potential {{reduction}}% fatigue reduction',
                { reduction: alertsToFixData.totalReduction }
              )}
              color="blue"
            />
          </Stack>
        </Card.Heading>
        <Card.Description className={styles.alertsToFixList}>
        <AlertsToFixList data={alertsToFixData} />
        </Card.Description>
      </Card>

      {/* Alert Fatigue Trend Chart */}
      <Card className={styles.chartCard} noMargin>
        <Card.Heading>
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="chart-line" />
            <Text variant="h5">
              <Trans i18nKey="alerting.alert-noise.fatigue-trend.title">Alert Fatigue Trend</Trans>
            </Text>
          </Stack>
        </Card.Heading>
        <Card.Description>
        <FatigueTrendChart data={fatigueTrendData} />
        </Card.Description>
      </Card>

      {/* Metrics Cards */}
      <Stack direction="row" gap={2}>
        <MetricCard
          icon="exclamation-circle"
          title={t('alerting.alert-noise.metrics.current-weekly', 'Current Weekly Alerts')}
          value={fatigueTrendData.metrics.currentWeeklyAlerts.toLocaleString()}
          color="red"
        />
        <MetricCard
          icon="chart-line"
          title={t('alerting.alert-noise.metrics.projected-weekly', 'Projected Weekly Alerts')}
          value={fatigueTrendData.metrics.projectedWeeklyAlerts.toLocaleString()}
          color="blue"
        />
        <MetricCard
          icon="arrow-down"
          title={t('alerting.alert-noise.metrics.potential-reduction', 'Potential Reduction')}
          value={`${fatigueTrendData.metrics.potentialReduction}%`}
          color="cyan"
        />
      </Stack>

      {/* Timeline Chart */}
      <Card className={styles.chartCard} noMargin>
        <Card.Heading>
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="clock-nine" />
            <Text variant="h5">
              <Trans i18nKey="alerting.alert-noise.timeline.title">Timeline of When Alerts Fired (Last 24h)</Trans>
            </Text>
          </Stack>
        </Card.Heading>
        <Card.Description>
        <TimelineChart data={timeline24hData} />
        </Card.Description>
      </Card>

      {/* Bottom Row: Top Sources and Category Breakdown */}
      <Stack direction="row" gap={2}>
        <div className={styles.halfWidth}>
          <Card className={styles.chartCard} noMargin>
            <Card.Heading>
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="fire" />
                <Text variant="h5">
                  <Trans i18nKey="alerting.alert-noise.top-sources.title">Top 10 Sources of Noise</Trans>
                </Text>
              </Stack>
            </Card.Heading>
            <TopNoiseSourcesList data={topNoiseSourcesData} />
          </Card>
                </div>
        <div className={styles.halfWidth}>
          <Card className={styles.chartCard} noMargin>
            <Card.Heading>
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="info-circle" />
                <Text variant="h5">
                  <Trans i18nKey="alerting.alert-noise.categories.title">Alerts by Category</Trans>
                </Text>
              </Stack>
            </Card.Heading>
            <Card.Description>
            <AlertsByCategoryChart data={alertsByCategoryData} />
            </Card.Description>
          </Card>
        </div>
      </Stack>

      {/* Bottom Timeline */}
      <Card className={styles.chartCard} noMargin>
        <Card.Heading>
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="clock-nine" />
            <Text variant="h5">
              <Trans i18nKey="alerting.alert-noise.timeline.title">Timeline of When Alerts Fired (Last 24h)</Trans>
            </Text>
          </Stack>
        </Card.Heading>
        <Card.Description>
        <TimelineChart data={timeline24hData} />
        </Card.Description>
      </Card>
    </Stack>
  );
}

// Chart Components

interface FatigueTrendChartProps {
  data: typeof fatigueTrendData;
}

function FatigueTrendChart({ data }: FatigueTrendChartProps) {
  const styles = useStyles2(getStyles);

  // Find the max value for scaling
  const maxValue = Math.max(
    ...data.current.map((d) => d.value),
    ...data.projected.map((d) => d.value)
  );

  const chartHeight = 300;
  const chartWidth = 1200;
  const padding = { top: 20, right: 40, bottom: 40, left: 60 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const xScale = (week: number) => padding.left + ((week - 1) / 11) * graphWidth;
  const yScale = (value: number) => padding.top + graphHeight - (value / maxValue) * graphHeight;

  // Create path for current trend line
  const currentPath = data.current
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${xScale(point.week)} ${yScale(point.value)}`)
    .join(' ');

  // Create path for projected trend line
  const projectedPath = data.projected
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${xScale(point.week)} ${yScale(point.value)}`)
    .join(' ');

  return (
    <div className={styles.chartContainer}>
      <Stack direction="row" gap={2} justifyContent="flex-end">
        <Stack direction="row" gap={1} alignItems="center">
          <div className={styles.legendDot} style={{ backgroundColor: '#FF6B6B' }} />
          <Text variant="bodySmall">
            <Trans i18nKey="alerting.alert-noise.fatigue-trend.current">Current Fatigue</Trans>
          </Text>
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <div className={styles.legendDot} style={{ backgroundColor: '#4ECDC4' }} />
          <Text variant="bodySmall">
            <Trans i18nKey="alerting.alert-noise.fatigue-trend.projected">Projected (After Fixes)</Trans>
          </Text>
        </Stack>
      </Stack>

      <svg width={chartWidth} height={chartHeight} className={styles.svg}>
        {/* Y-axis grid lines */}
        {[0, 3000, 6000, 9000, 12000].map((value) => (
          <g key={value}>
            <line
              x1={padding.left}
              y1={yScale(value)}
              x2={chartWidth - padding.right}
              y2={yScale(value)}
              stroke="#444"
              strokeWidth="1"
              opacity="0.2"
            />
            <text x={padding.left - 10} y={yScale(value) + 4} textAnchor="end" fill="#999" fontSize="12">
              {value}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {Array.from({ length: 12 }, (_, i) => i + 1).map((week) => (
            <text
              key={week}
              x={xScale(week)}
              y={chartHeight - padding.bottom + 20}
              textAnchor="middle"
              fill="#999"
              fontSize="12"
            >
              <Trans i18nKey="alerting.alert-noise.fatigue-trend.week">Week {{ week }}</Trans>{' '}
              {week === 7 ? <Trans i18nKey="alerting.alert-noise.fatigue-trend.now">(Now)</Trans> : ''}
            </text>
        ))}

        {/* Y-axis label */}
        <text
          x={padding.left - 45}
          y={chartHeight / 2}
          textAnchor="middle"
          fill="#999"
          fontSize="12"
          transform={`rotate(-90, ${padding.left - 45}, ${chartHeight / 2})`}
        >
          <Trans i18nKey="alerting.alert-noise.fatigue-trend.y-axis">Alert Fires per Week</Trans>
        </text>

        {/* Current trend line */}
        <path d={currentPath} fill="none" stroke="#FF6B6B" strokeWidth="3" />

        {/* Projected trend line (dashed) */}
        <path d={projectedPath} fill="none" stroke="#4ECDC4" strokeWidth="3" strokeDasharray="5,5" />

        {/* Data points for current */}
        {data.current.map((point) => (
          <circle key={`current-${point.week}`} cx={xScale(point.week)} cy={yScale(point.value)} r="5" fill="#FF6B6B" />
        ))}

        {/* Data points for projected */}
        {data.projected.map((point) => (
          <circle
            key={`projected-${point.week}`}
            cx={xScale(point.week)}
            cy={yScale(point.value)}
            r="5"
            fill="#4ECDC4"
          />
        ))}
      </svg>
    </div>
  );
}

interface MetricCardProps {
  icon: 'exclamation-circle' | 'chart-line' | 'arrow-down';
  title: string;
  value: string;
  color: 'red' | 'blue' | 'cyan';
}

function MetricCard({ icon, title, value, color }: MetricCardProps) {
  const styles = useStyles2(getStyles);
  const colorMap = {
    red: '#FF6B6B',
    blue: '#4ECDC4',
    cyan: '#45B7D1',
  };

  return (
    <Card className={styles.metricCard} noMargin>
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1} alignItems="center">
          <div style={{ color: colorMap[color] }}>
            <Icon name={icon} />
          </div>
          <Text variant="bodySmall" color="secondary">
            {title}
          </Text>
        </Stack>
        <div style={{ color: colorMap[color] }}>
          <Text variant="h3">{value}</Text>
        </div>
      </Stack>
    </Card>
  );
}

interface TimelineChartProps {
  data: typeof timeline24hData;
}

function TimelineChart({ data }: TimelineChartProps) {
  const styles = useStyles2(getStyles);

  const maxValue = Math.max(
    ...data.timeline.map(
      (d) => (d.infrastructure || 0) + (d.application || 0) + (d.database || 0) + (d.network || 0)
    )
  );

  const chartHeight = 200;
  const chartWidth = 1200;
  const padding = { top: 20, right: 40, bottom: 60, left: 60 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const barWidth = graphWidth / data.timeline.length;

  return (
    <div className={styles.chartContainer}>
      <svg width={chartWidth} height={chartHeight} className={styles.svg}>
        {data.timeline.map((item, index) => {
          const x = padding.left + index * barWidth;
            let currentY = padding.top + graphHeight;

          // Stack bars from bottom to top
          const bars = [
            { value: item.network, color: '#45B7D1' },
            { value: item.database, color: '#9B59B6' },
            { value: item.application, color: '#4ECDC4' },
            { value: item.infrastructure, color: '#FF6B6B' },
          ];

          return (
            <g key={item.hour}>
              {bars.map((bar, barIndex) => {
                const height = (bar.value / maxValue) * graphHeight;
                currentY -= height;
                const y = currentY;

                return (
                  <rect
                    key={barIndex}
                    x={x + 5}
                    y={y}
                    width={barWidth - 10}
                    height={height}
                    fill={bar.color}
                    opacity="0.9"
                  />
                );
              })}

              {/* X-axis label */}
              <text x={x + barWidth / 2} y={chartHeight - padding.bottom + 20} textAnchor="middle" fill="#999" fontSize="12">
                {item.hour}
              </text>
            </g>
          );
        })}
      </svg>

      <Stack direction="row" gap={2} justifyContent="center">
        <Text variant="bodySmall">
          <Trans i18nKey="alerting.alert-noise.timeline.peak-text">
            Peak: {{ count: data.peak.count }} alerts at {{ time: data.peak.time }}
          </Trans>
        </Text>
        <Stack direction="row" gap={2}>
          <Stack direction="row" gap={1} alignItems="center">
            <div className={styles.legendDot} style={{ backgroundColor: '#FF6B6B' }} />
            <Text variant="bodySmall">
              <Trans i18nKey="alerting.alert-noise.timeline.infrastructure">Infrastructure</Trans>
            </Text>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            <div className={styles.legendDot} style={{ backgroundColor: '#4ECDC4' }} />
            <Text variant="bodySmall">
              <Trans i18nKey="alerting.alert-noise.timeline.application">Application</Trans>
            </Text>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            <div className={styles.legendDot} style={{ backgroundColor: '#9B59B6' }} />
            <Text variant="bodySmall">
              <Trans i18nKey="alerting.alert-noise.timeline.database">Database</Trans>
            </Text>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center">
            <div className={styles.legendDot} style={{ backgroundColor: '#45B7D1' }} />
            <Text variant="bodySmall">
              <Trans i18nKey="alerting.alert-noise.timeline.network">Network</Trans>
            </Text>
          </Stack>
        </Stack>
      </Stack>
    </div>
  );
}

interface AlertsToFixListProps {
  data: typeof alertsToFixData;
}

function AlertsToFixList({ data }: AlertsToFixListProps) {
  const styles = useStyles2(getStyles);

  const actionColors: Record<string, 'blue' | 'red' | 'green' | 'orange' | 'purple' | 'darkgrey' | 'brand'> = {
    Refine: 'blue',
    Delete: 'red',
    Dedupe: 'orange',
  };

  return (
    <Stack direction="column" gap={2}>
      {data.alerts.map((alert) => (
        <Card key={alert.id} className={styles.alertCard} noMargin>
          <Card.Description>
          <Stack direction="row" gap={2} alignItems="flex-start" justifyContent="space-between">
            <Stack direction="row" gap={2} alignItems="flex-start" grow={1}>
              <div className={styles.alertRank}>{alert.id}</div>
              <Stack direction="column" gap={1} grow={1}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Text variant="h6">{alert.name}</Text>
                  <Badge text={alert.action} color={actionColors[alert.action]} />
                </Stack>
                <Text variant="bodySmall" color="secondary">
                  {alert.description}
                </Text>
                <Stack direction="row" gap={2} alignItems="center">
                  <Stack direction="row" gap={1} alignItems="center">
                    <Icon name="exclamation-circle" size="sm" />
                    <Text variant="bodySmall">
                      <Trans i18nKey="alerting.alert-noise.alerts-to-fix.fires-per-week">
                        {{ fires: alert.firesPerWeek }} fires/week
                      </Trans>
                    </Text>
                  </Stack>
                  <Stack direction="row" gap={1} alignItems="center">
                    <div style={{ color: '#4ECDC4' }}>
                      <Icon name="arrow-down" size="sm" />
                    </div>
                    <div style={{ color: '#4ECDC4' }}>
                      <Text variant="bodySmall">
                        <Trans i18nKey="alerting.alert-noise.alerts-to-fix.reduction">
                          {{ reduction: alert.fatigueReduction }}% team fatigue reduction
                        </Trans>
                      </Text>
                    </div>
                  </Stack>
                </Stack>
              </Stack>
            </Stack>
            <Button variant="secondary" size="sm" icon="comment-alt-share">
              <Trans i18nKey="alerting.alert-noise.alerts-to-fix.ask-assistant">Ask Assistant</Trans>
            </Button>
          </Stack>
          </Card.Description>
        </Card>
      ))}
    </Stack>
  );
}

interface TopNoiseSourcesListProps {
  data: typeof topNoiseSourcesData;
}

function TopNoiseSourcesList({ data }: TopNoiseSourcesListProps) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={1}>
      {/* Header Row */}
      <Stack direction="row" gap={2} alignItems="center">
        <div className={styles.sourceRank} />
        <div className={styles.sourceName} />
        <div className={styles.sparklineContainer}>
          <Stack direction="row" gap={2} justifyContent="space-around">
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.alert-noise.top-sources.past">Past</Trans>
            </Text>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.alert-noise.top-sources.current">Current</Trans>
            </Text>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.alert-noise.top-sources.future">Future</Trans>
            </Text>
          </Stack>
        </div>
        <div className={styles.sourceFires} />
        <div className={styles.sourceReduction} />
      </Stack>

      {/* Data Rows */}
      {data.sources.map((source, index) => (
        <Stack key={source.id} direction="row" gap={2} alignItems="center">
          <div className={styles.sourceRank}>
            <Text variant="bodySmall" color="secondary">
              #{index + 1}
            </Text>
          </div>
          <div className={styles.sourceName}>
            <Text variant="bodySmall">{source.displayName}</Text>
          </div>
          <div className={styles.sparklineContainer}>
            <Sparkline data={source.trend} />
          </div>
          <div className={styles.sourceFires}>
            <Text variant="bodySmall">{source.currentFires}</Text>
          </div>
          <div className={styles.sourceReduction}>
            <Stack direction="row" gap={0} alignItems="center">
              <div style={{ color: '#4ECDC4' }}>
                <Icon name="arrow-down" size="sm" />
              </div>
              <div style={{ color: '#4ECDC4' }}>
                <Text variant="bodySmall">{source.reduction}%</Text>
              </div>
            </Stack>
          </div>
        </Stack>
      ))}
    </Stack>
  );
}

interface SparklineProps {
  data: number[];
}

function Sparkline({ data }: SparklineProps) {
  const styles = useStyles2(getStyles);
  const width = 120;
  const height = 30;
  const padding = 2;

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
    return { x, y };
  });

  // Split into three sections: past (red), current (orange), future (blue)
  const pastPoints = points.slice(0, 4);
  const currentPoints = points.slice(3, 8);
  const futurePoints = points.slice(7);

  const createPath = (pts: typeof points) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg width={width} height={height} className={styles.sparkline}>
      <path d={createPath(pastPoints)} fill="none" stroke="#FF6B6B" strokeWidth="2" />
      <path d={createPath(currentPoints)} fill="none" stroke="#FF9F40" strokeWidth="2" />
      <path d={createPath(futurePoints)} fill="none" stroke="#4ECDC4" strokeWidth="2" />
    </svg>
  );
}

interface AlertsByCategoryChartProps {
  data: typeof alertsByCategoryData;
}

function AlertsByCategoryChart({ data }: AlertsByCategoryChartProps) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={2}>
      {data.categories.map((category) => (
        <Stack key={category.name} direction="column" gap={0.5}>
          <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" gap={1} alignItems="center">
              <div className={styles.legendDot} style={{ backgroundColor: category.color }} />
              <Text variant="bodySmall">{category.name}</Text>
            </Stack>
            <Text variant="bodySmall">
              {category.count} ({category.percentage}%)
            </Text>
          </Stack>
          <div className={styles.categoryBar}>
            <div
              className={styles.categoryBarFill}
              style={{
                width: `${category.percentage}%`,
                backgroundColor: category.color,
              }}
            />
          </div>
        </Stack>
      ))}

      <div className={styles.totalAlerts}>
        <Stack direction="row" justifyContent="space-between">
          <Text variant="h6">
            <Trans i18nKey="alerting.alert-noise.categories.total">Total Alerts</Trans>
          </Text>
          <Text variant="h6">{data.total.toLocaleString()}</Text>
        </Stack>
      </div>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  chartCard: css({
    padding: theme.spacing(2),
  }),
  chartContainer: css({
    padding: theme.spacing(2),
    width: '100%',
    overflowX: 'auto',
  }),
  svg: css({
    display: 'block',
  }),
  legendDot: css({
    width: '12px',
    height: '12px',
    borderRadius: theme.shape.radius.circle,
  }),
  metricCard: css({
    flex: 1,
    padding: theme.spacing(2),
  }),
  metricValue: css({
    display: 'inline',
  }),
  alertCard: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
    h2: css({
      display: 'none',
    }),
  }),
  alertRank: css({
    width: theme.spacing(4),
    height: theme.spacing(4),
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.background.canvas,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: theme.typography.fontWeightBold,
    flexShrink: 0,
  }),
  halfWidth: css({
    flex: 1,
  }),
  sourceRank: css({
    width: theme.spacing(4),
    flexShrink: 0,
  }),
  sourceName: css({
    width: '80px',
    flexShrink: 0,
  }),
  sparklineContainer: css({
    flex: 1,
  }),
  sourceFires: css({
    width: '60px',
    textAlign: 'right',
    flexShrink: 0,
    color: theme.colors.warning.text,
  }),
  sourceReduction: css({
    width: '60px',
    flexShrink: 0,
  }),
  sparkline: css({
    display: 'block',
  }),
  categoryBar: css({
    width: '100%',
    height: theme.spacing(3),
    backgroundColor: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  categoryBarFill: css({
    height: '100%',
  }),
  totalAlerts: css({
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `2px solid ${theme.colors.border.medium}`,
  }),
  alertsToFixList: css({
    marginTop: '10px',
    padding: theme.spacing(2),
  }),
});
