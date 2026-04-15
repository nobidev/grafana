import { type PluginMeta, type KeyValue } from '@grafana/data';

import type { Spec as v0alpha1Spec } from '../pluginMeta/types/meta/types.spec.gen';

/** OneOf: exactly one of `name`, `create`, or `remove` must be set */
interface InlineSecureValue {
  /** Reference to an existing secret by name (1–253 chars) */
  name?: string;
  /** Create a new secure value — only used on POST/PUT (1–24576 chars) */
  create?: string;
  /** Remove this secure value from the map */
  remove?: boolean;
  /** Optional description when creating */
  description?: string;
}

type InlineSecureValues = Record<string, InlineSecureValue>;

interface ObjectMeta {
  name: string;
  namespace: string;
}

// --- App Plugin Settings resource ---

interface SettingsSpec<T extends KeyValue = {}> {
  enabled: boolean;
  pinned: boolean;
  jsonData: T;
}

export interface Settings {
  apiVersion: string; // e.g. "<plugin-id>.plugins.grafana.app/v0alpha1"
  kind: 'Settings';
  metadata: ObjectMeta;
  spec: SettingsSpec;
  /** On GET: keys only (values redacted). On POST/PUT: can set `create` values. */
  secure?: InlineSecureValues;
}

export type SettingsMapper = (meta: v0alpha1Spec, settings: Settings) => PluginMeta;
