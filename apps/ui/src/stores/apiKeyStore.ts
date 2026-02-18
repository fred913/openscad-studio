import { useSyncExternalStore } from 'react';
import { invoke } from '@tauri-apps/api/core';

type ApiKeyStatus = boolean | null; // null = loading

let status: ApiKeyStatus = null;
let listeners: Set<() => void> = new Set();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ApiKeyStatus {
  return status;
}

function fetchStatus() {
  invoke<boolean>('has_api_key')
    .then((result) => {
      status = result;
      notify();
    })
    .catch(() => {
      status = false;
      notify();
    });
}

fetchStatus();

export function invalidateApiKeyStatus() {
  fetchStatus();
}

export function useHasApiKey(): ApiKeyStatus {
  return useSyncExternalStore(subscribe, getSnapshot);
}
