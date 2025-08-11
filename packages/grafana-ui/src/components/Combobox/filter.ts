import { fuzzySearch } from '@grafana/data';

import { ComboboxOption } from './types';

export function itemToString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (item == null) {
    return '';
  }
  return item.label ?? item.value.toString();
}

export function itemToSearchableString<T extends string | number>(item?: ComboboxOption<T> | null) {
  if (item == null) {
    return '';
  }

  let searchString = item.value.toString();
  if (item.label) {
    searchString = searchString.concat('|', item.label);
  }
  if (item.description) {
    searchString = searchString.concat('|', item.description);
  }

  return searchString;
}

export function fuzzyFind<T extends string | number>(
  options: Array<ComboboxOption<T>>,
  haystack: string[],
  needle: string
) {
  const indices = fuzzySearch(haystack, needle);
  return indices.map((idx) => options[idx]);
}
