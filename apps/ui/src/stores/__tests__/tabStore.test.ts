/**
 * @jest-environment node
 */
import { createStore } from 'zustand/vanilla';
import { createTabStore, type TabState } from '../tabStore';

describe('tabStore', () => {
  const createTestStore = () => createStore(createTabStore);

  it('initializes with one default untitled tab', () => {
    const store = createTestStore();
    const { tabs, activeTabId } = store.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe('Untitled');
    expect(tabs[0].filePath).toBeNull();
    expect(tabs[0].isDirty).toBe(false);
    expect(tabs[0].content).toContain('cube([10, 10, 10])');
    expect(activeTabId).toBe(tabs[0].id);
  });

  it('createTab appends a new tab and sets it active', () => {
    const store = createTestStore();
    const originalId = store.getState().activeTabId;
    const newId = store.getState().createTab(null, 'sphere(5);', 'NewFile');

    const { tabs, activeTabId } = store.getState();
    expect(tabs).toHaveLength(2);
    expect(activeTabId).toBe(newId);
    expect(activeTabId).not.toBe(originalId);
    expect(tabs[1].name).toBe('NewFile');
    expect(tabs[1].content).toBe('sphere(5);');
    expect(tabs[1].savedContent).toBe('sphere(5);');
    expect(tabs[1].isDirty).toBe(false);
  });

  it('createTab uses defaults when no args provided', () => {
    const store = createTestStore();
    store.getState().createTab();

    const { tabs } = store.getState();
    expect(tabs).toHaveLength(2);
    expect(tabs[1].name).toBe('Untitled');
    expect(tabs[1].filePath).toBeNull();
    expect(tabs[1].content).toContain('cube([10, 10, 10])');
  });

  it('switchTab changes activeTabId', () => {
    const store = createTestStore();
    const id2 = store.getState().createTab(null, '', 'Second');
    const id1 = store.getState().tabs[0].id;
    store.getState().switchTab(id1);

    expect(store.getState().activeTabId).toBe(id1);
    expect(store.getState().activeTabId).not.toBe(id2);
  });

  it('switchTab is a no-op for the same tab', () => {
    const store = createTestStore();
    const { activeTabId } = store.getState();
    const stateBefore = store.getState();
    store.getState().switchTab(activeTabId);

    expect(store.getState()).toBe(stateBefore);
  });

  it('closeTab removes the tab and selects the tab at the same position', () => {
    const store = createTestStore();
    store.getState().createTab(null, '', 'Second');
    const id3 = store.getState().createTab(null, '', 'Third');
    store.getState().switchTab(store.getState().tabs[1].id);
    const id2 = store.getState().tabs[1].id;

    const remaining = store.getState().closeTab(id2);

    expect(remaining).toHaveLength(2);
    expect(remaining.find((t) => t.id === id2)).toBeUndefined();
    expect(store.getState().activeTabId).toBe(id3);
  });

  it('closeTab selects last remaining tab when closing past the end', () => {
    const store = createTestStore();
    const id1 = store.getState().tabs[0].id;
    const id2 = store.getState().createTab(null, '', 'Second');
    store.getState().switchTab(id2);

    store.getState().closeTab(id2);

    expect(store.getState().activeTabId).toBe(id1);
    expect(store.getState().tabs).toHaveLength(1);
  });

  it('closeTab on last tab returns empty array', () => {
    const store = createTestStore();
    const id = store.getState().tabs[0].id;
    const remaining = store.getState().closeTab(id);

    expect(remaining).toHaveLength(0);
    expect(store.getState().tabs).toHaveLength(0);
  });

  it('closeTab on non-existent id returns tabs unchanged', () => {
    const store = createTestStore();
    const remaining = store.getState().closeTab('nonexistent');
    expect(remaining).toHaveLength(1);
  });

  it('closeTab does not change activeTabId when closing an inactive tab', () => {
    const store = createTestStore();
    const id1 = store.getState().tabs[0].id;
    const id2 = store.getState().createTab(null, '', 'Second');
    store.getState().switchTab(id1);

    store.getState().closeTab(id2);

    expect(store.getState().activeTabId).toBe(id1);
    expect(store.getState().tabs).toHaveLength(1);
  });

  it('updateTabContent sets content and isDirty correctly', () => {
    const store = createTestStore();
    const id = store.getState().tabs[0].id;
    store.getState().updateTabContent(id, 'modified content');

    const tab = store.getState().tabs[0];
    expect(tab.content).toBe('modified content');
    expect(tab.isDirty).toBe(true);
  });

  it('updateTabContent marks clean when content matches savedContent', () => {
    const store = createTestStore();
    const id = store.getState().tabs[0].id;
    const saved = store.getState().tabs[0].savedContent;

    store.getState().updateTabContent(id, 'changed');
    expect(store.getState().tabs[0].isDirty).toBe(true);

    store.getState().updateTabContent(id, saved);
    expect(store.getState().tabs[0].isDirty).toBe(false);
  });

  it('reorderTabs replaces the tabs array', () => {
    const store = createTestStore();
    store.getState().createTab(null, '', 'B');
    store.getState().createTab(null, '', 'C');
    const reversed = [...store.getState().tabs].reverse();

    store.getState().reorderTabs(reversed);

    expect(store.getState().tabs[0].name).toBe('C');
    expect(store.getState().tabs[2].name).toBe('Untitled');
  });

  it('markTabSaved updates filePath, name, savedContent and clears isDirty', () => {
    const store = createTestStore();
    const id = store.getState().tabs[0].id;
    store.getState().updateTabContent(id, 'new code');
    expect(store.getState().tabs[0].isDirty).toBe(true);

    store.getState().markTabSaved(id, '/path/to/file.scad', 'file.scad', 'new code');

    const tab = store.getState().tabs[0];
    expect(tab.filePath).toBe('/path/to/file.scad');
    expect(tab.name).toBe('file.scad');
    expect(tab.savedContent).toBe('new code');
    expect(tab.isDirty).toBe(false);
  });

  it('renameTab updates the name', () => {
    const store = createTestStore();
    const id = store.getState().tabs[0].id;
    store.getState().renameTab(id, 'Renamed');
    expect(store.getState().tabs[0].name).toBe('Renamed');
  });

  it('replaceFirstTab overwrites the first tab', () => {
    const store = createTestStore();
    store.getState().createTab(null, '', 'Second');
    store.getState().switchTab(store.getState().tabs[1].id);

    store.getState().replaceFirstTab('/file.scad', 'file.scad', 'content');

    const first = store.getState().tabs[0];
    expect(first.filePath).toBe('/file.scad');
    expect(first.name).toBe('file.scad');
    expect(first.content).toBe('content');
    expect(first.savedContent).toBe('content');
    expect(first.isDirty).toBe(false);
    expect(store.getState().activeTabId).toBe(first.id);
  });

  it('snapshotActiveTab stores render state on the active tab', () => {
    const store = createTestStore();
    store
      .getState()
      .snapshotActiveTab('blob://preview', 'mesh', [{ msg: 'warn' }], '3d', 'cube(1);');

    const tab = store.getState().getActiveTab();
    expect(tab.previewSrc).toBe('blob://preview');
    expect(tab.previewKind).toBe('mesh');
    expect(tab.diagnostics).toEqual([{ msg: 'warn' }]);
    expect(tab.dimensionMode).toBe('3d');
    expect(tab.content).toBe('cube(1);');
  });

  it('resetToDefault restores a single untitled tab', () => {
    const store = createTestStore();
    store.getState().createTab(null, 'a', 'A');
    store.getState().createTab(null, 'b', 'B');
    expect(store.getState().tabs).toHaveLength(3);

    store.getState().resetToDefault();

    const { tabs, activeTabId } = store.getState();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe('Untitled');
    expect(tabs[0].isDirty).toBe(false);
    expect(activeTabId).toBe(tabs[0].id);
  });

  it('getActiveTab returns the active tab', () => {
    const store = createTestStore();
    const id2 = store.getState().createTab(null, 'code2', 'Tab2');
    const active = store.getState().getActiveTab();
    expect(active.id).toBe(id2);
    expect(active.name).toBe('Tab2');
  });

  it('getActiveTab falls back to tabs[0] when activeTabId is invalid', () => {
    const store = createTestStore();

    store.setState({ activeTabId: 'nonexistent' });
    const active = store.getState().getActiveTab();
    expect(active).toBe(store.getState().tabs[0]);
  });

  it('isAnyDirty returns true when any tab is dirty', () => {
    const store = createTestStore();
    expect(store.getState().isAnyDirty()).toBe(false);

    const id = store.getState().tabs[0].id;
    store.getState().updateTabContent(id, 'dirty');
    expect(store.getState().isAnyDirty()).toBe(true);
  });

  it('isAnyDirty returns false when all tabs are clean', () => {
    const store = createTestStore();
    store.getState().createTab(null, 'clean', 'Clean');
    expect(store.getState().isAnyDirty()).toBe(false);
  });
});
