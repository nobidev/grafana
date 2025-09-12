import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { PERMISSIONS_TIME_INTERVALS } from 'app/features/alerting/unified/components/mute-timings/permissions';
import { PERMISSIONS_NOTIFICATION_POLICIES } from 'app/features/alerting/unified/components/notification-policies/permissions';
import {
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
  AlertmanagerChoice,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';
import {
  DataSourceRulesSourceIdentifier as DataSourceRulesSourceIdentifier,
  GrafanaRulesSourceIdentifier,
  GrafanaRulesSourceSymbol,
  RuleIdentifier,
  RulesSource,
  RulesSourceIdentifier,
  RulesSourceUid,
} from 'app/types/unified-alerting';
import grafanaIconSvg from 'img/grafana_icon.svg';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { PERMISSIONS_CONTACT_POINTS } from '../components/contact-points/permissions';
import { PERMISSIONS_TEMPLATES } from '../components/templates/permissions';
import { useAlertManagersByPermission } from '../hooks/useAlertManagerSources';
import { isAlertManagerWithConfigAPI } from '../state/AlertmanagerContext';

import { instancesPermissions, notificationsPermissions, silencesPermissions } from './access-control';
import { isExtraConfig } from './alertmanager/extraConfigs';
import { getAllDataSources } from './config';
import { isGrafanaRuleIdentifier } from './rules';

const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const GRAFANA_RULES_SOURCE_NAME = 'grafana';
export const GRAFANA_DATASOURCE_NAME = '-- Grafana --';

export const GrafanaRulesSource: GrafanaRulesSourceIdentifier = {
  uid: GrafanaRulesSourceSymbol,
  name: GRAFANA_RULES_SOURCE_NAME,
  ruleSourceType: 'grafana',
};

/**
 * @deprecated use "SupportedRulesSourceType" and related types instead
 */
export enum DataSourceType {
  Alertmanager = 'alertmanager',
  Loki = 'loki',
  Prometheus = 'prometheus',
  AmazonPrometheus = 'grafana-amazonprometheus-datasource',
  AzurePrometheus = 'grafana-azureprometheus-datasource',
}

export interface AlertManagerDataSource {
  name: string;
  displayName?: string;
  imgUrl: string;
  meta?: DataSourceInstanceSettings['meta'];
  hasConfigurationAPI?: boolean;
  handleGrafanaManagedAlerts?: boolean;
}

export function getRulesDataSources() {
  const hasReadPermission = contextSrv.hasPermission(AccessControlAction.AlertingRuleExternalRead);
  const hasWritePermission = contextSrv.hasPermission(AccessControlAction.AlertingRuleExternalWrite);
  if (!hasReadPermission && !hasWritePermission) {
    return [];
  }

  return getAllDataSources()
    .filter((ds) => isSupportedExternalRulesSourceType(ds.type))
    .filter((ds) => isDataSourceManagingAlerts(ds))
    .sort((a, b) => NAME_COLLATOR.compare(a.name, b.name));
}

export function getRulesSourceUniqueKey(rulesSource: RulesSource): string {
  return isGrafanaRulesSource(rulesSource) ? 'grafana' : (rulesSource.uid ?? rulesSource.id);
}

export function getRulesDataSource(rulesSourceName: string) {
  return getRulesDataSources().find((x) => x.name === rulesSourceName);
}

export function getRulesDataSourceByUID(uid: string) {
  return getRulesDataSources().find((x) => x.uid === uid);
}

export function getAlertManagerDataSources() {
  return getAllDataSources()
    .filter((ds) => isAlertmanagerDataSourceInstance(ds) || isPrometheusLikeForPOC(ds))
    .sort((a, b) => NAME_COLLATOR.compare(a.name, b.name));
}

export function isAlertmanagerDataSourceInstance(
  dataSource: DataSourceInstanceSettings
): dataSource is DataSourceInstanceSettings<AlertManagerDataSourceJsonData> {
  return dataSource.type === DataSourceType.Alertmanager;
}

// POC: allow Prometheus-like datasources to appear in Alertmanager dropdown
function isPrometheusLikeForPOC(dataSource: DataSourceInstanceSettings) {
  return (
    dataSource.type === DataSourceType.Prometheus ||
    dataSource.type === DataSourceType.AmazonPrometheus ||
    dataSource.type === DataSourceType.AzurePrometheus
  );
}

// POC: predicate for DataSourceSettings (used in Settings tab)
export function isPrometheusLikeSettingsForPOC(dataSource: DataSourceSettings) {
  return (
    dataSource.type === DataSourceType.Prometheus ||
    dataSource.type === DataSourceType.AmazonPrometheus ||
    dataSource.type === DataSourceType.AzurePrometheus
  );
}

export function isAlertmanagerDataSource(
  dataSource: DataSourceSettings
): dataSource is DataSourceSettings<AlertManagerDataSourceJsonData> {
  return dataSource.type === DataSourceType.Alertmanager;
}

export function getExternalDsAlertManagers() {
  return getAlertManagerDataSources().filter((ds) => {
    if (isAlertmanagerDataSourceInstance(ds)) {
      return Boolean(ds.jsonData.handleGrafanaManagedAlerts);
    }
    // POC: include Prometheus-like datasources by default
    return false;
  });
}

export function isAlertmanagerDataSourceInterestedInAlerts(
  dataSourceSettings: DataSourceSettings<AlertManagerDataSourceJsonData>
) {
  return dataSourceSettings.jsonData.handleGrafanaManagedAlerts === true;
}

const grafanaAlertManagerDataSource: AlertManagerDataSource = {
  name: GRAFANA_RULES_SOURCE_NAME,
  imgUrl: grafanaIconSvg,
  hasConfigurationAPI: true,
};

// Used only as a fallback for Alert Group plugin
export function getAllAlertManagerDataSources(): AlertManagerDataSource[] {
  return [
    grafanaAlertManagerDataSource,
    ...getAlertManagerDataSources().map<AlertManagerDataSource>((ds) => ({
      name: ds.name,
      displayName: ds.name,
      imgUrl: ds.meta.info.logos.small,
      meta: ds.meta,
    })),
  ];
}

/**
 * This method gets all alert managers that the user has access, and then filter them first by being able to handle grafana managed alerts,
 * and then depending on the current alerting configuration returns either only the internal alert managers, only the external alert managers, or both.
 *
 */
export function useGetAlertManagerDataSourcesByPermissionAndConfig(
  permission: 'instance' | 'notification'
): AlertManagerDataSource[] {
  const allAlertManagersByPermission = useAlertManagersByPermission(permission); // this hook memoizes the result of getAlertManagerDataSourcesByPermission

  const externalDsAlertManagers: AlertManagerDataSource[] =
    allAlertManagersByPermission.availableExternalDataSources.filter((ds) => ds.handleGrafanaManagedAlerts);
  const internalDSAlertManagers = allAlertManagersByPermission.availableInternalDataSources;

  //get current alerting configuration
  const { currentData: amConfigStatus } = alertmanagerApi.endpoints.getGrafanaAlertingConfigurationStatus.useQuery();

  const alertmanagerChoice = amConfigStatus?.alertmanagersChoice;

  switch (alertmanagerChoice) {
    case AlertmanagerChoice.Internal:
      return internalDSAlertManagers;
    case AlertmanagerChoice.External:
      return externalDsAlertManagers;
    default:
      return [...internalDSAlertManagers, ...externalDsAlertManagers];
  }
}

/**
 * This method gets all alert managers that the user has access to and then split them into two groups:
 * 1. Internal alert managers
 * 2. External alert managers
 */
export function getAlertManagerDataSourcesByPermission(permission: 'instance' | 'notification'): {
  availableInternalDataSources: AlertManagerDataSource[];
  availableExternalDataSources: AlertManagerDataSource[];
} {
  const availableInternalDataSources: AlertManagerDataSource[] = [];
  const availableExternalDataSources: AlertManagerDataSource[] = [];
  const permissions = {
    instance: instancesPermissions.read,
    notification: notificationsPermissions.read,
    silence: silencesPermissions.read,
  };

  const builtinAlertmanagerPermissions = [
    ...Object.values(permissions).flatMap((permissions) => permissions.grafana),
    ...PERMISSIONS_CONTACT_POINTS,
    ...PERMISSIONS_NOTIFICATION_POLICIES,
    ...PERMISSIONS_TEMPLATES,
    ...PERMISSIONS_TIME_INTERVALS,
  ];

  const hasPermissionsForInternalAlertmanager = builtinAlertmanagerPermissions.some((permission) =>
    contextSrv.hasPermission(permission)
  );

  if (hasPermissionsForInternalAlertmanager) {
    availableInternalDataSources.push(grafanaAlertManagerDataSource);
  }

  if (contextSrv.hasPermission(permissions[permission].external)) {
    const cloudSources = getAlertManagerDataSources().map<AlertManagerDataSource>((ds) => {
      // if (isAlertmanagerDataSourceInstance(ds)) {
      return {
        name: ds.name,
        displayName: ds.name,
        imgUrl: ds.meta.info.logos.small,
        meta: ds.meta,
        hasConfigurationAPI: isAlertManagerWithConfigAPI(ds.jsonData),
        handleGrafanaManagedAlerts: ds.jsonData.handleGrafanaManagedAlerts,
      };
      // }
      // POC: Prometheus-like datasources shown without configuration API
      // return {
      //   name: ds.name,
      //   displayName: ds.name,
      //   imgUrl: ds.meta.info.logos.small,
      //   meta: ds.meta,
      //   hasConfigurationAPI: false,
      //   handleGrafanaManagedAlerts: ds.jsonData.handleGrafanaManagedAlerts,
      // };
    });
    availableExternalDataSources.push(...cloudSources);
  }

  return { availableInternalDataSources, availableExternalDataSources };
}

export function getAllRulesSourceNames(): string[] {
  const availableRulesSources: string[] = getRulesDataSources().map((r) => r.name);

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)) {
    availableRulesSources.push(GRAFANA_RULES_SOURCE_NAME);
  }

  return availableRulesSources;
}

