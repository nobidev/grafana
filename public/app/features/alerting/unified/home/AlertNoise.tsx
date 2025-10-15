import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Button, Card, Icon, Stack, Text, useStyles2 } from '@grafana/ui';

// Data for the charts
const fatigueTrendData = {
  current: [
    { week: 1, value: 8500 },
    { week: 2, value: 9200 },
    { week: 3, value: 10100 },
    { week: 4, value: 10800 },
    { week: 5, value: 11300 },
    { week: 6, value: 11100 },
    { week: 7, value: 11645 },
  ],
  projected: [
    { week: 7, value: 11645 },
    { week: 8, value: 5200 },
    { week: 9, value: 3600 },
    { week: 10, value: 2500 },
    { week: 11, value: 1900 },
    { week: 12, value: 1750 },
  ],
  metrics: {
    currentWeeklyAlerts: 11645,
    projectedWeeklyAlerts: 1750,
    potentialReduction: 85,
  },
};

const timeline24hData = {
  timeline: [
    { hour: '00:00', infrastructure: 42, application: 18, database: 12, network: 8 },
    { hour: '03:00', infrastructure: 45, application: 20, database: 14, network: 9 },
    { hour: '06:00', infrastructure: 48, application: 22, database: 15, network: 10 },
    { hour: '09:00', infrastructure: 85, application: 42, database: 28, network: 18 },
    { hour: '12:00', infrastructure: 102, application: 58, database: 42, network: 32 },
    { hour: '15:00', infrastructure: 95, application: 52, database: 38, network: 28 },
    { hour: '18:00', infrastructure: 78, application: 38, database: 30, network: 20 },
    { hour: '21:00', infrastructure: 55, application: 25, database: 18, network: 12 },
  ],
  peak: {
    time: '12:00',
    count: 234,
  },
};

const alertsToFixData = {
  alerts: [
    {
      id: 1,
      name: 'cpu_usage_higher_than_90',
      action: 'Refine',
      actionColor: 'blue',
      description: 'Adjust threshold to 95% and add 5-min sustained period',
      firesPerWeek: 8314,
      fatigueReduction: 85,
    },
    {
      id: 2,
      name: 'Golden IRM Demo - 963',
      action: 'Delete',
      actionColor: 'red',
      description: 'Demo environment alert no longer needed',
      firesPerWeek: 1452,
      fatigueReduction: 72,
    },
    {
      id: 3,
      name: '[success-rate] frontend',
      action: 'Dedupe',
      actionColor: 'orange',
      description: 'Merge with [latency] frontend-prod into single SLO alert',
      firesPerWeek: 209,
      fatigueReduction: 45,
    },
    {
      id: 4,
      name: '[latency] frontend-prod',
      action: 'Dedupe',
      actionColor: 'orange',
      description: 'Consolidate with success-rate alert',
      firesPerWeek: 92,
      fatigueReduction: 38,
    },
    {
      id: 5,
      name: 'Ops Cluster Error log rate',
      action: 'Refine',
      actionColor: 'blue',
      description: 'Filter out known benign errors from counting',
      firesPerWeek: 76,
      fatigueReduction: 65,
    },
  ],
  totalReduction: 85,
};

