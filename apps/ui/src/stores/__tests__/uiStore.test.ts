/**
 * @jest-environment node
 */
import { createStore } from 'zustand/vanilla';
import { createUiStore, type UiState } from '../uiStore';

describe('uiStore', () => {
  const createTestStore = () => createStore(createUiStore);

  it('has correct initial state', () => {
    const store = createTestStore();
    const state = store.getState();
    expect(state.showWelcome).toBe(true);
    expect(state.showNux).toBe(false);
    expect(state.showExportDialog).toBe(false);
    expect(state.showSettingsDialog).toBe(false);
    expect(state.settingsInitialTab).toBeUndefined();
  });

  it('setShowWelcome updates showWelcome', () => {
    const store = createTestStore();
    store.getState().setShowWelcome(false);
    expect(store.getState().showWelcome).toBe(false);

    store.getState().setShowWelcome(true);
    expect(store.getState().showWelcome).toBe(true);
  });

  it('setShowNux updates showNux', () => {
    const store = createTestStore();
    store.getState().setShowNux(true);
    expect(store.getState().showNux).toBe(true);

    store.getState().setShowNux(false);
    expect(store.getState().showNux).toBe(false);
  });

  it('openExportDialog sets showExportDialog to true', () => {
    const store = createTestStore();
    store.getState().openExportDialog();
    expect(store.getState().showExportDialog).toBe(true);
  });

  it('closeExportDialog sets showExportDialog to false', () => {
    const store = createTestStore();
    store.getState().openExportDialog();
    store.getState().closeExportDialog();
    expect(store.getState().showExportDialog).toBe(false);
  });

  it('openSettings without tab sets showSettingsDialog true and settingsInitialTab undefined', () => {
    const store = createTestStore();
    store.getState().openSettings();
    const state = store.getState();
    expect(state.showSettingsDialog).toBe(true);
    expect(state.settingsInitialTab).toBeUndefined();
  });

  it('openSettings with tab sets both showSettingsDialog and settingsInitialTab', () => {
    const store = createTestStore();
    store.getState().openSettings('ai');
    const state = store.getState();
    expect(state.showSettingsDialog).toBe(true);
    expect(state.settingsInitialTab).toBe('ai');
  });

  it('closeSettings resets showSettingsDialog and settingsInitialTab', () => {
    const store = createTestStore();
    store.getState().openSettings('editor');
    store.getState().closeSettings();
    const state = store.getState();
    expect(state.showSettingsDialog).toBe(false);
    expect(state.settingsInitialTab).toBeUndefined();
  });

  it('multiple toggles work correctly (open, close, open again)', () => {
    const store = createTestStore();
    store.getState().openExportDialog();
    expect(store.getState().showExportDialog).toBe(true);

    store.getState().closeExportDialog();
    expect(store.getState().showExportDialog).toBe(false);

    store.getState().openExportDialog();
    expect(store.getState().showExportDialog).toBe(true);
  });

  it('openSettings with different tabs updates settingsInitialTab', () => {
    const store = createTestStore();
    store.getState().openSettings('editor');
    expect(store.getState().settingsInitialTab).toBe('editor');

    store.getState().closeSettings();
    store.getState().openSettings('appearance');
    expect(store.getState().settingsInitialTab).toBe('appearance');
  });
});