export function getExternalRulesSources(): DataSourceRulesSourceIdentifier[] {
  return getRulesDataSources().map((ds) => ({
    name: ds.name,
    uid: ds.uid,
    ruleSourceType: 'datasource',
  }));
}

export function getAllRulesSources(): RulesSource[] {
  const availableRulesSources: RulesSource[] = getRulesDataSources();

  if (contextSrv.hasPermission(AccessControlAction.AlertingRuleRead)) {
    availableRulesSources.unshift(GRAFANA_RULES_SOURCE_NAME);
  }

  return availableRulesSources;
}

export function getRulesSourceName(rulesSource: RulesSource): string {
  return isCloudRulesSource(rulesSource) ? rulesSource.name : rulesSource;
}

export function getRulesSourceUid(rulesSource: RulesSource): string {
  return isCloudRulesSource(rulesSource) ? rulesSource.uid : GRAFANA_RULES_SOURCE_NAME;
}

export function isCloudRulesSource(rulesSource: RulesSource | string): rulesSource is DataSourceInstanceSettings {
  return rulesSource !== GRAFANA_RULES_SOURCE_NAME;
}

export function isVanillaPrometheusAlertManagerDataSource(name: string): boolean {
  if (name === GRAFANA_RULES_SOURCE_NAME) {
    return false;
  }

  // Case 1: It is an Alertmanager datasource explicitly configured as Prometheus implementation
  const am = getAlertmanagerDataSourceByName(name);
  if (am?.jsonData?.implementation === AlertManagerImplementation.prometheus) {
    return true;
  }

  // Case 2 (POC): It is a Prometheus-like datasource being used as Alertmanager
  // const ds = getDataSourceByName(name);
  // return ds ? isPrometheusLikeForPOC(ds) : false;
  return false;
}

