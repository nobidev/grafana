import { css, cx } from '@emotion/css';
import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo } from 'react';

import { textUtil, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  Box,
  Card,
  type CellProps,
  Grid,
  Icon,
  type IconName,
  InteractiveTable,
  LinkButton,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';
import { type Repository, type ResourceCount } from 'app/api/clients/provisioning/v0alpha1';

import { RecentJobs } from '../Job/RecentJobs';
import { QuotaLimitNote } from '../Shared/QuotaLimitNote';
import { MissingFolderMetadataBanner } from '../components/Folders/MissingFolderMetadataBanner';
import { hasMissingFolderMetadata } from '../utils/folderMetadata';
import { isQuotaReachedOrExceeded } from '../utils/quota';
import { getResourceDescriptor } from '../utils/resourceDescriptor';
import { formatTimestamp } from '../utils/time';

import { RepositoryHealthCard } from './RepositoryHealthCard';
import { RepositoryPullStatusCard } from './RepositoryPullStatusCard';

type StatCell<T extends keyof ResourceCount = keyof ResourceCount> = CellProps<ResourceCount, ResourceCount[T]>;

function getColumnCount(hasWebhook: boolean): { xxlColumn: 5 | 4; lgColumn: 3 | 2 } {
  return {
    xxlColumn: hasWebhook ? 5 : 4,
    lgColumn: hasWebhook ? 3 : 2,
  };
}

export function RepositoryOverview({ repo }: { repo: Repository }) {
  const styles = useStyles2(getStyles);
  const repoName = repo.metadata?.name ?? '';
  const showFolderMetadataCheck = useBooleanFlagValue('provisioningFolderMetadata', false);

  const status = repo.status;
  const { conditions, quota } = status ?? {};
  const webhookURL = getWebhookURL(repo);
  const { lgColumn, xxlColumn } = getColumnCount(Boolean(status?.webhook));
  const viewActions = useMemo(() => getResourceViewActions(repo), [repo]);

  const resourceColumns = useMemo(
    () => [
      {
        id: 'Resource',
        header: 'Resource Type',
        cell: ({ row: { original } }: StatCell<'resource'>) => {
          const descriptor = getResourceDescriptor(original);
          return (
            <Stack direction="row" gap={1} alignItems="center">
              <Icon name={descriptor.icon} />
              <span>{descriptor.label}</span>
            </Stack>
          );
        },
        size: 'auto',
      },
      {
        id: 'count',
        header: 'Count',
        cell: ({ row: { original } }: StatCell<'count'>) => {
          return <span>{original.count}</span>;
        },
        size: 100,
      },
    ],
    []
  );
  return (
    <Box padding={2}>
      <Stack direction="column" gap={2}>
        {showFolderMetadataCheck && hasMissingFolderMetadata(conditions) && (
          <MissingFolderMetadataBanner repositoryName={repoName} variant="repo" />
        )}
        <Grid columns={{ xs: 1, sm: 2, lg: lgColumn, xxl: xxlColumn }} gap={2} alignItems={'flex-start'}>
          <div className={styles.cardContainer}>
            <Card noMargin className={styles.card}>
              <Card.Heading>
                <Trans i18nKey="provisioning.repository-overview.resources">Resources</Trans>
              </Card.Heading>
              <Card.Description>
                {status?.stats ? (
                  <InteractiveTable
                    columns={resourceColumns}
                    data={status.stats}
                    getRowId={(r: ResourceCount) => `${r.group}-${r.resource}`}
                  />
                ) : null}
                {isQuotaReachedOrExceeded(conditions, 'ResourceQuota') && (
                  <Box paddingTop={2}>
                    <QuotaLimitNote maxResourcesPerRepository={quota?.maxResourcesPerRepository} />
                  </Box>
                )}
              </Card.Description>
              {viewActions.length > 0 && (
                <Card.Actions className={styles.actions}>
                  {viewActions.map((action) => (
                    <LinkButton key={action.url} size="md" href={action.url} icon={action.icon} variant="secondary">
                      {action.label}
                    </LinkButton>
                  ))}
                </Card.Actions>
              )}
            </Card>
          </div>

          {status?.health && (
            <div className={styles.cardContainer}>
              <RepositoryHealthCard repo={repo} />
            </div>
          )}

          {/* Webhook */}
          {status?.webhook && (
            <div className={styles.cardContainer}>
              <Card noMargin className={styles.card}>
                <Card.Heading>
                  <Trans i18nKey="provisioning.repository-overview.webhook">Webhook</Trans>
                </Card.Heading>
                <Card.Description>
                  <Grid columns={12} gap={1} alignItems="baseline">
                    <div className={styles.labelColumn}>
                      <Text color="secondary">
                        <Trans i18nKey="provisioning.repository-overview.webhook-id">ID:</Trans>
                      </Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{status?.webhook?.id ?? 'N/A'}</Text>
                    </div>
                    <div className={styles.labelColumn}>
                      <Text color="secondary">
                        <Trans i18nKey="provisioning.repository-overview.webhook-events">Events:</Trans>
                      </Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{status?.webhook?.subscribedEvents?.join(', ') ?? 'N/A'}</Text>
                    </div>
                    <div className={styles.labelColumn}>
                      <Text color="secondary">
                        <Trans i18nKey="provisioning.repository-overview.webhook-last-event">Last Event:</Trans>
                      </Text>
                    </div>
                    <div className={styles.valueColumn}>
                      <Text variant="body">{formatTimestamp(status?.webhook?.lastEvent)}</Text>
                    </div>
                  </Grid>
                </Card.Description>
                {webhookURL && (
                  <Card.Actions className={styles.actions}>
                    <LinkButton fill="outline" href={webhookURL} icon="external-link-alt">
                      <Trans i18nKey="provisioning.repository-overview.webhook-url">View Webhook</Trans>
                    </LinkButton>
                  </Card.Actions>
                )}
              </Card>
            </div>
          )}

          {/* Pull status */}
          <div
            className={cx(
              styles.pullStatusCard,
              status?.webhook ? styles.pullStatusCardLgSpan3 : styles.pullStatusCardLgSpan2
            )}
          >
            <RepositoryPullStatusCard repo={repo} />
          </div>
        </Grid>

        <div className={styles.cardContainer}>
          <RecentJobs repo={repo} />
        </div>
      </Stack>
    </Box>
  );
}

interface ResourceViewAction {
  url: string;
  label: string;
  icon: IconName;
}

// Builds "view" links from the repository's resource stats, driven by the per-kind
// descriptor. Resources that share a destination (e.g. folders and dashboards in a
// folder-target repo) are merged into a single button; unknown kinds with no route
// are skipped.
function getResourceViewActions(repo: Repository): ResourceViewAction[] {
  const byUrl = new Map<string, { labels: string[]; icon: IconName }>();

  for (const stat of repo.status?.stats ?? []) {
    const descriptor = getResourceDescriptor(stat);
    const url = descriptor.getListUrl(repo);
    if (!url) {
      continue;
    }

    const entry = byUrl.get(url);
    if (entry) {
      entry.labels.push(descriptor.label);
    } else {
      byUrl.set(url, { labels: [descriptor.label], icon: descriptor.icon });
    }
  }

  return Array.from(byUrl, ([url, { labels, icon }]) => ({
    url,
    icon,
    label: t('provisioning.repository-overview.view-resources', 'View {{resources}}', {
      resources: labels.join(', '),
    }),
  }));
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardContainer: css({
      height: '100%',
    }),
    card: css({
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    actions: css({
      marginTop: 'auto',
    }),
    labelColumn: css({
      minWidth: theme.spacing(10),
      gridColumn: 'span 3',
    }),
    valueColumn: css({
      gridColumn: 'span 9',
    }),
    pullStatusCard: css({
      height: '100%',
      gridColumn: 'span 2',

      [theme.breakpoints.down('lg')]: {
        gridColumn: 'span 2',
      },
    }),
    pullStatusCardLgSpan3: css({
      [theme.breakpoints.down('xxl')]: {
        gridColumn: 'span 3',
      },
    }),
    pullStatusCardLgSpan2: css({
      [theme.breakpoints.down('xxl')]: {
        gridColumn: 'span 2',
      },
    }),
  };
};

function getWebhookURL(repo: Repository) {
  const { status, spec } = repo;
  if (spec?.type === 'github' && status?.webhook?.url && spec.github?.url) {
    return textUtil.sanitizeUrl(`${spec.github.url}/settings/hooks/${status.webhook?.id}`);
  }
  return undefined;
}
