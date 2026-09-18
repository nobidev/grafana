import { isEqual } from 'lodash';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from 'react';

import {
  type DataFrame,
  type DataTransformerConfig,
  type Field,
  cacheFieldDisplayNames,
  DataTransformerID,
} from '@grafana/data';
import {
  tableFrameKey,
  tableParentKey,
  tableViewIndices,
  FilterByValueType,
  FilterByValueMatch,
  type FilterByValueConfig,
  type ValueSetOptions,
  type NumericRangeOptions,
  type SortByTransformerOptions,
} from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SortColumn } from '@grafana/react-data-grid';

import { Button } from '../../Button/Button';
import { ErrorBoundary } from '../../ErrorBoundary/ErrorBoundary';
import { type AdHocTransformationsApi } from '../../PanelChrome/PanelContext';

import { type FilterType, type TableNGProps, type TableRow } from './types';
import { type ApplyFilterResult } from './utils';

export interface TableRowTransformations {
  api: AdHocTransformationsApi;
  tag: string;
  frameKey: string;
}
interface ViewContext {
  filters: readonly FilterByValueConfig[];
  sortColumns: SortColumn[];
  setSortColumns: Dispatch<SetStateAction<SortColumn[]>>;
  filter: FilterType;
  setFilter: Dispatch<SetStateAction<FilterType>>;
  timeZone?: string;
}
export const TableViewContext = createContext<ViewContext | undefined>(undefined);
export const useTableView = () => useContext(TableViewContext);
const EMPTY_STAGE: readonly DataTransformerConfig[] = [];

export function encodeTableFilters(
  filter: FilterType,
  timeZone?: string,
  source?: DataFrame,
  frameKey = ''
): FilterByValueConfig[] {
  return Object.values(filter)
    .map(
      (entry): FilterByValueConfig => ({
        id: DataTransformerID.filterByValue,
        options: {
          type: FilterByValueType.include,
          match: FilterByValueMatch.all,
          missingField: 'ignore',
          target: {
            frameKey,
            parentIndex: entry.parentIndex,
            parentKey: source && entry.parentIndex != null ? tableParentKey(source, entry.parentIndex) : undefined,
          },
          filters: [
            {
              fieldName: entry.displayName,
              field: entry.fieldName ? { name: entry.fieldName, labels: entry.fieldLabels } : undefined,
              config: entry.range
                ? { id: 'numericRange', options: entry.range }
                : {
                    id: 'inSet',
                    options: {
                      values: Array.from(entry.filteredSet),
                      mode: 'display',
                      displayConfig: entry.displayConfig,
                      timeZone,
                    } satisfies ValueSetOptions,
                  },
            },
          ],
        },
      })
    )
    .sort((a, b) => Number(b.options.target?.parentIndex != null) - Number(a.options.target?.parentIndex != null));
}

function filterKey(config: FilterByValueConfig) {
  const name = config.options.filters[0].fieldName;
  const parentIndex = config.options.target?.parentIndex;
  return parentIndex == null ? name : `${name}-${parentIndex}`;
}

function isTableFilter(config: DataTransformerConfig, frameKey: string): config is FilterByValueConfig {
  return config.id === DataTransformerID.filterByValue && config.options.target?.frameKey === frameKey;
}

function activeFilters(
  configs: readonly DataTransformerConfig[],
  frameKey: string,
  source: DataFrame
): FilterByValueConfig[] {
  return configs.filter((config): config is FilterByValueConfig => {
    if (!isTableFilter(config, frameKey) || config.disabled) {
      return false;
    }
    const target = config.options.target;
    return (
      target?.parentIndex == null ||
      target.parentKey == null ||
      target.parentKey === tableParentKey(source, target.parentIndex)
    );
  });
}