export function isProvisionedDataSource(dataSource: DataSourceSettings): boolean {
  return dataSource.readOnly === true;
}

export function isGrafanaRulesSource(
  rulesSource: RulesSource | string
): rulesSource is typeof GRAFANA_RULES_SOURCE_NAME {
  return rulesSource === GRAFANA_RULES_SOURCE_NAME;
}

export function getDataSourceByName(name: string): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  return getAllDataSources().find((source) => source.name === name);
}

export function getDataSourceByUid(dsUid: string): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  return getAllDataSources().find((source) => source.uid === dsUid);
}

export function getAlertmanagerDataSourceByName(name: string) {
  return getAllDataSources()
    .filter(isAlertmanagerDataSourceInstance)
    .find((source) => source.name === name);
}

export function getRulesSourceByName(name: string): RulesSource | undefined {
  if (name === GRAFANA_RULES_SOURCE_NAME) {
    return GRAFANA_RULES_SOURCE_NAME;
  }
  return getDataSourceByName(name);
}

export function getDatasourceAPIId(dataSourceName: string) {
  if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return GRAFANA_RULES_SOURCE_NAME;
  }
  const ds = getDataSourceByName(dataSourceName);
  if (!ds) {
    throw new Error(`Datasource "${dataSourceName}" not found`);
  }
  return String(ds.id);
}