const topNoiseSourcesData = {
  sources: [
    {
      id: 1,
      name: 'cpu_usage_higher_than_90',
      displayName: 'cpu_us...',
      currentFires: 8314,
      reduction: 85,
      trend: [180, 175, 185, 190, 195, 185, 180, 165, 150, 135, 120, 95],
    },
    {
      id: 2,
      name: 'Golden IRM Demo - 963',
      displayName: 'Golden...',
      currentFires: 1452,
      reduction: 72,
      trend: [35, 32, 38, 40, 42, 38, 35, 28, 22, 18, 12, 8],
    },
    {
      id: 3,
      name: '[success-rate] frontend',
      displayName: '[succe...',
      currentFires: 209,
      reduction: 45,
      trend: [8, 7, 9, 10, 11, 10, 9, 7, 6, 5, 4, 3],
    },
    {
      id: 4,
      name: '[latency] frontend-prod',
      displayName: '[latenc...',
      currentFires: 92,
      reduction: 38,
      trend: [4, 3, 5, 5, 6, 5, 4, 3, 3, 2, 2, 1],
    },
    {
      id: 5,
      name: 'Ops Cluster Error log rate',
      displayName: 'Ops Cl...',
      currentFires: 76,
      reduction: 65,
      trend: [3, 2, 3, 4, 4, 3, 3, 2, 2, 2, 1, 1],
    },
    {
      id: 6,
      name: 'webinar_pipeline_failure',
      displayName: 'webina...',
      currentFires: 62,
      reduction: 55,
      trend: [2, 2, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1],
    },
    {
      id: 7,
      name: 'disk_usage_critical',
      displayName: 'disk_u...',
      currentFires: 58,
      reduction: 48,
      trend: [2, 2, 2, 3, 3, 2, 2, 2, 1, 1, 1, 1],
    },
    {
      id: 8,
      name: 'memory_leak_detection',
      displayName: 'memor...',
      currentFires: 47,
      reduction: 52,
      trend: [2, 1, 2, 2, 3, 2, 2, 1, 1, 1, 1, 0],
    },
    {
      id: 9,
      name: 'network_packet_loss',
      displayName: 'networ...',
      currentFires: 39,
      reduction: 41,
      trend: [1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 0, 0],
    },
    {
      id: 10,
      name: 'database_connection_pool',
      displayName: 'databa...',
      currentFires: 31,
      reduction: 36,
      trend: [1, 1, 1, 2, 2, 1, 1, 1, 1, 0, 0, 0],
    },
  ],
};

const alertsByCategoryData = {
  categories: [
    {
      name: 'Infrastructure',
      count: 3421,
      percentage: 45,
      color: '#FF6B6B',
    },
    {
      name: 'Application',
      count: 2156,
      percentage: 28,
      color: '#4ECDC4',
    },
    {
      name: 'Database',
      count: 1234,
      percentage: 16,
      color: '#9B59B6',
    },
    {
      name: 'Network',
      count: 834,
      percentage: 11,
      color: '#45B7D1',
    },
  ],
  total: 7645,
};

