import { HttpResponse, http } from 'msw';

import { grafanaAlertNotifiersMock } from 'app/features/alerting/unified/mockGrafanaNotifiers';
import { VersionedNotifierPlugin } from 'app/types/alerting';

// Mock versioned notifiers data
const versionedNotifiersMock: VersionedNotifierPlugin[] = Object.values(grafanaAlertNotifiersMock).map((notifier) => {
  // For some notifiers, provide multiple versions to demo the version picker
  const hasMultipleVersions = ['slack', 'email', 'webhook'].includes(notifier.type);

  const baseVersions = [
    {
      version: 'v1',
      canCreate: true,
      options: notifier.options,
      info: 'Current stable version',
    },
  ];

  if (hasMultipleVersions) {
    baseVersions.push({
      version: 'v2',
      canCreate: true,
      options: notifier.options, // In real implementation, this could have different options
      info: 'Beta version with enhanced features',
    });
  }

  return {
    type: notifier.type,
    currentVersion: 'v1',
    name: notifier.name,
    heading: notifier.heading,
    description: notifier.description,
    info: notifier.info || '',
    versions: baseVersions,
  };
});

const getAlertNotifiers = () =>
  http.get('/api/alert-notifiers', ({ request }) => {
    const url = new URL(request.url);
    const version = url.searchParams.get('version');

    if (version === '2') {
      return HttpResponse.json(versionedNotifiersMock);
    }

    return HttpResponse.json(grafanaAlertNotifiersMock);
  });

const handlers = [getAlertNotifiers()];
export default handlers;
