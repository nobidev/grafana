import { produce } from 'immer';

import { dataSourcesApi } from '../../api/dataSourcesApi';
import { isAlertmanagerDataSource, isPrometheusLikeSettingsForPOC } from '../../utils/datasource';

export const useEnableOrDisableHandlingGrafanaManagedAlerts = () => {
  const [getSettings, getSettingsState] = dataSourcesApi.endpoints.getDataSourceSettingsForUID.useLazyQuery();
  const [updateSettings, updateSettingsState] = dataSourcesApi.endpoints.updateDataSourceSettingsForUID.useMutation();

  const enableOrDisable = async (uid: string, handleGrafanaManagedAlerts: boolean) => {
    const existingSettings = await getSettings(uid).unwrap();
    // POC: allow enabling on Prometheus-like datasources too
    if (!isAlertmanagerDataSource(existingSettings) && !isPrometheusLikeSettingsForPOC(existingSettings)) {
      throw new Error(`Data source with UID ${uid} is not supported for Alertmanager forwarding`);
    }

    const newSettings = produce(existingSettings, (draft) => {
      (draft.jsonData as any).handleGrafanaManagedAlerts = handleGrafanaManagedAlerts;
    });

    updateSettings({ uid, settings: newSettings });
  };

  const enable = (uid: string) => enableOrDisable(uid, true);
  const disable = (uid: string) => enableOrDisable(uid, false);

  const loadingState = {
    isLoading: getSettingsState.isLoading || updateSettingsState.isLoading,
    isError: getSettingsState.isError || updateSettingsState.isError,
    error: getSettingsState.error || updateSettingsState.error,
    data: updateSettingsState.data,
  };

  return [enable, disable, loadingState] as const;
};