function decodeFilters(filters: readonly FilterByValueConfig[]): FilterType {
  return Object.fromEntries(
    filters.map((config) => {
      const predicate = config.options.filters[0];
      const selection: ValueSetOptions | undefined =
        predicate.config.id === 'inSet' ? predicate.config.options : undefined;
      const range: NumericRangeOptions | undefined =
        predicate.config.id === 'numericRange' ? predicate.config.options : undefined;
      const values = (selection?.values ?? []).map(String);
      return [
        filterKey(config),
        {
          displayName: predicate.fieldName,
          fieldName: predicate.field?.name,
          fieldLabels: predicate.field?.labels,
          parentIndex: config.options.target?.parentIndex,
          filteredSet: new Set(values),
          filtered: values.map((value) => ({ value, label: value })),
          range,
          displayConfig: selection?.displayConfig,
        },
      ];
    })
  );
}

export function TableViewProvider({ props, children }: { props: TableNGProps; children: React.ReactNode }) {
  const { api, tag = '' } = props.rowTransformations ?? {};
  const source = props.data;
  const frameKey = props.rowTransformations?.frameKey ?? tableFrameKey([source], 0);
  const stage = useSyncExternalStore(
    useCallback((listener) => api?.subscribe(tag, listener) ?? (() => {}), [api, tag]),
    useCallback(() => api?.get(tag) ?? EMPTY_STAGE, [api, tag])
  );
  const [local, setLocal] = useState<readonly DataTransformerConfig[]>(EMPTY_STAGE);
  const configs = api ? stage : local;
  const update = useCallback(
    (fn: (current: readonly DataTransformerConfig[]) => readonly DataTransformerConfig[]) => {
      if (!api) {
        setLocal((current) => {
          const next = fn(current);
          return isEqual(current, next) ? current : next;
        });
        return;
      }
      const current = api.get(tag);
      const next = fn(current);
      if (!isEqual(current, next)) {
        api.set(tag, next);
      }
    },
    [api, tag]
  );
  const filters = useMemo(() => activeFilters(configs, frameKey, source), [configs, frameKey, source]);
  const filter = useMemo(() => decodeFilters(filters), [filters]);
  const initialSort = useRef(props.sortBy);
  const initial = useMemo<SortByTransformerOptions>(
    () => ({
      sort: (initialSort.current ?? []).map((s) => ({ field: s.displayName, desc: s.desc })),
      table: true,
      target: { frameKey },
    }),
    [frameKey]
  );
  const readSort = useCallback(
    (current: readonly DataTransformerConfig[]): SortByTransformerOptions =>
      current.find(
        (config) =>
          config.id === DataTransformerID.sortBy && config.options.target?.frameKey === frameKey && !config.disabled
      )?.options ?? initial,
    [frameKey, initial]
  );
  const setFilter = useCallback<Dispatch<SetStateAction<FilterType>>>(
    (action) =>
      update((current) => {
        const previous = decodeFilters(activeFilters(current, frameKey, source));
        const next = typeof action === 'function' ? action(previous) : action;
        const rest = current.filter((config) => !isTableFilter(config, frameKey));
        if (
          initial.sort.length &&
          !current.some(
            (config) => config.id === DataTransformerID.sortBy && config.options.target?.frameKey === frameKey
          )
        ) {
          rest.unshift({ id: DataTransformerID.sortBy, options: initial });
        }
        // Child predicates run before parent rows can be removed; all predicates precede organize.
        return [...encodeTableFilters(next, props.timeZone, source, frameKey), ...rest];
      }),
    [update, frameKey, source, props.timeZone, initial]
  );
  const sortColumns = useMemo<SortColumn[]>(
    () =>
      readSort(configs).sort.map((s) => ({
        columnKey: s.displayName ?? s.field,
        direction: s.desc ? 'DESC' : 'ASC',
      })),
    [configs, readSort]
  );
  const setSortColumns = useCallback<Dispatch<SetStateAction<SortColumn[]>>>(
    (action) =>
      update((current) => {
        const previous: SortColumn[] = readSort(current).sort.map((s) => ({
          columnKey: s.displayName ?? s.field,
          direction: s.desc ? 'DESC' : 'ASC',
        }));
        const next = typeof action === 'function' ? action(previous) : action;
        const rest = current.filter(
          (config) => !(config.id === DataTransformerID.sortBy && config.options.target?.frameKey === frameKey)
        );
        const sorted: DataTransformerConfig<SortByTransformerOptions> = {
          id: DataTransformerID.sortBy,
          options: {
            table: true,
            target: { frameKey },
            sort: next.map((s) => ({
              field:
                props.data.fields.find((f) => (f.state?.displayName ?? f.name) === s.columnKey)?.name ?? s.columnKey,
              displayName: s.columnKey,
              fieldLabels: props.data.fields.find((f) => (f.state?.displayName ?? f.name) === s.columnKey)?.labels,
              desc: s.direction === 'DESC',
            })),
          },
        };
        // Filtering must finish before sorting can change nested parent indices.
        return [
          ...rest.filter((config) => config.id === DataTransformerID.filterByValue),
          sorted,
          ...rest.filter((config) => config.id !== DataTransformerID.filterByValue),
        ];
      }),
    [update, readSort, frameKey, props.data.fields]
  );
  const value = useMemo(
    () => ({ filters, filter, setFilter, sortColumns, setSortColumns, timeZone: props.timeZone }),
    [filters, filter, setFilter, sortColumns, setSortColumns, props.timeZone]
  );
  return (
    <TableViewContext.Provider value={value}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {Object.keys(filter).length > 0 && (
          <div style={{ flex: '0 0 auto', padding: '4px 8px' }}>
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              icon="filter"
              onClick={() => setFilter({})}
              data-testid={selectors.components.Panels.Visualization.TableNG.Filters.clearAll}
            >
              {t('grafana-ui.table.view.clear', 'Clear filters ({{total}})', { total: Object.keys(filter).length })}
            </Button>
          </div>
        )}
        <div style={{ flex: '1 1 auto', minHeight: 0 }}>
          <ErrorBoundary dependencies={[configs, props.data]}>
            {({ error }) =>
              error ? (
                <div role="alert">
                  {t('grafana-ui.table.view.error', 'Unable to apply this table view.')}
                  <Button
                    onClick={() => {
                      setFilter({});
                      setSortColumns([]);
                    }}
                  >
                    {t('grafana-ui.table.view.reset', 'Reset view')}
                  </Button>
                </div>
              ) : (
                children
              )
            }
          </ErrorBoundary>
        </div>
      </div>
    </TableViewContext.Provider>
  );
}

