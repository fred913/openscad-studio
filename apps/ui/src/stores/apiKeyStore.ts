import { useSyncExternalStore } from 'react';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  anthropic: 'openscad_studio_anthropic_api_key',
  openai: 'openscad_studio_openai_api_key',
  model: 'openscad_studio_ai_model',
} as const;

export type AiProvider = 'anthropic' | 'openai';

// ============================================================================
// API Key Storage (localStorage-based)
// ============================================================================

export function storeApiKey(provider: AiProvider, key: string): void {
  localStorage.setItem(STORAGE_KEYS[provider], key);
  notify();
}

export function clearApiKey(provider: AiProvider): void {
  localStorage.removeItem(STORAGE_KEYS[provider]);
  notify();
}

export function getApiKey(provider: AiProvider): string | null {
  return localStorage.getItem(STORAGE_KEYS[provider]);
}

export function hasApiKeyForProvider(provider: AiProvider): boolean {
  const key = getApiKey(provider);
  return key !== null && key.length > 0;
}

export function getAvailableProviders(): AiProvider[] {
  const providers: AiProvider[] = [];
  if (hasApiKeyForProvider('anthropic')) providers.push('anthropic');
  if (hasApiKeyForProvider('openai')) providers.push('openai');
  return providers;
}

// ============================================================================
// Model Persistence
// ============================================================================

export function getStoredModel(): string {
  return localStorage.getItem(STORAGE_KEYS.model) || 'claude-sonnet-4-5-20250929';
}

export function setStoredModel(model: string): void {
  localStorage.setItem(STORAGE_KEYS.model, model);
}

// ============================================================================
// Provider Detection
// ============================================================================

export function getProviderFromModel(modelId: string): AiProvider {
  if (modelId.startsWith('claude') || modelId.startsWith('anthropic')) {
    return 'anthropic';
  }
  if (
    modelId.startsWith('gpt') ||
    modelId.startsWith('o1') ||
    modelId.startsWith('o3') ||
    modelId.startsWith('chatgpt')
  ) {
    return 'openai';
  }
  return 'anthropic'; // Default
}

// ============================================================================
// Reactive Store (useSyncExternalStore)
// ============================================================================

type ApiKeyStatus = boolean | null;

let status: ApiKeyStatus = null;
const listeners: Set<() => void> = new Set();

function notify() {
  // Recompute status
  status = hasApiKeyForProvider('anthropic') || hasApiKeyForProvider('openai');
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

// Initialize status
status = hasApiKeyForProvider('anthropic') || hasApiKeyForProvider('openai');

export function invalidateApiKeyStatus() {
  notify();
}

export function useHasApiKey(): ApiKeyStatus {
  return useSyncExternalStore(subscribe, getSnapshot);
}
