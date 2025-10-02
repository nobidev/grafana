import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Badge, Box, ButtonGroup, Grid, Stack, Text, TextLink, ToolbarButton, useStyles2 } from '@grafana/ui';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { ExpandedContent, HackathonTable, TableColumn } from 'app/features/browse-dashboards/hackathon14/HackathonTable';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';
import { useGetPopularAlerts } from 'app/features/dashboard/api/popularResourcesApi';

type ViewMode = 'card' | 'list';

export const PopularAlerts = () => {
  const styles = useStyles2(getStyles);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const { data } = useGetPopularAlerts({ limit: 10 });

  const handleResourceClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

  const getStateBadgeConfig = (state?: string) => {
    switch (state) {
      case 'firing':
        return { color: 'red' as const, text: t('alerting.hackathon.popular.firing', 'Firing') };
      case 'pending':
        return { color: 'orange' as const, text: t('alerting.hackathon.popular.pending', 'Pending') };
      case 'inactive':
        return { color: 'blue' as const, text: t('alerting.hackathon.popular.normal', 'Normal') };
      default:
        return { color: 'purple' as const, text: t('alerting.hackathon.popular.normal', 'Normal') };
    }
  };

  const columns: TableColumn[] = [
    {
      key: 'name',
      header: t('alerting.hackathon.popular.name', 'Name'),
      width: '2fr',
      render: (resource) => (
        <div>
          <Text variant="body" weight="medium">
            {resource.title}
          </Text>
        </div>
      ),
    },
    {
      key: 'group',
      header: t('alerting.hackathon.popular.group', 'Group'),
      width: '1.5fr',
      render: (resource) => (
        <Text variant="bodySmall" color="secondary">
          {resource.folderTitle || t('alerting.hackathon.popular.default', 'Default')}
        </Text>
      ),
    },
    {
      key: 'views',
      header: t('alerting.hackathon.popular.views', 'Views'),
      width: '120px',
      render: (resource) => (
        <Text variant="bodySmall" color="secondary">
          {resource.visitCount || 0}
        </Text>
      ),
    },
    {
      key: 'activity',
      header: t('alerting.hackathon.popular.state', 'State'),
      width: '120px',
      render: (resource) => {
        const config = getStateBadgeConfig(resource.state);
        return <Badge text={config.text} color={config.color} />;
      },
    },
  ];

  const expandedContent: ExpandedContent = {
    render: (resource) => (
      <Stack direction="column" gap={1}>
        <div>
          <Text variant="bodySmall" weight="medium" color="secondary">
            <Trans i18nKey="alerting.hackathon.popular.uid">UID:</Trans>
          </Text>
          <Text variant="bodySmall"> {resource.uid}</Text>
        </div>
        <div>
          <Text variant="bodySmall" weight="medium" color="secondary">
            <Trans i18nKey="alerting.hackathon.popular.folder">Folder:</Trans>
          </Text>
          <Text variant="bodySmall"> {resource.folderTitle || t('alerting.hackathon.popular.default', 'Default')}</Text>
        </div>
        {resource.lastVisited && (
          <div>
            <Text variant="bodySmall" weight="medium" color="secondary">
              <Trans i18nKey="alerting.hackathon.popular.last-viewed">Last viewed:</Trans>
            </Text>
            <Text variant="bodySmall"> {new Date(resource.lastVisited).toLocaleString()}</Text>
          </div>
        )}
      </Stack>
    ),
  };

  if (data?.resources?.length === 0 || data?.resources === null) {
    return null;
  }

  return (
    <Box marginTop={4}>
      <BrowsingSectionTitle
        title={t('alerting.hackathon.popular.title', 'Popular Alerts')}
        subtitle={t('alerting.hackathon.popular.subtitle', 'Most visited alerts')}
        icon="history"
        actions={
          <Stack direction="row" gap={2} alignItems="center">
            <ButtonGroup>
              <div className={viewMode === 'card' ? styles.activeToggle : ''}>
                <ToolbarButton
                  icon="apps"
                  variant="default"
                  onClick={() => setViewMode('card')}
                  tooltip={t('alerting.hackathon.popular.card-view', 'Card view')}
                />
              </div>
              <div className={viewMode === 'list' ? styles.activeToggle : ''}>
                <ToolbarButton
                  icon="list-ul"
                  variant="default"
                  onClick={() => setViewMode('list')}
                  tooltip={t('alerting.hackathon.popular.list-view', 'List view')}
                />
              </div>
            </ButtonGroup>
            <TextLink color="secondary" href="/alerting/list/hackathon14/view-all-alerts" className={styles.viewAllLink}>
              <Trans i18nKey="alerting.hackathon.popular.view-all">View All</Trans>
            </TextLink>
          </Stack>
        }
      />
      <Box marginTop={2}>
        {data && data.resources?.length > 0 && (
          <>
            {viewMode === 'card' ? (
              <Grid gap={2} columns={{ xs: 1, sm: 2 }}>
                {data.resources.map((resource) => (
                  <RecentVisitCard
                    key={resource.uid}
                    type="alert"
                    title={resource.title}
                    subtitle={`${resource.visitCount} ${t('alerting.hackathon.popular.views-suffix', 'views')}`}
                    onClick={() => handleResourceClick(resource.uid)}
                  />
                ))}
              </Grid>
            ) : (
              <HackathonTable
                data={data.resources}
                columns={columns}
                expandedContent={expandedContent}
                onRowClick={(resource) => handleResourceClick(resource.uid)}
              />
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  activeToggle: css({
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: -2,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.shape.radius.default,
    },
  }),

  viewAllLink: css({
    textDecoration: 'underline',
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});
