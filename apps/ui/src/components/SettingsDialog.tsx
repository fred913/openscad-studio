import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  loadSettings,
  saveSettings,
  getDefaultVimConfig,
  type Settings,
} from '../stores/settingsStore';
import { getAvailableThemes, getTheme } from '../themes';
import { useTheme } from '../contexts/ThemeContext';
import { Button, Input, Select, Label, Toggle } from './ui';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { registerVimConfigLanguage } from '../languages/vimConfigLanguage';
import { TbPalette, TbCode, TbSparkles, TbX } from 'react-icons/tb';
import {
  invalidateApiKeyStatus,
  storeApiKey as storeApiKeyToStorage,
  clearApiKey as clearApiKeyFromStorage,
  hasApiKeyForProvider,
  getAvailableProviders as getAvailableProvidersFromStore,
  setOpenAIBaseUrl,
  getOpenAIBaseUrl,
  setCustomModels,
  getCustomModels,
} from '../stores/apiKeyStore';
import { setLanguage, getLanguage } from '../i18n';
import { getPlatform } from '../platform';
import { applyWorkspacePreset } from '../stores/layoutStore';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsSection;
}

function saveVimConfigIfChanged(localVimConfig: string, currentSettings: Settings) {
  if (localVimConfig !== currentSettings.editor.vimConfig) {
    const updated = {
      ...currentSettings,
      editor: {
        ...currentSettings.editor,
        vimConfig: localVimConfig,
      },
    };
    saveSettings(updated);
  }
}

export type SettingsSection = 'appearance' | 'editor' | 'ai';
type EditorSubTab = 'general' | 'vim';

