import { type PluginMeta } from '@grafana/data';

import { config } from '../../config';
import { getFeatureFlagClient } from '../../internal/openFeature';
import { getCachedPromiseWithArgs } from '../../utils/getCachedPromise';
import { getBackendSrv } from '../backendSrv';
import { getPluginMetas } from '../pluginMeta/plugins';

import { getSettingsMapper } from './mappers/mappers';
import { type Settings } from './types';

function getApiVersion(): string {
  return 'v0alpha1';
}

function getLegacySettings(pluginId: string, showErrorAlert?: boolean): Promise<PluginMeta | null> {
  const options = showErrorAlert ? { showErrorAlert, validatePath: true } : { validatePath: true };

  return getBackendSrv()
    .get(`/api/plugins/${pluginId}/settings`, undefined, undefined, options)
    .catch((e) => {
      // User does not have access to plugin
      if (typeof e === 'object' && e !== null && 'status' in e && (e.status === 403 || e.status === 401)) {
        e.isHandled = true;
        return Promise.reject(e);
      }

      return Promise.reject(new Error('Unknown Plugin'));
    });
}

function getAppPluginSettings(pluginId: string, showErrorAlert?: boolean): Promise<Settings | null> {
  const options = showErrorAlert ? { showErrorAlert, validatePath: true } : { validatePath: true };

  return getBackendSrv()
    .get(
      `apis/${pluginId}.grafana.app/${getApiVersion()}/namespaces/${config.namespace}/settings/${pluginId}`,
      undefined,
      undefined,
      options
    )
    .catch((e) => {
      // User does not have access to plugin
      if (typeof e === 'object' && e !== null && 'status' in e && (e.status === 403 || e.status === 401)) {
        e.isHandled = true;
        return Promise.reject(e);
      }

      return Promise.reject(new Error('Unknown Plugin'));
    });
}

export async function getPluginSettings(pluginId: string, showErrorAlert = false): Promise<PluginMeta | null> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPluginSettings', false)) {
    // use legacy api it feature flag is turned off
    return getCachedLegacySettings(pluginId, showErrorAlert);
  }

  const meta = await getPluginMetas(pluginId);
  if (!meta || meta.spec.pluginJson.type !== 'app') {
    // use legacy api if the type isn't available in metas api or if the type is 'datasource' or 'panel'
    return getCachedLegacySettings(pluginId, showErrorAlert);
  }

  const settings = await getCachedAppSettings(pluginId, showErrorAlert);
  if (!settings) {
    // something went wrong, fallback to legacy settings
    return getCachedLegacySettings(pluginId, showErrorAlert);
  }

  const mapper = getSettingsMapper();
  return mapper(meta.spec, settings);
}

export async function refreshPluginSettings(pluginId: string): Promise<PluginMeta | null> {
  if (!getFeatureFlagClient().getBooleanValue('useMTPluginSettings', false)) {
    // use legacy api it feature flag is turned off
    return refreshCachedLegacySettings(pluginId, false);
  }

  const meta = await getPluginMetas(pluginId);
  if (!meta || meta.spec.pluginJson.type !== 'app') {
    // use legacy api if the type isn't available in metas api or if the type is 'datasource' or 'panel'
    return refreshCachedLegacySettings(pluginId, false);
  }

  const settings = await refreshCachedAppSettings(pluginId, false);
  if (!settings) {
    // something went wrong, fallback to legacy settings
    return refreshCachedLegacySettings(pluginId, false);
  }

  const mapper = getSettingsMapper();
  return mapper(meta.spec, settings);
}

/**
 * Check if an app plugin is installed and enabled.
 * @param pluginId - The id of the app plugin.
 * @returns True if the app plugin is installed and enabled, false otherwise.
 */
export async function isAppPluginEnabled(pluginId: string): Promise<boolean> {
  const app = await getPluginSettings(pluginId);
  return Boolean(app?.enabled);
}

const getCachedLegacySettings = getCachedPromiseWithArgs(
  getLegacySettings,
  {},
  (pluginId, showErrorAlert) => `getLegacySettings-${pluginId}`
);

const refreshCachedLegacySettings = getCachedPromiseWithArgs(
  getLegacySettings,
  { invalidate: true },
  (pluginId, showErrorAlert) => `getLegacySettings-${pluginId}`
);

const getCachedAppSettings = getCachedPromiseWithArgs(
  getAppPluginSettings,
  { defaultValue: null },
  (pluginId, showErrorAlert) => `getAppPluginSettings-${pluginId}`
);

const refreshCachedAppSettings = getCachedPromiseWithArgs(
  getAppPluginSettings,
  { defaultValue: null, invalidate: true },
  (pluginId, showErrorAlert) => `getAppPluginSettings-${pluginId}`
);