export function transformTableRows(
  rows: TableRow[],
  fields: Field[],
  filters: readonly FilterByValueConfig[],
  sort: SortColumn[] = [],
  parentIndex?: number
): TableRow[] {
  if (!filters.length && !sort.length) {
    return rows;
  }
  const parents = rows.filter((row) => row.__depth === 0);
  const frame: DataFrame = {
    length: parents.length,
    fields: fields.map((field) => ({
      ...field,
      values: parents.map((row) => field.values[row.__index]),
      ...(field.nanos ? { nanos: parents.map((row) => field.nanos![row.__index]) } : {}),
    })),
  };
  cacheFieldDisplayNames([frame]);
  const indices = tableViewIndices(
    frame,
    filters,
    parentIndex,
    sort.map((s) => ({ field: s.columnKey, desc: s.direction === 'DESC' }))
  );
  const children = new Map(rows.filter((row) => row.__depth !== 0).map((row) => [row.__index, row]));
  return indices.flatMap((index) => {
    const row = parents[index];
    const child = children.get(row.__index);
    return child ? [row, child] : [row];
  });
}

export function transformTableFilters(
  rows: TableRow[],
  fields: Field[],
  filters: readonly FilterByValueConfig[],
  parentIndex?: number
): ApplyFilterResult {
  const scoped = filters.filter((config) => config.options.target?.parentIndex === parentIndex);
  const crossFilterOrder = scoped.map(filterKey);
  const crossFilterRows = Object.fromEntries(
    scoped.map((config) => [
      filterKey(config),
      transformTableRows(
        rows,
        fields,
        filters.filter((other) => other !== config),
        [],
        parentIndex
      ),
    ])
  );
  const filteredRows = transformTableRows(rows, fields, filters, [], parentIndex);
  return { filteredRows, crossFilterOrder, crossFilterRows, crossFilterTailRows: filteredRows };
}
