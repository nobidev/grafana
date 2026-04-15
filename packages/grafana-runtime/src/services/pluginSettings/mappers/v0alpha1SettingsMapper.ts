import { type PluginInclude, PluginIncludeType, PluginType, type KeyValue } from '@grafana/data';

import {
  angularMapper,
  dependenciesMapper,
  extensionsMapper,
  infoMapper,
  loadingStrategyMapper,
} from '../../pluginMeta/mappers/shared';
import type { Include, Spec as v0alpha1Spec } from '../../pluginMeta/types/meta/types.spec.gen';
import { type Settings, type SettingsMapper } from '../types';

function secureJsonFieldsMapper(settings: Settings): KeyValue<boolean> {
  const secure = settings.secure ?? {};
  const secureJsonFields: KeyValue<boolean> = Object.keys(secure).reduce((acc: KeyValue<boolean>, curr) => {
    const name = secure[curr];
    if (!name) {
      return acc;
    }

    acc[curr] = true;
    return acc;
  }, {});

  return secureJsonFields;
}

function typeMapper(meta: v0alpha1Spec): PluginType {
  if (!meta.pluginJson.type) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return '' as PluginType;
  }

  switch (meta.pluginJson.type) {
    case 'app':
      return PluginType.app;
    case 'datasource':
      return PluginType.datasource;
    case 'panel':
      return PluginType.panel;
    case 'renderer':
      return PluginType.renderer;
  }
}

function includeTypeMapper(include: Include): PluginIncludeType {
  if (!include.type) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return '' as PluginIncludeType;
  }

  switch (include.type) {
    case 'dashboard':
      return PluginIncludeType.dashboard;
    case 'page':
      return PluginIncludeType.page;
    case 'panel':
      return PluginIncludeType.panel;
    case 'datasource':
      return PluginIncludeType.datasource;
  }
}

function includesMapper(spec: v0alpha1Spec): PluginInclude[] {
  const includes = spec.pluginJson.includes ?? [];
  return includes.map((i) => ({
    ...i,
    name: i.name ?? '',
    type: includeTypeMapper(i),
  }));
}

export const v0alpha1SettingsMapper: SettingsMapper = (meta, settings) => {
  const { aliasIds: aliasIDs, baseURL: baseUrl } = meta;
  const { id, name } = meta.pluginJson;
  const { path: module, hash: moduleHash } = meta.module;
  const { enabled, jsonData, pinned } = settings.spec;
  const secureJsonFields = secureJsonFieldsMapper(settings);
  const type = typeMapper(meta);
  const info = infoMapper(meta);
  const angular = angularMapper(meta);
  const dependencies = dependenciesMapper(meta);
  const extensions = extensionsMapper(meta);
  const includes = includesMapper(meta);
  const loadingStrategy = loadingStrategyMapper(meta);

  return {
    baseUrl,
    id,
    info,
    module,
    name,
    type,
    aliasIDs,
    angular,
    dependencies,
    enabled,
    extensions,
    includes,
    jsonData,
    loadingStrategy,
    moduleHash,
    pinned,
    secureJsonFields,
  };
};
