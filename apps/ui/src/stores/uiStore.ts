import { create } from 'zustand';
import type { StateCreator } from 'zustand';

export type SettingsSection = 'appearance' | 'editor' | 'ai';

export interface UiState {
  showWelcome: boolean;
  showNux: boolean;
  showExportDialog: boolean;
  showSettingsDialog: boolean;
  settingsInitialTab: SettingsSection | undefined;

  setShowWelcome: (show: boolean) => void;
  setShowNux: (show: boolean) => void;
  openExportDialog: () => void;
  closeExportDialog: () => void;
  openSettings: (tab?: SettingsSection) => void;
  closeSettings: () => void;
}

export const createUiStore: StateCreator<UiState> = (set) => ({
  showWelcome: true,
  showNux: false,
  showExportDialog: false,
  showSettingsDialog: false,
  settingsInitialTab: undefined,

  setShowWelcome: (show) => set({ showWelcome: show }),
  setShowNux: (show) => set({ showNux: show }),
  openExportDialog: () => set({ showExportDialog: true }),
  closeExportDialog: () => set({ showExportDialog: false }),
  openSettings: (tab) => set({ showSettingsDialog: true, settingsInitialTab: tab }),
  closeSettings: () => set({ showSettingsDialog: false, settingsInitialTab: undefined }),
});

export const useUiStore = create<UiState>(createUiStore);
