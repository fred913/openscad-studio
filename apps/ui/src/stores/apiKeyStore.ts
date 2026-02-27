import { useSyncExternalStore } from 'react';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  openai: 'openscad_studio_openai_api_key',
  openaiBaseUrl: 'openscad_studio_openai_base_url',
  customModels: 'openscad_studio_custom_models',
  model: 'openscad_studio_ai_model',
} as const;

export type AiProvider = 'openai';

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
  if (hasApiKeyForProvider('openai')) providers.push('openai');
  return providers;
}

// ============================================================================
// OpenAI Base URL Storage
// ============================================================================

export function setOpenAIBaseUrl(url: string): void {
  if (url.trim()) {
    localStorage.setItem(STORAGE_KEYS.openaiBaseUrl, url);
  } else {
    localStorage.removeItem(STORAGE_KEYS.openaiBaseUrl);
  }
  notify();
}

export function getOpenAIBaseUrl(): string | null {
  return localStorage.getItem(STORAGE_KEYS.openaiBaseUrl);
}

// ============================================================================
// Custom Models Configuration Storage
// ============================================================================

export function setCustomModels(config: string): void {
  if (config.trim()) {
    localStorage.setItem(STORAGE_KEYS.customModels, config);
  } else {
    localStorage.removeItem(STORAGE_KEYS.customModels);
  }
  notify();
}

export function getCustomModels(): string | null {
  return localStorage.getItem(STORAGE_KEYS.customModels);
}

/**
 * Parse custom models config string into model array
 * Format: "model-id=Display Name,model-id2=Display Name 2"
 */
export function parseCustomModels(config: string | null): Array<{ id: string; display_name: string }> {
  if (!config || !config.trim()) return [];
  
  try {
    return config.split(',').map(pair => {
      const [id, display_name] = pair.split('=').map(s => s.trim());
      if (!id || !display_name) throw new Error('Invalid format');
      return { id, display_name };
    }).filter(m => m.id && m.display_name);
  } catch {
    return [];
  }
}

// ============================================================================
// Model Persistence
// ============================================================================

export function getStoredModel(): string {
  return localStorage.getItem(STORAGE_KEYS.model) || 'gpt-4o';
}

export function setStoredModel(model: string): void {
  localStorage.setItem(STORAGE_KEYS.model, model);
}

// ============================================================================
// Provider Detection
// ============================================================================

export function getProviderFromModel(modelId: string): AiProvider {
  // All models are OpenAI now (or OpenAI-compatible)
  return 'openai';
}

// ============================================================================
// Reactive Store (useSyncExternalStore)
// ============================================================================

type ApiKeyStatus = boolean | null;

let status: ApiKeyStatus = null;
const listeners: Set<() => void> = new Set();

function notify() {
  // Recompute status
  status = hasApiKeyForProvider('openai');
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
status = hasApiKeyForProvider('openai');

export function invalidateApiKeyStatus() {
  notify();
}

export function useHasApiKey(): ApiKeyStatus {
  return useSyncExternalStore(subscribe, getSnapshot);
}