export default function AlertNoise() {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={3}>
      {/* Alert Fatigue Trend Chart */}
      <Card className={styles.chartCard}>
        <Card.Heading>
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="chart-line" />
            <Text variant="h5">
              <Trans i18nKey="alerting.alert-noise.fatigue-trend.title">Alert Fatigue Trend</Trans>
            </Text>
          </Stack>
        </Card.Heading>
        <FatigueTrendChart data={fatigueTrendData} />
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
      <Card className={styles.chartCard}>
        <Card.Heading>
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="clock-nine" />
            <Text variant="h5">
              <Trans i18nKey="alerting.alert-noise.timeline.title">Timeline of When Alerts Fired (Last 24h)</Trans>
        </Text>
          </Stack>
        </Card.Heading>
        <TimelineChart data={timeline24hData} />
      </Card>

      {/* Alerts to Fix */}
      <Card className={styles.chartCard}>
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
        <AlertsToFixList data={alertsToFixData} />
      </Card>

      {/* Bottom Row: Top Sources and Category Breakdown */}
      <Stack direction="row" gap={2}>
        <div className={styles.halfWidth}>
          <Card className={styles.chartCard}>
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
          <Card className={styles.chartCard}>
            <Card.Heading>
              <Stack direction="row" gap={1} alignItems="center">
                <Icon name="info-circle" />
                <Text variant="h5">
                  <Trans i18nKey="alerting.alert-noise.categories.title">Alerts by Category</Trans>
                </Text>
              </Stack>
            </Card.Heading>
            <AlertsByCategoryChart data={alertsByCategoryData} />
          </Card>
        </div>
      </Stack>

      {/* Bottom Timeline */}
      <Card className={styles.chartCard}>
        <Card.Heading>
          <Stack direction="row" gap={1} alignItems="center">
            <Icon name="clock-nine" />
            <Text variant="h5">
              <Trans i18nKey="alerting.alert-noise.timeline.title">Timeline of When Alerts Fired (Last 24h)</Trans>
            </Text>
          </Stack>
        </Card.Heading>
        <TimelineChart data={timeline24hData} />
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
      <Stack direction="row" gap={2} justifyContent="flex-end" className={styles.chartLegend}>
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
            Week {week} {week === 7 ? '(Now)' : ''}
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
  icon: string;
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
    <Card className={styles.metricCard}>
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1} alignItems="center">
          <Icon name={icon as any} style={{ color: colorMap[color] }} />
          <Text variant="bodySmall" color="secondary">
            {title}
          </Text>
        </Stack>
        <Text variant="h3" style={{ color: colorMap[color] }}>
          {value}
        </Text>
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
          const total = item.infrastructure + item.application + item.database + item.network;

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

      <Stack direction="row" gap={2} justifyContent="center" className={styles.timelineLegend}>
        <Text variant="bodySmall">
          {t('alerting.alert-noise.timeline.peak', 'Peak: {{count}} alerts at {{time}}', {
            count: data.peak.count,
            time: data.peak.time,
          })}
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

  const actionColors: Record<string, string> = {
    Refine: 'blue',
    Delete: 'red',
    Dedupe: 'orange',
  };

  return (
    <Stack direction="column" gap={2}>
      {data.alerts.map((alert) => (
        <Card key={alert.id} className={styles.alertCard}>
          <Stack direction="row" gap={2} alignItems="flex-start" justifyContent="space-between">
            <Stack direction="row" gap={2} alignItems="flex-start" style={{ flex: 1 }}>
              <div className={styles.alertRank}>{alert.id}</div>
              <Stack direction="column" gap={1} style={{ flex: 1 }}>
                <Stack direction="row" gap={1} alignItems="center">
                  <Text variant="h6">{alert.name}</Text>
                  <Badge text={alert.action} color={actionColors[alert.action] as any} />
                </Stack>
                <Text variant="bodySmall" color="secondary">
                  {alert.description}
                </Text>
                <Stack direction="row" gap={2} alignItems="center">
                  <Stack direction="row" gap={1} alignItems="center">
                    <Icon name="exclamation-circle" size="sm" />
                    <Text variant="bodySmall">{alert.firesPerWeek} fires/week</Text>
                  </Stack>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Icon name="arrow-down" size="sm" style={{ color: '#4ECDC4' }} />
                    <Text variant="bodySmall" style={{ color: '#4ECDC4' }}>
                      {alert.fatigueReduction}% team fatigue reduction
                    </Text>
                  </Stack>
                </Stack>
              </Stack>
            </Stack>
            <Button variant="secondary" size="sm" icon="comment-alt-share">
              <Trans i18nKey="alerting.alert-noise.alerts-to-fix.ask-assistant">Ask Assistant</Trans>
            </Button>
          </Stack>
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
      <Stack direction="row" gap={2} alignItems="center" className={styles.noiseSourceHeader}>
        <div className={styles.sourceRank}></div>
        <div className={styles.sourceName}></div>
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
        <div className={styles.sourceFires}></div>
        <div className={styles.sourceReduction}></div>
      </Stack>

      {/* Data Rows */}
      {data.sources.map((source, index) => (
        <Stack key={source.id} direction="row" gap={2} alignItems="center" className={styles.noiseSourceRow}>
          <Text variant="bodySmall" color="secondary" className={styles.sourceRank}>
            #{index + 1}
          </Text>
          <Text variant="bodySmall" className={styles.sourceName}>
            {source.displayName}
          </Text>
          <div className={styles.sparklineContainer}>
            <Sparkline data={source.trend} />
          </div>
          <Text variant="bodySmall" className={styles.sourceFires}>
            {source.currentFires}
          </Text>
          <Stack direction="row" gap={0} alignItems="center" className={styles.sourceReduction}>
            <Icon name="arrow-down" size="sm" style={{ color: '#4ECDC4' }} />
            <Text variant="bodySmall" style={{ color: '#4ECDC4' }}>
              {source.reduction}%
            </Text>
          </Stack>
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
  const maxBarWidth = 600;

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
  chartLegend: css({
    marginBottom: theme.spacing(2),
  }),
  legendDot: css({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  }),
  timelineLegend: css({
    marginTop: theme.spacing(2),
  }),
  metricCard: css({
    flex: 1,
    padding: theme.spacing(2),
  }),
  alertCard: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.background.secondary,
  }),
  alertRank: css({
    width: theme.spacing(4),
    height: theme.spacing(4),
    borderRadius: '50%',
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
  noiseSourceHeader: css({
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    marginBottom: theme.spacing(1),
  }),
  noiseSourceRow: css({
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
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
    transition: 'width 0.3s ease',
  }),
  totalAlerts: css({
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `2px solid ${theme.colors.border.medium}`,
  }),
});
