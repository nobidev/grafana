import { t } from '@grafana/i18n';
import { type IconName } from '@grafana/ui';
import { type Repository, type ResourceCount } from 'app/api/clients/provisioning/v0alpha1';

/**
 * Per-kind presentation metadata for a provisioned resource type, keyed on the
 * `group` + `resource` pair carried by repository stats (`ResourceCount`).
 *
 * Adding support for a new kind should be a single entry in `getKnownDescriptors`
 * — call sites read label/icon/route from here rather than branching on the kind.
 */
export interface ResourceDescriptor {
  group: string;
  resource: string;
  /** Icon used in listings and actions. */
  icon: IconName;
  /** Plural display label for the resource type, e.g. "Dashboards". */
  label: string;
  /** Pluralized "{count} {type}" label, e.g. "12 dashboards". */
  getCountLabel: (count: number) => string;
  /**
   * In-app route to view these resources for the given repository, or `undefined`
   * when there is no known destination (unknown kinds fall back to this).
   */
  getListUrl: (repo: Repository) => string | undefined;
}

// Folder- and dashboard-scoped resources live under the dashboards browse view.
// A folder-target repository owns a named folder; other targets are top-level.
function getFolderScopedListUrl(repo: Repository): string {
  if (repo.spec?.sync.target === 'folder') {
    return `/dashboards/f/${repo.metadata?.name}`;
  }
  return '/dashboards';
}

function getKnownDescriptors(): ResourceDescriptor[] {
  return [
    {
      group: 'folder.grafana.app',
      resource: 'folders',
      icon: 'folder',
      label: t('provisioning.resource-descriptor.folders-label', 'Folders'),
      getCountLabel: (count) =>
        t('provisioning.resource-descriptor.folders-count', '', {
          count,
          defaultValue_one: '{{count}} folder',
          defaultValue_other: '{{count}} folders',
        }),
      getListUrl: getFolderScopedListUrl,
    },
    {
      group: 'dashboard.grafana.app',
      resource: 'dashboards',
      icon: 'apps',
      label: t('provisioning.resource-descriptor.dashboards-label', 'Dashboards'),
      getCountLabel: (count) =>
        t('provisioning.resource-descriptor.dashboards-count', '', {
          count,
          defaultValue_one: '{{count}} dashboard',
          defaultValue_other: '{{count}} dashboards',
        }),
      getListUrl: getFolderScopedListUrl,
    },
    {
      group: 'playlist.grafana.app',
      resource: 'playlists',
      icon: 'list-ul',
      label: t('provisioning.resource-descriptor.playlists-label', 'Playlists'),
      getCountLabel: (count) =>
        t('provisioning.resource-descriptor.playlists-count', '', {
          count,
          defaultValue_one: '{{count}} playlist',
          defaultValue_other: '{{count}} playlists',
        }),
      getListUrl: () => '/playlists',
    },
  ];
}

/**
 * Resolves presentation metadata for a repository stat. Unknown kinds get a
 * graceful fallback: a generic icon, the raw resource name as label, and no
 * navigation target.
 */
export function getResourceDescriptor(stat: Pick<ResourceCount, 'group' | 'resource'>): ResourceDescriptor {
  const descriptor = getKnownDescriptors().find((d) => d.group === stat.group && d.resource === stat.resource);
  if (descriptor) {
    return descriptor;
  }

  return {
    group: stat.group,
    resource: stat.resource,
    icon: 'file-alt',
    label: stat.resource,
    getCountLabel: (count) => `${count} ${stat.resource}`,
    getListUrl: () => undefined,
  };
}
