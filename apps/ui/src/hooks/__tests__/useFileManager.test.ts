/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useFileManager } from '../useFileManager';

const mockGetActiveTab = jest.fn();
const mockMarkTabSaved = jest.fn();
const mockReplaceFirstTab = jest.fn();
const mockCreateTab = jest.fn();
const mockSwitchTab = jest.fn();

jest.mock('../../stores/tabStore', () => ({
  useTabStore: {
    getState: () => ({
      getActiveTab: mockGetActiveTab,
      markTabSaved: mockMarkTabSaved,
      replaceFirstTab: mockReplaceFirstTab,
      createTab: mockCreateTab,
      switchTab: mockSwitchTab,
      tabs: [
        {
          id: 'tab-1',
          filePath: null,
          name: 'Untitled',
          content: '',
          savedContent: '',
          isDirty: false,
        },
      ],
    }),
  },
}));

const mockUpdateSource = jest.fn();
const mockRenderOnSave = jest.fn();
const mockManualRender = jest.fn();

jest.mock('../../stores/editorStore', () => ({
  useEditorStore: {
    getState: () => ({
      source: 'cube(1);',
      updateSource: mockUpdateSource,
      renderOnSave: mockRenderOnSave,
      manualRender: mockManualRender,
    }),
  },
}));

const mockSetShowWelcome = jest.fn();

jest.mock('../../stores/uiStore', () => ({
  useUiStore: {
    getState: () => ({
      showWelcome: false,
      setShowWelcome: mockSetShowWelcome,
    }),
  },
}));

const mockFileSave = jest.fn();
const mockFileSaveAs = jest.fn();
const mockFileOpen = jest.fn();
const mockAsk = jest.fn();
const mockConfirm = jest.fn();

jest.mock('../../platform', () => ({
  getPlatform: () => ({
    fileSave: mockFileSave,
    fileSaveAs: mockFileSaveAs,
    fileOpen: mockFileOpen,
    ask: mockAsk,
    confirm: mockConfirm,
    capabilities: { hasFileSystem: true },
    setWindowTitle: jest.fn(),
  }),
}));

jest.mock('../../stores/settingsStore', () => ({
  loadSettings: () => ({ editor: { formatOnSave: false, indentSize: 2, useTabs: false } }),
}));

jest.mock('../../utils/formatter', () => ({
  formatOpenScadCode: jest.fn((code: string) => code),
}));

jest.mock('../../components/WelcomeScreen', () => ({
  addToRecentFiles: jest.fn(),
}));

jest.mock('../../stores/layoutStore', () => ({
  getDockviewApi: () => null,
}));

jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

describe('useFileManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveTab.mockReturnValue({
      id: 'tab-1',
      filePath: null,
      name: 'Untitled',
      content: 'cube(1);',
      savedContent: 'cube(1);',
      isDirty: false,
    });
  });

  it('saveFile returns true on successful save', async () => {
    mockFileSave.mockResolvedValue('/path/to/file.scad');
    const { result } = renderHook(() => useFileManager());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.saveFile();
    });

    expect(success).toBe(true);
    expect(mockMarkTabSaved).toHaveBeenCalledWith(
      'tab-1',
      '/path/to/file.scad',
      'file.scad',
      'cube(1);'
    );
    expect(mockRenderOnSave).toHaveBeenCalled();
  });

  it('saveFile returns false when user cancels', async () => {
    mockFileSave.mockResolvedValue(null);
    const { result } = renderHook(() => useFileManager());

    let success: boolean = true;
    await act(async () => {
      success = await result.current.saveFile();
    });

    expect(success).toBe(false);
    expect(mockMarkTabSaved).not.toHaveBeenCalled();
  });

  it('saveFile uses fileSaveAs when promptForPath is true', async () => {
    mockFileSaveAs.mockResolvedValue('/new/path.scad');
    const { result } = renderHook(() => useFileManager());

    await act(async () => {
      await result.current.saveFile(true);
    });

    expect(mockFileSaveAs).toHaveBeenCalled();
    expect(mockFileSave).not.toHaveBeenCalled();
  });

  it('handleOpenFile opens a file and creates a tab', async () => {
    mockFileOpen.mockResolvedValue({
      path: '/test.scad',
      name: 'test.scad',
      content: 'sphere(1);',
    });
    const { result } = renderHook(() => useFileManager());

    await act(async () => {
      await result.current.handleOpenFile();
    });

    expect(mockCreateTab).toHaveBeenCalledWith('/test.scad', 'sphere(1);', 'test.scad');
    expect(mockSetShowWelcome).toHaveBeenCalledWith(false);
  });

  it('handleOpenFile does nothing when user cancels', async () => {
    mockFileOpen.mockResolvedValue(null);
    const { result } = renderHook(() => useFileManager());

    await act(async () => {
      await result.current.handleOpenFile();
    });

    expect(mockCreateTab).not.toHaveBeenCalled();
  });

  it('handleStartManually hides welcome screen', () => {
    const { result } = renderHook(() => useFileManager());
    act(() => {
      result.current.handleStartManually();
    });
    expect(mockSetShowWelcome).toHaveBeenCalledWith(false);
  });

  it('checkUnsavedChanges returns true when tab is clean', async () => {
    const { result } = renderHook(() => useFileManager());

    let canProceed: boolean = false;
    await act(async () => {
      canProceed = await result.current.checkUnsavedChanges();
    });

    expect(canProceed).toBe(true);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('checkUnsavedChanges prompts user when tab is dirty', async () => {
    mockGetActiveTab.mockReturnValue({
      id: 'tab-1',
      filePath: null,
      name: 'Untitled',
      content: 'modified',
      savedContent: 'original',
      isDirty: true,
    });
    mockAsk.mockResolvedValue(false);
    mockConfirm.mockResolvedValue(true);

    const { result } = renderHook(() => useFileManager());

    let canProceed: boolean = false;
    await act(async () => {
      canProceed = await result.current.checkUnsavedChanges();
    });

    expect(canProceed).toBe(true);
    expect(mockAsk).toHaveBeenCalled();
    expect(mockConfirm).toHaveBeenCalled();
  });

  it('checkUnsavedChanges saves when user chooses save', async () => {
    mockGetActiveTab.mockReturnValue({
      id: 'tab-1',
      filePath: null,
      name: 'Untitled',
      content: 'modified',
      savedContent: 'original',
      isDirty: true,
    });
    mockAsk.mockResolvedValue(true);
    mockFileSave.mockResolvedValue('/saved.scad');

    const { result } = renderHook(() => useFileManager());

    let canProceed: boolean = false;
    await act(async () => {
      canProceed = await result.current.checkUnsavedChanges();
    });

    expect(canProceed).toBe(true);
    expect(mockFileSave).toHaveBeenCalled();
  });
});
