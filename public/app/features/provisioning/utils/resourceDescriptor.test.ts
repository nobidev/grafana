import { type Repository } from 'app/api/clients/provisioning/v0alpha1';

import { getResourceDescriptor } from './resourceDescriptor';

const createRepo = (target: 'folder' | 'folderless' | 'instance', name = 'test-repo'): Repository => ({
  metadata: { name },
  spec: {
    title: 'Test Repository',
    type: 'github',
    sync: { target, enabled: true },
    workflows: [],
  },
});

describe('getResourceDescriptor', () => {
  it('resolves dashboards to the folder route for folder-target repos', () => {
    const descriptor = getResourceDescriptor({ group: 'dashboard.grafana.app', resource: 'dashboards' });

    expect(descriptor.icon).toBe('apps');
    expect(descriptor.label).toBe('Dashboards');
    expect(descriptor.getCountLabel(2)).toBe('2 dashboards');
    expect(descriptor.getCountLabel(1)).toBe('1 dashboard');
    expect(descriptor.getListUrl(createRepo('folder'))).toBe('/dashboards/f/test-repo');
  });

  it('resolves dashboards to the top-level route for non-folder targets', () => {
    const descriptor = getResourceDescriptor({ group: 'dashboard.grafana.app', resource: 'dashboards' });

    expect(descriptor.getListUrl(createRepo('folderless'))).toBe('/dashboards');
    expect(descriptor.getListUrl(createRepo('instance'))).toBe('/dashboards');
  });

  it('resolves folders to the folder route for folder-target repos', () => {
    const descriptor = getResourceDescriptor({ group: 'folder.grafana.app', resource: 'folders' });

    expect(descriptor.icon).toBe('folder');
    expect(descriptor.getListUrl(createRepo('folder'))).toBe('/dashboards/f/test-repo');
  });

  it('resolves playlists to the playlists route regardless of sync target', () => {
    const descriptor = getResourceDescriptor({ group: 'playlist.grafana.app', resource: 'playlists' });

    expect(descriptor.icon).toBe('list-ul');
    expect(descriptor.label).toBe('Playlists');
    expect(descriptor.getListUrl(createRepo('folder'))).toBe('/playlists');
    expect(descriptor.getListUrl(createRepo('instance'))).toBe('/playlists');
  });

  it('falls back gracefully for unknown kinds', () => {
    const descriptor = getResourceDescriptor({ group: 'example.grafana.app', resource: 'widgets' });

    expect(descriptor.icon).toBe('file-alt');
    expect(descriptor.label).toBe('widgets');
    expect(descriptor.getCountLabel(3)).toBe('3 widgets');
    expect(descriptor.getListUrl(createRepo('folder'))).toBeUndefined();
  });
});