export function SettingsDialog({ isOpen, onClose, initialTab }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialTab ?? 'appearance');
  const [editorSubTab, setEditorSubTab] = useState<EditorSubTab>('general');
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const { updateTheme } = useTheme();
  const availableThemes = getAvailableThemes();
  const vimEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  // Local vim config state (not saved to settings until dialog closes)
  const [localVimConfig, setLocalVimConfig] = useState<string>(settings.editor.vimConfig);

  // AI Settings
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [customModelsConfig, setCustomModelsConfig] = useState('');
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  const [isLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const loadAISettings = useCallback(() => {
    const availableProviders = getAvailableProvidersFromStore();
    setHasOpenAIKey(availableProviders.includes('openai'));

    const hasCurrentKey = hasApiKeyForProvider('openai');
    if (hasCurrentKey) {
      setApiKey('••••••••••••••••••••••••••••••••••••••••••••');
    } else {
      setApiKey('');
    }
    
    setBaseUrl(getOpenAIBaseUrl() || '');
    setCustomModelsConfig(getCustomModels() || '');
  }, []);

  useEffect(() => {
    if (isOpen) {
      const loadedSettings = loadSettings();
      setSettings(loadedSettings);
      setLocalVimConfig(loadedSettings.editor.vimConfig);
      loadAISettings();
      if (initialTab) setActiveSection(initialTab);
    }
  }, [isOpen, initialTab, loadAISettings]);

  const handleAppearanceSettingChange = <K extends keyof Settings['appearance']>(
    key: K,
    value: Settings['appearance'][K]
  ) => {
    const updated = {
      ...settings,
      appearance: {
        ...settings.appearance,
        [key]: value,
      },
    };
    setSettings(updated);
    saveSettings(updated);

    if (key === 'theme') {
      updateTheme(value as string);
    }
  };

  const handleEditorSettingChange = <K extends keyof Settings['editor']>(
    key: K,
    value: Settings['editor'][K]
  ) => {
    const updated = {
      ...settings,
      editor: {
        ...settings.editor,
        [key]: value,
      },
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleSave = () => {
    if (!apiKey.trim() || apiKey.startsWith('•')) {
      setError(t('settings.enterValidKey'));
      return;
    }

    setError(null);
    setSuccessMessage(null);

    storeApiKeyToStorage('openai', apiKey);
    setOpenAIBaseUrl(baseUrl);
    setCustomModels(customModelsConfig);
    invalidateApiKeyStatus();
    setSuccessMessage(t('settings.keySaved'));

    setHasOpenAIKey(true);
    setApiKey('••••••••••••••••••••••••••••••••••••••••••••');
    setShowKey(false);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleClear = async () => {
    const confirmed = await getPlatform().confirm(
      t('settings.removeKeyConfirm'),
      { 
        title: t('settings.removeKeyTitle'), 
        kind: 'warning', 
        okLabel: t('settings.removeKeyOk'), 
        cancelLabel: t('settings.removeKeyCancel') 
      }
    );
    if (!confirmed) return;

    setError(null);
    setSuccessMessage(null);

    clearApiKeyFromStorage('openai');
    invalidateApiKeyStatus();
    setSuccessMessage(t('settings.keyCleared'));

    setHasOpenAIKey(false);
    setApiKey('');
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleClose = () => {
    // Save vim config changes before closing
    saveVimConfigIfChanged(localVimConfig, settings);
    onClose();
  };

  if (!isOpen) return null;

  const navItems: { key: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { key: 'appearance', label: t('settings.appearance'), icon: <TbPalette size={16} /> },
    { key: 'editor', label: t('settings.editor'), icon: <TbCode size={16} /> },
    { key: 'ai', label: t('settings.ai'), icon: <TbSparkles size={16} /> },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
      onClick={handleClose}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex h-[600px] overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left Sidebar */}
        <div
          className="w-52 flex flex-col"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderRight: '1px solid var(--border-primary)',
          }}
        >
          <div className="px-5 py-5">
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {t('settings.title')}
            </h2>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
                style={{
                  backgroundColor:
                    activeSection === item.key ? 'var(--accent-primary)' : 'transparent',
                  color:
                    activeSection === item.key ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  fontWeight: activeSection === item.key ? '500' : 'normal',
                }}
                onMouseEnter={(e) => {
                  if (activeSection !== item.key) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSection !== item.key) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 shrink-0"
            style={{ borderBottom: '1px solid var(--border-primary)' }}
          >
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
              {activeSection === 'appearance'
                ? t('settings.appearance')
                : activeSection === 'editor'
                  ? t('settings.editor')
                  : t('settings.ai')}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <TbX size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <Label>{t('settings.language')}</Label>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
                    {t('settings.languageDesc')}
                  </p>
                  <Select
                    value={getLanguage()}
                    onChange={(e) => {
                      setLanguage(e.target.value);
                      window.location.reload(); // Reload to apply language change
                    }}
                  >
                    <option value="en">English</option>
                    <option value="zh">简体中文 (Simplified Chinese)</option>
                  </Select>
                </div>

                <div>
                  <Label>{t('settings.defaultLayout')}</Label>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
                    {t('settings.defaultLayoutDesc')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { preset: 'default' as const, label: t('settings.editorFirst') },
                      { preset: 'ai-first' as const, label: t('settings.aiFirst') },
                    ].map(({ preset, label }) => {
                      const isActive = settings.ui.defaultLayoutPreset === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...settings,
                              ui: { ...settings.ui, defaultLayoutPreset: preset },
                            };
                            setSettings(updated);
                            saveSettings(updated);
                            applyWorkspacePreset(preset);
                          }}
                          className="rounded-md p-3 text-left transition-all duration-150"
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            border: isActive
                              ? '2px solid var(--accent-primary)'
                              : '1px solid var(--border-primary)',
                            padding: isActive ? 'calc(0.75rem - 1px)' : undefined,
                            boxShadow: isActive ? '0 0 0 1px var(--accent-primary)' : undefined,
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.boxShadow = 'none';
                            }
                          }}
                        >
                          <span
                            className="text-sm"
                            style={{
                              color: 'var(--text-primary)',
                              fontWeight: isActive ? 600 : 400,
                            }}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label>{t('settings.theme')}</Label>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
                    {t('settings.themeDesc')}
                  </p>
                  {availableThemes.map((section) => (
                    <div key={section.category} className="mb-4">
                      <div
                        className="text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {section.category}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {section.themes.map((t) => {
                          const themeData = getTheme(t.id);
                          const isSelected = settings.appearance.theme === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleAppearanceSettingChange('theme', t.id)}
                              className="flex flex-col rounded-md p-2.5 text-left transition-all duration-150"
                              style={{
                                backgroundColor: 'var(--bg-primary)',
                                border: isSelected
                                  ? '2px solid var(--accent-primary)'
                                  : '1px solid var(--border-primary)',
                                padding: isSelected ? 'calc(0.625rem - 1px)' : undefined,
                                boxShadow: isSelected
                                  ? '0 0 0 1px var(--accent-primary)'
                                  : undefined,
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.transform = 'translateY(-1px)';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.transform = 'none';
                                  e.currentTarget.style.boxShadow = 'none';
                                }
                              }}
                            >
                              <span
                                className="text-xs mb-1.5 truncate w-full"
                                style={{
                                  color: 'var(--text-primary)',
                                  fontWeight: isSelected ? 600 : 400,
                                }}
                              >
                                {t.name}
                              </span>
                              <div className="flex h-3 rounded-sm overflow-hidden w-full">
                                <div
                                  className="flex-1"
                                  style={{ background: themeData.colors.bg.primary }}
                                />
                                <div
                                  className="flex-1"
                                  style={{ background: themeData.colors.accent.primary }}
                                />
                                <div
                                  className="flex-1"
                                  style={{ background: themeData.colors.text.primary }}
                                />
                                <div
                                  className="flex-1"
                                  style={{ background: themeData.colors.bg.secondary }}
                                />
                                <div
                                  className="flex-1"
                                  style={{ background: themeData.colors.semantic.error }}
                                />
                                <div
                                  className="flex-1"
                                  style={{ background: themeData.colors.semantic.success }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'editor' && (
              <div className="space-y-5">
                {/* Subtabs */}
                <div
                  className="inline-flex rounded-lg p-1"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setEditorSubTab('general')}
                    className="px-4 py-1.5 text-sm rounded-md transition-all duration-150"
                    style={{
                      backgroundColor:
                        editorSubTab === 'general' ? 'var(--accent-primary)' : 'transparent',
                      color:
                        editorSubTab === 'general'
                          ? 'var(--text-inverse)'
                          : 'var(--text-secondary)',
                      fontWeight: editorSubTab === 'general' ? '500' : 'normal',
                    }}
                  >
                    {t('settings.general')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorSubTab('vim')}
                    className="px-4 py-1.5 text-sm rounded-md transition-all duration-150"
                    style={{
                      backgroundColor:
                        editorSubTab === 'vim' ? 'var(--accent-primary)' : 'transparent',
                      color:
                        editorSubTab === 'vim' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                      fontWeight: editorSubTab === 'vim' ? '500' : 'normal',
                    }}
                  >
                    {t('settings.vim')}
                  </button>
                </div>

                {/* General Settings */}
                {editorSubTab === 'general' && (
                  <div
                    className="rounded-lg"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                    }}
                  >
                    <div
                      className="flex items-center justify-between p-4"
                      style={{ borderBottom: '1px solid var(--border-primary)' }}
                    >
                      <div>
                        <Label className="mb-0">{t('settings.formatOnSave')}</Label>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('settings.formatOnSaveDesc')}
                        </p>
                      </div>
                      <Toggle
                        checked={settings.editor.formatOnSave}
                        onChange={(e) =>
                          handleEditorSettingChange('formatOnSave', e.target.checked)
                        }
                      />
                    </div>

                    <div
                      className="p-4"
                      style={{ borderBottom: '1px solid var(--border-primary)' }}
                    >
                      <Label>{t('settings.indentSize')}</Label>
                      <Select
                        value={settings.editor.indentSize}
                        onChange={(e) =>
                          handleEditorSettingChange('indentSize', Number(e.target.value))
                        }
                      >
                        <option value={2}>{t('settings.indentSizeSpaces', { count: 2 })}</option>
                        <option value={4}>{t('settings.indentSizeSpaces', { count: 4 })}</option>
                        <option value={8}>{t('settings.indentSizeSpaces', { count: 8 })}</option>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-4">
                      <div>
                        <Label className="mb-0">{t('settings.useTabs')}</Label>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('settings.useTabsDesc')}
                        </p>
                      </div>
                      <Toggle
                        checked={settings.editor.useTabs}
                        onChange={(e) => handleEditorSettingChange('useTabs', e.target.checked)}
                      />
                    </div>

                    <div
                      className="flex items-center justify-between p-4"
                      style={{ borderBottom: '1px solid var(--border-primary)' }}
                    >
                      <div>
                        <Label className="mb-0">{t('settings.autoRender')}</Label>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('settings.autoRenderDesc')}
                        </p>
                      </div>
                      <Toggle
                        checked={settings.editor.autoRenderOnIdle}
                        onChange={(e) =>
                          handleEditorSettingChange('autoRenderOnIdle', e.target.checked)
                        }
                      />
                    </div>

                    {settings.editor.autoRenderOnIdle && (
                      <div
                        className="p-4"
                        style={{ borderBottom: '1px solid var(--border-primary)' }}
                      >
                        <Label>{t('settings.renderDelay')}</Label>
                        <Select
                          value={settings.editor.autoRenderDelayMs}
                          onChange={(e) =>
                            handleEditorSettingChange('autoRenderDelayMs', Number(e.target.value))
                          }
                        >
                          <option value={300}>{t('settings.renderDelayFast')}</option>
                          <option value={500}>{t('settings.renderDelayDefault')}</option>
                          <option value={1000}>{t('settings.renderDelay1s')}</option>
                          <option value={2000}>{t('settings.renderDelay2s')}</option>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Vim Settings */}
                {editorSubTab === 'vim' && (
                  <div className="space-y-4">
                    {/* Vim Mode Toggle */}
                    <div
                      className="flex items-center justify-between p-4 rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                      }}
                    >
                      <div>
                        <Label className="mb-0">{t('settings.enableVim')}</Label>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                          {t('settings.enableVimDesc')}
                        </p>
                      </div>
                      <Toggle
                        checked={settings.editor.vimMode}
                        onChange={(e) => handleEditorSettingChange('vimMode', e.target.checked)}
                      />
                    </div>

                    {/* Vim Configuration Editor */}
                    {settings.editor.vimMode && (
                      <div
                        className="rounded-lg p-4 space-y-3"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-primary)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <Label className="mb-0">{t('settings.vimConfig')}</Label>
                          <button
                            type="button"
                            onClick={() => setLocalVimConfig(getDefaultVimConfig())}
                            className="text-xs px-2.5 py-1 rounded-md transition-all duration-150"
                            style={{
                              color: 'var(--accent-primary)',
                              border: '1px solid var(--border-primary)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            {t('settings.resetDefaults')}
                          </button>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {t('settings.vimConfigDesc')}
                        </p>
                        <div
                          style={{
                            height: '260px',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '6px',
                            overflow: 'hidden',
                          }}
                        >
                          <MonacoEditor
                            key={`vim-config-editor-${settings.editor.vimMode}`}
                            height="100%"
                            defaultLanguage="vimconfig"
                            theme={getTheme(settings.appearance.theme).monaco}
                            value={localVimConfig}
                            onChange={(val) => setLocalVimConfig(val ?? '')}
                            beforeMount={(monaco) => {
                              // Register vim config language before mounting
                              registerVimConfigLanguage(monaco);

                              // Register all custom themes
                              const themeIds = [
                                'solarized-dark',
                                'solarized-light',
                                'monokai',
                                'dracula',
                                'one-dark-pro',
                                'github-dark',
                                'github-light',
                                'nord',
                                'tokyo-night',
                                'gruvbox-dark',
                                'gruvbox-light',
                              ];

                              themeIds.forEach((id) => {
                                const theme = getTheme(id);
                                if (theme.monacoTheme) {
                                  try {
                                    monaco.editor.defineTheme(id, theme.monacoTheme);
                                  } catch {
                                    // Theme might already be registered, ignore error
                                  }
                                }
                              });
                            }}
                            onMount={(editor) => {
                              vimEditorRef.current = editor;

                              // Ensure this editor is completely independent
                              editor.updateOptions({
                                readOnly: false,
                                domReadOnly: false,
                              });

                              // Focus the editor to ensure it's active
                              editor.focus();
                            }}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 13,
                              lineNumbers: 'on',
                              scrollBeyondLastLine: false,
                              automaticLayout: true,
                              wordWrap: 'on',
                              tabSize: 2,
                              renderLineHighlight: 'line',
                              contextmenu: true,
                              // Ensure the editor captures all keyboard events
                              quickSuggestions: false,
                              parameterHints: { enabled: false },
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {t('settings.vimConfigSupported')}{' '}
                            <code style={{ color: 'var(--text-primary)' }}>map</code>,{' '}
                            <code style={{ color: 'var(--text-primary)' }}>imap</code>,{' '}
                            <code style={{ color: 'var(--text-primary)' }}>nmap</code>,{' '}
                            <code style={{ color: 'var(--text-primary)' }}>vmap</code>
                            {' • '}
                            {t('settings.vimConfigExample')}{' '}
                            <code style={{ color: 'var(--text-primary)' }}>
                              map kj &lt;Esc&gt; insert
                            </code>
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              handleEditorSettingChange('vimConfig', localVimConfig);
                            }}
                            disabled={localVimConfig === settings.editor.vimConfig}
                            className="text-sm px-4 py-1.5 rounded-md transition-all duration-150 shrink-0 ml-3"
                            style={{
                              backgroundColor:
                                localVimConfig !== settings.editor.vimConfig
                                  ? 'var(--accent-primary)'
                                  : 'transparent',
                              color:
                                localVimConfig !== settings.editor.vimConfig
                                  ? 'white'
                                  : 'var(--text-tertiary)',
                              border: '1px solid var(--border-primary)',
                              opacity: localVimConfig !== settings.editor.vimConfig ? 1 : 0.5,
                              cursor:
                                localVimConfig !== settings.editor.vimConfig
                                  ? 'pointer'
                                  : 'not-allowed',
                            }}
                          >
                            {t('settings.apply')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'ai' && (
              <div className="space-y-5">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('settings.aiSettingsDesc')}
                </p>

                {/* OpenAI Section */}
                <div
                  className="rounded-lg p-4 space-y-3"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Label className="mb-0">{t('settings.openaiKey')}</Label>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: hasOpenAIKey
                          ? 'rgba(133, 153, 0, 0.15)'
                          : 'rgba(128, 128, 128, 0.1)',
                        color: hasOpenAIKey ? 'var(--color-success)' : 'var(--text-tertiary)',
                      }}
                    >
                      {hasOpenAIKey ? t('settings.configured') : t('settings.notConfigured')}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('settings.openaiKeyDesc')}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="pr-20 font-mono text-sm"
                        disabled={isLoading}
                      />
                      {apiKey && !apiKey.startsWith('•') && (
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {showKey ? t('settings.hide') : t('settings.show')}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleClear}
                      disabled={isLoading || !hasOpenAIKey}
                      className="flex items-center justify-center w-9 h-9 rounded-md transition-all duration-150 shrink-0"
                      style={{
                        backgroundColor: 'transparent',
                        border: '1px solid var(--border-primary)',
                        color:
                          hasOpenAIKey && !isLoading
                            ? 'var(--color-error)'
                            : 'var(--text-tertiary)',
                        opacity: hasOpenAIKey && !isLoading ? 1 : 0.4,
                        cursor: hasOpenAIKey && !isLoading ? 'pointer' : 'not-allowed',
                      }}
                      title={hasOpenAIKey ? t('settings.remove') : t('settings.noKeyToRemove')}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <title>{t('common.delete')}</title>
                        <path
                          d="M2 4h12M5.333 4V2.667a.667.667 0 01.667-.667h4a.667.667 0 01.667.667V4m2 0v9.333a.667.667 0 01-.667.667H4a.667.667 0 01-.667-.667V4h9.334z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('settings.getKey')}{' '}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                      style={{ color: 'var(--accent-primary)' }}
                    >
                      {t('settings.getKeyLink')}
                    </a>
                  </p>
                </div>

                {/* OpenAI Base URL */}
                <div
                  className="rounded-lg p-4 space-y-3"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  <Label className="mb-0">{t('settings.openaiBaseUrl')}</Label>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('settings.openaiBaseUrlDesc')}
                  </p>
                  <Input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={t('settings.openaiBaseUrlPlaceholder')}
                    className="font-mono text-sm"
                    disabled={isLoading}
                  />
                </div>

                {/* Custom Models */}
                <div
                  className="rounded-lg p-4 space-y-3"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  <Label className="mb-0">{t('settings.customModels')}</Label>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('settings.customModelsDesc')}
                  </p>
                  <Input
                    type="text"
                    value={customModelsConfig}
                    onChange={(e) => setCustomModelsConfig(e.target.value)}
                    placeholder={t('settings.customModelsPlaceholder')}
                    className="font-mono text-sm"
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'rgba(220, 50, 47, 0.1)',
                      border: '1px solid rgba(220, 50, 47, 0.3)',
                      color: 'var(--color-error)',
                    }}
                  >
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'rgba(133, 153, 0, 0.1)',
                      border: '1px solid rgba(133, 153, 0, 0.3)',
                      color: 'var(--color-success)',
                    }}
                  >
                    {successMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-2 px-6 py-3 shrink-0"
            style={{ borderTop: '1px solid var(--border-primary)' }}
          >
            {activeSection === 'ai' && (
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isLoading || !apiKey.trim() || apiKey.startsWith('•')}
              >
                {isLoading ? t('settings.saving') : t('settings.save')}
              </Button>
            )}
            <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
              {activeSection === 'ai' ? t('settings.cancel') : t('settings.close')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
