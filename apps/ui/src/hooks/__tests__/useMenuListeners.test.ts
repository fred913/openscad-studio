/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useMenuListeners } from '../useMenuListeners';

let eventHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockUnsubscribeFns: jest.Mock[] = [];

jest.mock('../../platform', () => ({
  eventBus: {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      eventHandlers[event] = handler;
      const unsub = jest.fn();
      mockUnsubscribeFns.push(unsub);
      return unsub;
    }),
  },
  getPlatform: () => ({
    fileOpen: jest.fn(),
    onCloseRequested: jest.fn(() => jest.fn()),
    setWindowTitle: jest.fn(),
  }),
}));

const mockManualRender = jest.fn();
const mockUpdateSourceAndRender = jest.fn();

jest.mock('../../stores/editorStore', () => ({
  useEditorStore: Object.assign(
    jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        source: 'cube(1);',
        manualRender: mockManualRender,
        updateSourceAndRender: mockUpdateSourceAndRender,
      })
    ),
    {
      getState: () => ({
        source: 'cube(1);',
        manualRender: mockManualRender,
        updateSourceAndRender: mockUpdateSourceAndRender,
      }),
    }
  ),
}));

const mockCreateTab = jest.fn();
const mockUpdateTabContent = jest.fn();

jest.mock('../../stores/tabStore', () => ({
  useTabStore: Object.assign(
    jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        tabs: [
          {
            id: 'tab-1',
            name: 'Untitled',
            isDirty: false,
            filePath: null,
            content: '',
            savedContent: '',
          },
        ],
        activeTabId: 'tab-1',
        getActiveTab: () => ({ id: 'tab-1', name: 'Untitled', isDirty: false }),
        isAnyDirty: () => false,
        createTab: mockCreateTab,
        updateTabContent: mockUpdateTabContent,
      })
    ),
    {
      getState: () => ({
        tabs: [
          {
            id: 'tab-1',
            name: 'Untitled',
            isDirty: false,
            filePath: null,
            content: '',
            savedContent: '',
          },
        ],
        activeTabId: 'tab-1',
        getActiveTab: () => ({ id: 'tab-1', name: 'Untitled', isDirty: false }),
        isAnyDirty: () => false,
        createTab: mockCreateTab,
        updateTabContent: mockUpdateTabContent,
      }),
    }
  ),
}));

const mockSetShowWelcome = jest.fn();

jest.mock('../../stores/uiStore', () => ({
  useUiStore: {
    getState: () => ({
      setShowWelcome: mockSetShowWelcome,
    }),
  },
}));

jest.mock('../../services/renderService', () => ({
  RenderService: {
    getInstance: () => ({
      exportModel: jest.fn(),
    }),
  },
}));

jest.mock('../../components/WelcomeScreen', () => ({
  addToRecentFiles: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

describe('useMenuListeners', () => {
  const mockCheckUnsavedChanges = jest.fn().mockResolvedValue(true);
  const mockSaveFile = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    eventHandlers = {};
    mockUnsubscribeFns.length = 0;
  });

  it('subscribes to all expected eventBus events', () => {
    renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    expect(eventHandlers['menu:file:new']).toBeDefined();
    expect(eventHandlers['menu:file:open']).toBeDefined();
    expect(eventHandlers['menu:file:save']).toBeDefined();
    expect(eventHandlers['menu:file:save_as']).toBeDefined();
    expect(eventHandlers['menu:file:export']).toBeDefined();
    expect(eventHandlers['render-requested']).toBeDefined();
    expect(eventHandlers['history:restore']).toBeDefined();
    expect(eventHandlers['code-updated']).toBeDefined();
  });

  it('menu:file:save calls saveFile(false)', async () => {
    renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    await eventHandlers['menu:file:save']();
    expect(mockSaveFile).toHaveBeenCalledWith(false);
  });

  it('menu:file:save_as calls saveFile(true)', async () => {
    renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    await eventHandlers['menu:file:save_as']();
    expect(mockSaveFile).toHaveBeenCalledWith(true);
  });

  it('menu:file:new checks unsaved changes and creates tab', async () => {
    renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    await eventHandlers['menu:file:new']();
    expect(mockCheckUnsavedChanges).toHaveBeenCalled();
    expect(mockCreateTab).toHaveBeenCalled();
    expect(mockSetShowWelcome).toHaveBeenCalledWith(true);
  });

  it('menu:file:new aborts when user cancels unsaved changes', async () => {
    mockCheckUnsavedChanges.mockResolvedValueOnce(false);
    renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    await eventHandlers['menu:file:new']();
    expect(mockCreateTab).not.toHaveBeenCalled();
  });

  it('render-requested calls manualRender', () => {
    renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    eventHandlers['render-requested']();
    expect(mockManualRender).toHaveBeenCalled();
  });

  it('history:restore updates source and tab content', () => {
    renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    eventHandlers['history:restore']({ code: 'sphere(1);' });
    expect(mockUpdateSourceAndRender).toHaveBeenCalledWith('sphere(1);');
    expect(mockUpdateTabContent).toHaveBeenCalledWith('tab-1', 'sphere(1);');
  });

  it('code-updated updates source and tab content', () => {
    renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    eventHandlers['code-updated']({ code: 'cylinder(1);' });
    expect(mockUpdateSourceAndRender).toHaveBeenCalledWith('cylinder(1);');
    expect(mockUpdateTabContent).toHaveBeenCalledWith('tab-1', 'cylinder(1);');
  });

  it('unsubscribes from all events on unmount', () => {
    const { unmount } = renderHook(() =>
      useMenuListeners({
        checkUnsavedChanges: mockCheckUnsavedChanges,
        saveFile: mockSaveFile,
      })
    );

    const unsubCount = mockUnsubscribeFns.length;
    expect(unsubCount).toBeGreaterThan(0);

    unmount();
    mockUnsubscribeFns.forEach((unsub) => {
      expect(unsub).toHaveBeenCalled();
    });
  });
});
