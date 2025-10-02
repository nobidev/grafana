import { css } from '@emotion/css';
import { bufferCountOrTime } from 'ix/asynciterable/operators';
import { useEffect, useState } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { Trans, t } from '@grafana/i18n';
import { Badge, Card, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { ExpandedContent, HackathonTable, TableColumn } from 'app/features/browse-dashboards/hackathon14/HackathonTable';
import { useGetPopularAlerts, useGetRecentAlerts } from 'app/features/dashboard/api/popularResourcesApi';


import { useRulesFilter } from '../../hooks/useFilteredRules';
import { RuleWithOrigin, useFilteredRulesIteratorProvider } from '../hooks/useFilteredRulesIterator';
import { getApiGroupPageSize } from '../paginationLimits';

import { AlertSearchSuggestion } from './AlertSearchSuggestion';

interface AlertSearchViewProps {
  query: string;
  filters: {
    firing: boolean;
    ownedByMe: boolean;
  };
  showAllOnly?: boolean;
}

export const AlertSearchView = ({ query, filters, showAllOnly }: AlertSearchViewProps) => {
  const styles = useStyles2(getStyles);
  const { filterState } = useRulesFilter();
  const getFilteredRulesIterator = useFilteredRulesIteratorProvider();
  type AlertRow = {
    uid: string;
    title: string;
    state: string;
    folder: string;
    createdBy: string;
  };
  const [allRows, setAllRows] = useState<AlertRow[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  // Fetch real alert data from API
  const { data: popularAlerts, isLoading: popularLoading } = useGetPopularAlerts({ limit: 50, period: '30d' });
  const { data: recentAlerts, isLoading: recentLoading } = useGetRecentAlerts({ limit: 50, period: '30d' });

  const isLoading = popularLoading || recentLoading;

  // Combine popular and recent alerts, removing duplicates
  const allAlerts = [
    ...(popularAlerts?.resources || []),
    ...(recentAlerts?.resources || []).filter(
      (recent) => !popularAlerts?.resources?.some((popular) => popular.uid === recent.uid)
    ),
  ];

  // For mock structure compatibility (TODO: remove when backend provides all fields)
  const mockResults = allAlerts.map((alert) => ({
    uid: alert.uid,
    title: alert.title,
    state: 'normal', // TODO: Get from backend
    folder: t('alerting.hackathon.search.na', 'N/A'), // TODO: Get from backend  
    createdBy: t('alerting.hackathon.search.unknown', 'unknown'), // TODO: Get from backend
  }));

  // Keep original mock for fallback
  const fallbackMockResults: AlertRow[] = [
    {
      uid: '1',
      title: t('alerting.hackathon.mock.high-cpu', 'High CPU Usage Alert'),
      state: 'firing',
      folder: t('alerting.hackathon.mock.production', 'Production'),
      createdBy: t('alerting.hackathon.mock.me', 'me'),
    },
    {
      uid: '2',
      title: t('alerting.hackathon.mock.disk-space', 'Disk Space Warning'),
      state: 'normal',
      folder: t('alerting.hackathon.mock.infrastructure', 'Infrastructure'),
      createdBy: t('alerting.hackathon.mock.admin', 'admin'),
    },
    {
      uid: '3',
      title: t('alerting.hackathon.mock.api-response', 'API Response Time'),
      state: 'firing',
      folder: t('alerting.hackathon.mock.apis', 'APIs'),
      createdBy: t('alerting.hackathon.mock.me', 'me'),
    },
    {
      uid: '4',
      title: t('alerting.hackathon.mock.memory-critical', 'Memory Usage Critical'),
      state: 'firing',
      folder: t('alerting.hackathon.mock.production', 'Production'),
      createdBy: t('alerting.hackathon.mock.me', 'me'),
    },
    {
      uid: '5',
      title: t('alerting.hackathon.mock.db-connection', 'Database Connection Pool'),
      state: 'normal',
      folder: t('alerting.hackathon.mock.database', 'Database'),
      createdBy: t('alerting.hackathon.mock.me', 'me'),
    },
    {
      uid: '6',
      title: t('alerting.hackathon.mock.network-latency', 'Network Latency Alert'),
      state: 'normal',
      folder: t('alerting.hackathon.mock.infrastructure', 'Infrastructure'),
      createdBy: t('alerting.hackathon.mock.admin', 'admin'),
    },
    {
      uid: '7',
      title: t('alerting.hackathon.mock.error-rate', 'Error Rate Threshold'),
      state: 'firing',
      folder: t('alerting.hackathon.mock.apis', 'APIs'),
      createdBy: t('alerting.hackathon.mock.me', 'me'),
    },
    {
      uid: '8',
      title: t('alerting.hackathon.mock.ssl-expiring', 'SSL Certificate Expiring'),
      state: 'normal',
      folder: t('alerting.hackathon.mock.security', 'Security'),
      createdBy: t('alerting.hackathon.mock.admin', 'admin'),
    },
    {
      uid: '9',
      title: t('alerting.hackathon.mock.lb-health', 'Load Balancer Health'),
      state: 'normal',
      folder: t('alerting.hackathon.mock.infrastructure', 'Infrastructure'),
      createdBy: t('alerting.hackathon.mock.me', 'me'),
    },
    {
      uid: '10',
      title: t('alerting.hackathon.mock.cache-low', 'Cache Hit Rate Low'),
      state: 'normal',
      folder: t('alerting.hackathon.mock.performance', 'Performance'),
      createdBy: t('alerting.hackathon.mock.me', 'me'),
    },
  ];

  // Use real data if available, otherwise use fallback mock
  const resultsToUse = allAlerts.length > 0 ? mockResults : fallbackMockResults;

  // Filter results based on search query and filters
  const filteredResults = resultsToUse.filter((result) => {
    // Filter by search query
    if (query && !result.title.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }

    // Filter by firing state
    if (filters.firing && result.state !== 'firing') {
      return false;
    }

    // Filter by owned by me
    if (filters.ownedByMe && result.createdBy !== 'me') {
      return false;
    }

    return true;
  });

  const renderHeader = () => {
    const parts: string[] = [];
    if (query) {
      parts.push(`"${query}"`);
    }
    if (filters.firing) {
      parts.push(t('alerting.hackathon.search.firing', 'Firing'));
    }
    if (filters.ownedByMe) {
      parts.push(t('alerting.hackathon.search.created-by-me', 'Created by me'));
    }

    return parts.length > 0 ? parts.join(' • ') : t('alerting.hackathon.search.all-alert-rules', 'All Alert Rules');
  };

  // Get state badge configuration
  const getStateBadgeConfig = (state: string): { text: string; color: 'red' | 'orange' | 'green'; icon: IconName } => {
    const stateUpper = state.toUpperCase();
    switch (stateUpper) {
      case 'FIRING':
        return { text: t('alerting.hackathon.state.firing', 'Firing'), color: 'red', icon: 'fire' };
      case 'PENDING':
        return { text: t('alerting.hackathon.state.pending', 'Pending'), color: 'orange', icon: 'exclamation-triangle' };
      default:
        return { text: t('alerting.hackathon.state.normal', 'Normal'), color: 'green', icon: 'check-circle' };
    }
  };

  // Table column configuration
  const columns: TableColumn[] = [
    {
      key: 'name',
      header: t('alerting.hackathon.search.name', 'Name'),
      width: '2.5fr',
      render: (item) => (
        <Stack direction="row" gap={1.5} alignItems="center">
          <Icon name="bell" size="lg" />
          <Text weight="medium">{item.title}</Text>
        </Stack>
      ),
    },
    {
      key: 'message',
      header: t('alerting.hackathon.search.message', 'Message'),
      width: '3fr',
      render: (item) => (
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Text variant="bodySmall" color="secondary">
            {item.title}
          </Text>
        </div>
      ),
    },
    {
      key: 'state',
      header: t('alerting.hackathon.search.state', 'State'),
      width: '120px',
      render: (item) => {
        const badgeConfig = getStateBadgeConfig(item.state);
        return (
          <Badge text={badgeConfig.text} color={badgeConfig.color} icon={badgeConfig.icon} />
        );
      },
    },
  ];

  function mapRuleWithOriginToRow(ruleWithOrigin: RuleWithOrigin, activeFilters?: { firing: boolean; ownedByMe: boolean }): AlertRow {
    if (ruleWithOrigin.origin === 'grafana') {
      const r = ruleWithOrigin.rule;
      return {
        uid: r.uid ?? '',
        title: r.name ?? '',
        state: ('state' in r && r.state ? String(r.state).toLowerCase() : 'normal') || 'normal',
        folder: ruleWithOrigin.namespaceName ?? '',
        createdBy: '',
      };
    }
    const r = ruleWithOrigin.rule;
    return {
      uid: r.name ?? '',
      title: r.name ?? '',
      state: ('state' in r && r.state ? String(r.state).toLowerCase() : 'normal') || 'normal',
      folder: ruleWithOrigin.groupIdentifier.namespace.name ?? '',
      createdBy: '',
    };
  }

  // Expanded content configuration
  const expandedContent: ExpandedContent = {
    render: (item) => (
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={4}>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              <Trans i18nKey="alerting.hackathon.search.uid">UID:</Trans>
            </Text>
            <Text variant="bodySmall"> {item.uid}</Text>
          </div>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              <Trans i18nKey="alerting.hackathon.search.folder">Folder:</Trans>
            </Text>
            <Text variant="bodySmall"> {item.folder || t('alerting.hackathon.search.na', 'N/A')}</Text>
          </div>
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              <Trans i18nKey="alerting.hackathon.search.created-by">Created by:</Trans>
            </Text>
            <Text variant="bodySmall"> {item.createdBy || t('alerting.hackathon.search.na', 'N/A')}</Text>
          </div>
        </Stack>
        <div>
          <LinkButton
            size="sm"
            variant="primary"
            href={`/alerting/grafana/${item.uid}/view`}
            onClick={(e) => e.stopPropagation()}
          >
            <Trans i18nKey="alerting.hackathon.search.view-alert">View Alert Rule</Trans>
          </LinkButton>
        </div>
      </Stack>
    ),
  };

  useEffect(() => {
    if (!showAllOnly || allRows !== null) {
      return;
    }
    let cancelled = false;
    const loadAll = async () => {
      setLoadingAll(true);
      try {
        const effectiveFilter = filters.firing ? { ...filterState, ruleState: PromAlertingRuleState.Firing } : filterState;
        const { iterable, abortController } = getFilteredRulesIterator(effectiveFilter, getApiGroupPageSize(true));
        const rows: AlertRow[] = [];
        const batched = iterable.pipe(bufferCountOrTime(50, 1000));
        for await (const batch of batched) {
          if (cancelled) {
            break;
          }
          for (const item of batch) {
            const row = mapRuleWithOriginToRow(item, filters);
            rows.push(row);
          }
          setAllRows([...rows]);
          setLoadingAll(false);
          if (rows.length >= 1000) {
            break;
          }
        }
        abortController.abort();
        if (!cancelled) {
          setAllRows(rows);
        }
      } finally {
        if (!cancelled) {
          setLoadingAll(false);
        }
      }
    };
    void loadAll();
    return () => {
      cancelled = true;
    };
  }, [showAllOnly, allRows, getFilteredRulesIterator, filterState, filters]);

  if (showAllOnly) {
    return (
      <div className={styles.container}>
        <Stack direction="column" gap={2}>
          {loadingAll ? (
            <Card noMargin className={styles.emptyCard}>
              <Stack direction="column" gap={2} alignItems="center">
                <Icon name="fa fa-spinner" size="xxl" className={styles.emptyIcon} />
                <Text variant="h5">
                  <Trans i18nKey="alerting.hackathon.search.loading">Loading alert rules...</Trans>
                </Text>
              </Stack>
            </Card>
          ) : (
            <div>
              <BrowsingSectionTitle
                title={t('alerting.hackathon.view-all.title', 'All Alerts ({{count}})', {
                  count: (filters.firing ? (allRows ?? []).filter((r) => (r.state || '').toLowerCase() === 'firing') : allRows)?.length ?? 0,
                })}
                icon="bell"
                subtitle=""
              />
              <HackathonTable
                columns={columns}
                data={filters.firing ? (allRows ?? []).filter((r) => (r.state || '').toLowerCase() === 'firing') : allRows ?? []}
                expandable={true}
                expandedContent={expandedContent}
                onRowClick={(item) => (window.location.href = `/alerting/grafana/${item.uid}/view`)}
                emptyMessage={t('alerting.hackathon.search.no-alerts', 'No alert rules found')}
              />
            </div>
          )}
        </Stack>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={2}>
        <div className={styles.header}>
          <Text variant="h4">
            <Trans i18nKey="alerting.hackathon.search.results">Search Results:</Trans> {renderHeader()}
          </Text>
        </div>

        <AlertSearchSuggestion query={query} filters={filters} />
        {(() => {
          if (isLoading) {
            return (
              <Card noMargin className={styles.emptyCard}>
                <Stack direction="column" gap={2} alignItems="center">
                  <Icon name="fa fa-spinner" size="xxl" className={styles.emptyIcon} />
                  <Text variant="h5">
                    <Trans i18nKey="alerting.hackathon.search.loading">Loading alert rules...</Trans>
                  </Text>
                </Stack>
              </Card>
            );
          }
          if (filteredResults.length === 0) {
            return (
              <Card noMargin className={styles.emptyCard}>
                <Stack direction="column" gap={2} alignItems="center">
                  <Icon name="search" size="xxl" className={styles.emptyIcon} />
                  <Text variant="h5">
                    <Trans i18nKey="alerting.hackathon.search.no-matches">No matches found</Trans>
                  </Text>
                </Stack>
              </Card>
            );
          }
          return (
            <div>
              <BrowsingSectionTitle
                title={t('alerting.hackathon.search.matched', 'Matched Alerts ({{count}})', {
                  count: filteredResults.length,
                })}
                icon="bell"
                subtitle=""
              />
              <HackathonTable
                columns={columns}
                data={filteredResults}
                expandable={true}
                expandedContent={expandedContent}
                onRowClick={(item) => (window.location.href = `/alerting/grafana/${item.uid}/view`)}
                emptyMessage={t('alerting.hackathon.search.no-alerts', 'No alert rules found')}
              />
            </div>
          );
        })()}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    padding: theme.spacing(2, 0),
  }),

  header: css({
    marginBottom: theme.spacing(2),
  }),

  resultsContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  }),

  resultCard: css({
    cursor: 'pointer',
    position: 'relative',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'all 0.3s ease',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #FF780A, #FF8C2A, #FFA040)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 0.3s ease',
      },
    },

    '&:hover': {
      transform: 'translateY(-2px)',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        boxShadow: '0 8px 16px rgba(255, 120, 10, 0.18)',
      },
      
      '&::before': {
        opacity: 0.35,
      },
    },
  }),

  stateBadge: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.radius.pill,
    textTransform: 'capitalize',
  }),

  firing: css({
    backgroundColor: theme.colors.error.main + '20',
    color: theme.colors.error.text,
  }),

  normal: css({
    backgroundColor: theme.colors.success.main + '20',
    color: theme.colors.success.text,
  }),

  emptyCard: css({
    padding: theme.spacing(6),
    textAlign: 'center',
  }),

  emptyIcon: css({
    color: theme.colors.text.secondary,
    opacity: 0.5,
  }),
});
