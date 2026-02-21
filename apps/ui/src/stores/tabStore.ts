import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import type { Tab } from '../components/TabBar';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

const DEFAULT_CONTENT = '// Type your OpenSCAD code here\ncube([10, 10, 10]);';

function createDefaultTab(): Tab {
  return {
    id: generateId(),
    filePath: null,
    name: 'Untitled',
    content: DEFAULT_CONTENT,
    savedContent: DEFAULT_CONTENT,
    isDirty: false,
  };
}

export interface TabState {
  tabs: Tab[];
  activeTabId: string;

  createTab: (filePath?: string | null, content?: string, name?: string) => string;
  switchTab: (id: string) => void;
  closeTab: (id: string) => Tab[];
  updateTabContent: (id: string, content: string) => void;
  reorderTabs: (tabs: Tab[]) => void;
  markTabSaved: (id: string, filePath: string | null, name: string, content: string) => void;
  renameTab: (id: string, name: string) => void;
  replaceFirstTab: (filePath: string | null, name: string, content: string) => void;
  snapshotActiveTab: (
    previewSrc: string,
    previewKind: string,
    diagnostics: unknown[],
    dimensionMode: string,
    source: string
  ) => void;
  resetToDefault: () => void;
  getActiveTab: () => Tab;
  isAnyDirty: () => boolean;
}

export const createTabStore: StateCreator<TabState> = (set, get) => {
  const defaultTab = createDefaultTab();
  return {
    tabs: [defaultTab],
    activeTabId: defaultTab.id,

    createTab: (filePath = null, content = DEFAULT_CONTENT, name = 'Untitled') => {
      const id = generateId();
      const tab: Tab = {
        id,
        filePath,
        name,
        content,
        savedContent: content,
        isDirty: false,
      };
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: id,
      }));
      return id;
    },

    switchTab: (id) => {
      if (get().activeTabId === id) return;
      set({ activeTabId: id });
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get();
      const index = tabs.findIndex((t) => t.id === id);
      if (index === -1) return tabs;

      const remaining = tabs.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        set({ tabs: remaining });
        return remaining;
      }

      const updates: Partial<TabState> = { tabs: remaining };
      if (activeTabId === id) {
        const newIndex = Math.min(index, remaining.length - 1);
        updates.activeTabId = remaining[newIndex].id;
      }
      set(updates);
      return remaining;
    },

    updateTabContent: (id, content) => {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === id ? { ...t, content, isDirty: content !== t.savedContent } : t
        ),
      }));
    },

    reorderTabs: (tabs) => {
      set({ tabs });
    },

    markTabSaved: (id, filePath, name, content) => {
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === id ? { ...t, filePath, name, savedContent: content, isDirty: false } : t
        ),
      }));
    },

    renameTab: (id, name) => {
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === id ? { ...t, name } : t)),
      }));
    },

    replaceFirstTab: (filePath, name, content) => {
      set((state) => {
        const first = state.tabs[0];
        if (!first) return state;
        return {
          tabs: state.tabs.map((t, i) =>
            i === 0 ? { ...t, filePath, name, content, savedContent: content, isDirty: false } : t
          ),
          activeTabId: first.id,
        };
      });
    },

    snapshotActiveTab: (previewSrc, previewKind, diagnostics, dimensionMode, source) => {
      const { activeTabId } = get();
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                previewSrc,
                previewKind: previewKind as Tab['previewKind'],
                diagnostics,
                dimensionMode: dimensionMode as Tab['dimensionMode'],
                content: source,
              }
            : t
        ),
      }));
    },

    resetToDefault: () => {
      const tab = createDefaultTab();
      set({ tabs: [tab], activeTabId: tab.id });
    },

    getActiveTab: () => {
      const { tabs, activeTabId } = get();
      return tabs.find((t) => t.id === activeTabId) || tabs[0];
    },

    isAnyDirty: () => {
      return get().tabs.some((t) => t.isDirty);
    },
  };
};

export const useTabStore = create<TabState>(createTabStore);
