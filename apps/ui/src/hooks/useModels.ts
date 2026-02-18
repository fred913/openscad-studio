import { useMemo } from 'react';

export interface ModelInfo {
  id: string;
  display_name: string;
  provider: 'anthropic' | 'openai';
}

export interface GroupedModels {
  anthropic: ModelInfo[];
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

const ALL_MODELS: ModelInfo[] = [
  { id: 'claude-sonnet-4-5-20250929', display_name: 'Claude Sonnet 4.5', provider: 'anthropic' },
  { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'claude-haiku-3-5-20241022', display_name: 'Claude Haiku 3.5', provider: 'anthropic' },
  { id: 'gpt-4o', display_name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', display_name: 'GPT-4o Mini', provider: 'openai' },
  { id: 'o3-mini', display_name: 'o3-mini', provider: 'openai' },
];

const noop = async () => {};

export function useModels(availableProviders: string[]): UseModelsReturn {
  const filteredModels = useMemo(() => {
    return ALL_MODELS.filter((m) => availableProviders.includes(m.provider));
  }, [availableProviders]);

  const groupedByProvider = useMemo((): GroupedModels => {
    return {
      anthropic: filteredModels.filter((m) => m.provider === 'anthropic'),
      openai: filteredModels.filter((m) => m.provider === 'openai'),
    };
  }, [filteredModels]);

  return {
    models: filteredModels,
    groupedByProvider,
    isLoading: false,
    error: null,
    fromCache: false,
    cacheAgeMinutes: null,
    refreshModels: noop,
  };
}
