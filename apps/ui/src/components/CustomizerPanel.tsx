/**
 * OpenSCAD Customizer Panel
 *
 * Displays interactive controls for OpenSCAD customizer parameters
 * and updates the source code when values change.
 */

import { generateText } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TbChevronDown, TbChevronRight, TbRefresh } from 'react-icons/tb'
import { eventBus } from '../platform'
import { createModel } from '../services/aiService'
import { getApiKey, getProviderFromModel, getStoredModel } from '../stores/apiKeyStore'
import { parseCustomizerParams } from '../utils/customizer/parser'
import type { CustomizerParam } from '../utils/customizer/types'
import { ParameterControl } from './customizer/ParameterControl'

interface CustomizerPanelProps {
  code: string;
  onChange: (newCode: string) => void;
  onExplainParameter?: (prompt: string) => void;
  isAiStreaming?: boolean;
}

export function CustomizerPanel({ code, onChange, onExplainParameter, isAiStreaming = false }: CustomizerPanelProps) {
  const { i18n, t } = useTranslation();
  const [collapsedTabs, setCollapsedTabs] = useState<Set<string>>(new Set());
  const defaultsRef = useRef<Map<string, string> | null>(null);
  const translationCacheRef = useRef<Map<string, string>>(new Map());
  const [translatedNames, setTranslatedNames] = useState<Record<string, string>>({});
  const [translationStatus, setTranslationStatus] = useState<'idle' | 'in-progress' | 'done' | 'failed'>(
    'idle'
  );

  // Parse parameters from code
  const tabs = useMemo(() => {
    try {
      return parseCustomizerParams(code);
    } catch (err) {
      console.error('[Customizer] Failed to parse parameters:', err);
      return [];
    }
  }, [code]);

  const parameterNames = useMemo(() => {
    const names = new Set<string>();
    for (const tab of tabs) {
      for (const param of tab.params) {
        names.add(param.name);
      }
    }
    return Array.from(names);
  }, [tabs]);

  useEffect(() => {
    const isChineseMode = i18n.resolvedLanguage?.startsWith('zh');
    if (!isChineseMode) {
      setTranslatedNames({});
      setTranslationStatus('done');
      return;
    }

    if (parameterNames.length === 0) {
      setTranslatedNames({});
      setTranslationStatus('done');
      return;
    }

    let cancelled = false;

    const applyFromCache = () => {
      const fromCache: Record<string, string> = {};
      for (const name of parameterNames) {
        const translated = translationCacheRef.current.get(name);
        if (translated) fromCache[name] = translated;
      }
      if (!cancelled) setTranslatedNames(fromCache);
    };

    const missing = parameterNames.filter((name) => !translationCacheRef.current.has(name));
    if (missing.length === 0) {
      setTranslationStatus('done');
      applyFromCache();
      return () => {
        cancelled = true;
      };
    }

    const translateMissingNames = async () => {
      try {
        setTranslationStatus('in-progress');
        const modelId = getStoredModel();
        const provider = getProviderFromModel(modelId);
        const apiKey = getApiKey(provider);
        if (!apiKey) {
          setTranslationStatus('failed');
          applyFromCache();
          return;
        }

        const model = createModel(provider, apiKey, modelId);
        const prompt = `Translate this JSON array of OpenSCAD parameter names into Simplified Chinese.\nReturn ONLY a JSON array of translated strings in the same order.\nDo not include markdown or explanations.\n\n${JSON.stringify(missing)}`;

        const { text } = await generateText({
          model,
          prompt,
          temperature: 0,
        });

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);

        if (Array.isArray(parsed) && parsed.length === missing.length) {
          missing.forEach((original, index) => {
            const translated = typeof parsed[index] === 'string' ? parsed[index].trim() : '';
            if (translated) {
              translationCacheRef.current.set(original, translated);
            }
          });
          setTranslationStatus('done');
        } else {
          setTranslationStatus('failed');
        }
      } catch (err) {
        setTranslationStatus('failed');
        console.warn('[Customizer] Name translation failed, using original names:', err);
      } finally {
        applyFromCache();
      }
    };

    void translateMissingNames();

    return () => {
      cancelled = true;
    };
  }, [i18n.resolvedLanguage, parameterNames]);

  // Capture default values on first successful parse
  if (defaultsRef.current === null && tabs.length > 0) {
    const defaults = new Map<string, string>();
    for (const tab of tabs) {
      for (const param of tab.params) {
        defaults.set(param.name, param.rawValue);
      }
    }
    defaultsRef.current = defaults;
  }

  // Check if any parameter has been modified from its default
  const hasChanges = useMemo(() => {
    if (!defaultsRef.current) return false;
    for (const tab of tabs) {
      for (const param of tab.params) {
        const defaultValue = defaultsRef.current.get(param.name);
        if (defaultValue !== undefined && param.rawValue !== defaultValue) {
          return true;
        }
      }
    }
    return false;
  }, [tabs]);

  // Reset all parameters to their default values
  const handleResetDefaults = useCallback(() => {
    if (!defaultsRef.current) return;

    let newCode = code;
    for (const tab of tabs) {
      for (const param of tab.params) {
        const defaultValue = defaultsRef.current.get(param.name);
        if (defaultValue !== undefined && param.rawValue !== defaultValue) {
          const assignmentPattern = new RegExp(`^(\\s*${param.name}\\s*=\\s*)([^;]+)(;.*)$`, 'gm');
          newCode = newCode.replace(assignmentPattern, (_, prefix, __, suffix) => {
            return prefix + defaultValue + suffix;
          });
        }
      }
    }

    if (newCode !== code) {
      onChange(newCode);
      eventBus.emit('code-updated', { code: newCode });
    }
  }, [code, tabs, onChange]);

  // Handle parameter value change
  const handleParameterChange = useCallback(
    async (param: CustomizerParam, newValue: string | number | boolean | number[]) => {
      // Format the new value as OpenSCAD code
      let formattedValue: string;

      if (typeof newValue === 'boolean') {
        formattedValue = String(newValue);
      } else if (Array.isArray(newValue)) {
        formattedValue = `[${newValue.join(', ')}]`;
      } else if (typeof newValue === 'string') {
        // Check if it was originally a string literal
        if (param.rawValue.startsWith('"') || param.rawValue.startsWith("'")) {
          formattedValue = `"${newValue}"`;
        } else {
          formattedValue = newValue;
        }
      } else {
        formattedValue = String(newValue);
      }

      // Find the assignment in the code and replace the value
      // Pattern: variableName = oldValue;
      let newCode = code;

      // Find the line with this parameter assignment
      // We'll use a more robust approach: find by variable name and replace the value
      const assignmentPattern = new RegExp(`^(\\s*${param.name}\\s*=\\s*)([^;]+)(;.*)$`, 'gm');

      newCode = code.replace(assignmentPattern, (_, prefix, __, suffix) => {
        // Preserve trailing comment if exists
        return prefix + formattedValue + suffix;
      });

      if (newCode !== code) {
        onChange(newCode);
        eventBus.emit('code-updated', { code: newCode });
        if (import.meta.env.DEV)
          console.log('[Customizer] Triggered render after parameter change:', param.name);
      } else {
        console.warn('[Customizer] Failed to update parameter:', param.name);
      }
    },
    [code, onChange]
  );

  const toggleTab = useCallback((tabName: string) => {
    setCollapsedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabName)) {
        next.delete(tabName);
      } else {
        next.add(tabName);
      }
      return next;
    });
  }, []);

  const handleExplainParameter = useCallback(
    (paramName: string) => {
      if (!onExplainParameter) return;
      const isChineseMode = i18n.resolvedLanguage?.startsWith('zh');
      const prompt = isChineseMode
        ? t('customizer.explainPrompt.zh', { param: paramName, code })
        : t('customizer.explainPrompt.en', { param: paramName, code });
      onExplainParameter(prompt);
    },
    [code, i18n.resolvedLanguage, onExplainParameter, t]
  );

  // If no parameters found, show helpful message
  if (tabs.length === 0) {
    return (
      <div
        className="h-full flex items-center justify-center p-3"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="text-center">
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            {t('customizer.noParameters')}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('customizer.addCommentsHint')}
          </p>
          <pre
            className="mt-2 text-left text-xs p-2 rounded"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              fontSize: '10px',
            }}
          >
            {`width = 10; // [0:100]`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div
        className="sticky top-0 z-10 px-3 py-2 border-b"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {t('customizer.parametersTitle')}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {t('customizer.parametersSubtitle')}
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={!hasChanges}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors"
            style={{
              backgroundColor: hasChanges ? 'var(--bg-tertiary)' : 'transparent',
              color: hasChanges ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              cursor: hasChanges ? 'pointer' : 'default',
              opacity: hasChanges ? 1 : 0.5,
            }}
            title={t('customizer.resetTooltip')}
          >
            <TbRefresh size={12} />
            {t('customizer.reset')}
          </button>

          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{
              border: '1px solid var(--border-secondary)',
              color:
                translationStatus === 'failed'
                  ? 'var(--color-error)'
                  : translationStatus === 'in-progress'
                    ? 'var(--accent-primary)'
                    : 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
            title={t('customizer.translateStatus')}
          >
            {t('customizer.translateStatus')}: {t(`customizer.translate.${translationStatus}`)}
          </span>
        </div>
      </div>

      <div className="p-3 pt-2 space-y-2">
        {tabs.map((tab) => {
          const isCollapsed = collapsedTabs.has(tab.name);

          return (
            <div
              key={tab.name}
              className="rounded-lg border overflow-hidden"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)',
              }}
            >
              {/* Tab header - more compact */}
              <button
                onClick={() => toggleTab(tab.name)}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  borderBottom: isCollapsed ? 'none' : '1px solid var(--border-secondary)',
                }}
              >
                {isCollapsed ? <TbChevronRight size={14} /> : <TbChevronDown size={14} />}
                <span className="font-medium text-xs">{tab.name}</span>
                <span
                  className="text-xs ml-auto"
                  style={{ color: 'var(--text-secondary)', fontSize: '10px' }}
                >
                  {tab.params.length}
                </span>
              </button>

              {/* Tab content */}
              {!isCollapsed && (
                <div className="px-2 py-1.5 space-y-0.5">
                  {tab.params.map((param) => (
                    <ParameterControl
                      key={`${param.name}-${param.line}`}
                      param={{
                        ...param,
                        translatedName: translatedNames[param.name],
                      }}
                      onChange={(newValue) => handleParameterChange(param, newValue)}
                      onExplain={() => handleExplainParameter(param.name)}
                      explainLabel={t('customizer.explain')}
                      explainDisabled={isAiStreaming}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