export function getDatasourceAPIUid(dataSourceName: string) {
  if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return GRAFANA_RULES_SOURCE_NAME;
  }

  if (isExtraConfig(dataSourceName)) {
    return dataSourceName;
  }

  const ds = getDataSourceByName(dataSourceName);
  if (!ds) {
    throw new Error(`Datasource "${dataSourceName}" not found`);
  }
  return ds.uid;
}

export function getDataSourceUID(rulesSourceIdentifier: { rulesSourceName: string } | { uid: RulesSourceUid }) {
  if ('uid' in rulesSourceIdentifier) {
    return rulesSourceIdentifier.uid;
  }

  if (rulesSourceIdentifier.rulesSourceName === GRAFANA_RULES_SOURCE_NAME) {
    return GrafanaRulesSourceSymbol;
  }

  const ds = getRulesDataSource(rulesSourceIdentifier.rulesSourceName);
  if (!ds) {
    return undefined;
  }
  return ds.uid;
}

export function getFirstCompatibleDataSource(): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  return getDataSourceSrv().getList({ alerting: true })[0];
}

export function getDefaultOrFirstCompatibleDataSource(): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
  const defaultDataSource = getDataSourceSrv().getInstanceSettings('default');
  const defaultIsCompatible = defaultDataSource?.meta.alerting ?? false;

  return defaultIsCompatible ? defaultDataSource : getFirstCompatibleDataSource();
}

export function isDataSourceManagingAlerts(ds: DataSourceInstanceSettings<DataSourceJsonData>) {
  return ds.jsonData.manageAlerts !== false; //if this prop is undefined it defaults to true
}

export function isDataSourceAllowedAsRecordingRulesTarget(ds: DataSourceInstanceSettings<DataSourceJsonData>) {
  return ds.jsonData.allowAsRecordingRulesTarget !== false; // if this prop is undefined it defaults to true
}

export function ruleIdentifierToRuleSourceIdentifier(ruleIdentifier: RuleIdentifier): RulesSourceIdentifier {
  if (isGrafanaRuleIdentifier(ruleIdentifier)) {
    return { uid: GrafanaRulesSourceSymbol, name: GRAFANA_RULES_SOURCE_NAME, ruleSourceType: 'grafana' };
  }

  return {
    uid: getDatasourceAPIUid(ruleIdentifier.ruleSourceName),
    name: ruleIdentifier.ruleSourceName,
    ruleSourceType: 'datasource',
  };
}

/**
 * Check if the given type is a supported external Prometheus flavored rules source type.
 */
export function isSupportedExternalPrometheusFlavoredRulesSourceType(
  type: string
): type is SupportedExternalPrometheusFlavoredRulesSourceType {
  return SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES.find((t) => t === type) !== undefined;
}
export const SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES = [
  'prometheus',
  'grafana-amazonprometheus-datasource',
  'grafana-azureprometheus-datasource',
] as const;
export type SupportedExternalPrometheusFlavoredRulesSourceType =
  (typeof SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES)[number]; // infer the type from the tuple above so we can maintain a single source of truth

/**
 * Check if the given type is a supported external rules source type. Includes Loki and Prometheus flavored types.
 */
export function isSupportedExternalRulesSourceType(type: string): type is SupportedExternalRulesSourceType {
  return SUPPORTED_EXTERNAL_RULE_SOURCE_TYPES.find((t) => t === type) !== undefined;
}
export type SupportedExternalRulesSourceType = 'loki' | SupportedExternalPrometheusFlavoredRulesSourceType;
export const SUPPORTED_EXTERNAL_RULE_SOURCE_TYPES = [
  'loki',
  ...SUPPORTED_EXTERNAL_PROMETHEUS_FLAVORED_RULE_SOURCE_TYPES,
] as const;

/**
 * Check if the given type is a supported rules source type. Includes "grafana" for Grafana Managed Rules.
 */
export function isSupportedRulesSourceType(type: string): type is SupportedRulesSourceType {
  return type === GRAFANA_RULES_SOURCE_NAME || isSupportedExternalRulesSourceType(type);
}
export type SupportedRulesSourceType = 'grafana' | SupportedExternalRulesSourceType;
export const SUPPORTED_RULE_SOURCE_TYPES = [
  GRAFANA_RULES_SOURCE_NAME,
  ...SUPPORTED_EXTERNAL_RULE_SOURCE_TYPES,
] as const satisfies string[];

export function isValidRecordingRulesTarget(ds: DataSourceInstanceSettings<DataSourceJsonData>): boolean {
  return isSupportedExternalPrometheusFlavoredRulesSourceType(ds.type) && isDataSourceAllowedAsRecordingRulesTarget(ds);
}
