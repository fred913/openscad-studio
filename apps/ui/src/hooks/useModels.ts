import { useState, useEffect, useCallback, useMemo } from 'react';
import { getApiKey, type AiProvider, parseCustomModels, getCustomModels } from '../stores/apiKeyStore';

export interface ModelInfo {
  id: string;
  display_name: string;
  provider: AiProvider;
}

export interface GroupedModels {
  openai: ModelInfo[];
}

export interface UseModelsReturn {
  models: ModelInfo[];
  groupedByProvider: GroupedModels;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
  cacheAgeMinutes: number | null;
  refreshModels: () => Promise<void>;
}

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const CACHE_KEY = 'openscad_studio_models_cache';

interface CachedModels {
  models: ModelInfo[];
  fetchedAt: number;
}

const KNOWN_DISPLAY_NAMES: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  o1: 'o1',
  'o1-mini': 'o1 Mini',
  'o3-mini': 'o3 Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'gpt-4': 'GPT-4',
};

const DEFAULT_MODELS: ModelInfo[] = [
  { id: 'o1', display_name: 'o1 (Latest)', provider: 'openai' },
  { id: 'o3-mini', display_name: 'o3 Mini (Latest)', provider: 'openai' },
  { id: 'gpt-4o', display_name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', display_name: 'GPT-4o Mini', provider: 'openai' },
];

function isRelevantOpenAiModel(id: string): boolean {
  if (id.includes('search') || id.includes('chat')) return false;
  const isOSeries = /^o\d/.test(id);
  return isOSeries || id.startsWith('gpt-5') || id.startsWith('gpt-4o');
}

interface OpenAiModel {
  id: string;
  created?: number;
  owned_by?: string;
}

interface OpenAiModelsResponse {
  data: OpenAiModel[];
}

async function fetchOpenAiModels(apiKey: string, baseUrl?: string | null): Promise<ModelInfo[]> {
  const url = baseUrl && baseUrl.trim() 
    ? `${baseUrl.replace(/\/$/, '')}/models`
    : 'https://api.openai.com/v1/models';

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!resp.ok) {
    throw new Error(`OpenAI API error (${resp.status}): ${await resp.text()}`);
  }

  const data: OpenAiModelsResponse = await resp.json();

  return data.data
    .filter((m) => isRelevantOpenAiModel(m.id))
    .map((m) => ({
      id: m.id,
      display_name: KNOWN_DISPLAY_NAMES[m.id] || m.id,
      provider: 'openai' as const,
    }));
}

function sortModels(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    return a.display_name.localeCompare(b.display_name);
  });
}

function loadCache(providers: string[]): { models: ModelInfo[]; ageMinutes: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedModels = JSON.parse(raw);
    const age = Date.now() - cached.fetchedAt;
    if (age > CACHE_TTL_MS) return null;
    const filtered = cached.models.filter((m) => providers.includes(m.provider));
    if (filtered.length === 0) return null;
    return { models: filtered, ageMinutes: Math.floor(age / 60000) };
  } catch {
    return null;
  }
}

function saveCache(models: ModelInfo[]): void {
  try {
    const cached: CachedModels = { models, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // localStorage full or unavailable
  }
}

export function useModels(availableProviders: string[]): UseModelsReturn {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState<number | null>(null);

  const doFetch = useCallback(
    async (forceRefresh: boolean) => {
      if (availableProviders.length === 0) {
        setModels([]);
        return;
      }

      // Check if custom models are configured
      const customModelsConfig = getCustomModels();
      const customModels = parseCustomModels(customModelsConfig);

      if (customModels.length > 0) {
        // Use custom models configuration
        const customModelInfos: ModelInfo[] = customModels.map(m => ({
          id: m.id,
          display_name: m.display_name,
          provider: 'openai',
        }));
        setModels(sortModels(customModelInfos));
        setFromCache(false);
        setCacheAgeMinutes(null);
        return;
      }

      // If no custom models, try to fetch from OpenAI API
      if (!forceRefresh) {
        const cached = loadCache(availableProviders);
        if (cached) {
          setModels(sortModels(cached.models));
          setFromCache(true);
          setCacheAgeMinutes(cached.ageMinutes);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const fetches: Promise<ModelInfo[]>[] = [];

        if (availableProviders.includes('openai')) {
          const key = getApiKey('openai');
          if (key) {
            // Try to fetch, but fall back to defaults on error
            fetches.push(
              fetchOpenAiModels(key).catch(() => [])
            );
          }
        }

        const results = await Promise.all(fetches);
        const allModels = results.flat();

        if (allModels.length > 0) {
          const sorted = sortModels(allModels);
          setModels(sorted);
          setFromCache(false);
          setCacheAgeMinutes(null);
          saveCache(sorted);
        } else {
          // Use default models
          const defaults = DEFAULT_MODELS.filter((m) => availableProviders.includes(m.provider));
          setModels(defaults);
        }
      } catch (e) {
        setError(String(e));
        const defaults = DEFAULT_MODELS.filter((m) => availableProviders.includes(m.provider));
        setModels(defaults);
      } finally {
        setIsLoading(false);
      }
    },
    [availableProviders]
  );

  useEffect(() => {
    if (availableProviders.length === 0) {
      setModels([]);
      return;
    }
    doFetch(false);
  }, [availableProviders, doFetch]);

  const refreshModels = useCallback(() => doFetch(true), [doFetch]);

  const groupedByProvider = useMemo(
    (): GroupedModels => ({
      openai: models.filter((m) => m.provider === 'openai'),
    }),
    [models]
  );

  return {
    models,
    groupedByProvider,
    isLoading,
    error,
    fromCache,
    cacheAgeMinutes,
    refreshModels,
  };
}
