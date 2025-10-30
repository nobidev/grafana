import { Store } from 'redux';

import { StoreState } from 'app/types/store';

export let store: Store<StoreState>;

export function setStore(newStore: Store<StoreState>) {
  store = newStore;
}

export function getState(): StoreState {
  return store.getState();
}

export function dispatch(action: any) {
  if (!store || !store.getState) {
    return;
  }

  return store.dispatch(action);
}
