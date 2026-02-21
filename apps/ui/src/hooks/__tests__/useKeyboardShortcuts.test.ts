/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';
import { useTabStore } from '../../stores/tabStore';
import { useUiStore } from '../../stores/uiStore';

jest.mock('../../stores/tabStore', () => ({
  useTabStore: {
    getState: jest.fn(),
  },
}));

jest.mock('../../stores/uiStore', () => ({
  useUiStore: {
    getState: jest.fn(),
  },
}));

describe('useKeyboardShortcuts', () => {
  const mockCreateTab = jest.fn();
  const mockCloseTab = jest.fn();
  const mockOpenSettings = jest.fn();
  const mockFocusPrompt = jest.fn();
  const aiPromptPanelRef = { current: { focusPrompt: mockFocusPrompt } };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTabStore.getState as jest.Mock).mockReturnValue({
      createTab: mockCreateTab,
      closeTab: mockCloseTab,
      activeTabId: 'tab-1',
    });
    (useUiStore.getState as jest.Mock).mockReturnValue({
      openSettings: mockOpenSettings,
    });
  });

  function fireKeydown(key: string, metaKey = true) {
    const event = new KeyboardEvent('keydown', { key, metaKey, bubbles: true });
    jest.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    return event;
  }

  it('⌘K focuses AI prompt panel', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        aiPromptPanelRef: aiPromptPanelRef as React.RefObject<{ focusPrompt: () => void }>,
      })
    );
    jest.useFakeTimers();
    const event = fireKeydown('k');
    expect(event.preventDefault).toHaveBeenCalled();
    jest.runAllTimers();
    expect(mockFocusPrompt).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('⌘, opens settings', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        aiPromptPanelRef: aiPromptPanelRef as React.RefObject<{ focusPrompt: () => void }>,
      })
    );
    const event = fireKeydown(',');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockOpenSettings).toHaveBeenCalled();
  });

  it('⌘T creates a new tab', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        aiPromptPanelRef: aiPromptPanelRef as React.RefObject<{ focusPrompt: () => void }>,
      })
    );
    const event = fireKeydown('t');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockCreateTab).toHaveBeenCalled();
  });

  it('⌘W closes the active tab', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        aiPromptPanelRef: aiPromptPanelRef as React.RefObject<{ focusPrompt: () => void }>,
      })
    );
    const event = fireKeydown('w');
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockCloseTab).toHaveBeenCalledWith('tab-1');
  });

  it('does not fire on non-meta key presses', () => {
    renderHook(() =>
      useKeyboardShortcuts({
        aiPromptPanelRef: aiPromptPanelRef as React.RefObject<{ focusPrompt: () => void }>,
      })
    );
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: false, bubbles: true });
    window.dispatchEvent(event);
    expect(mockOpenSettings).not.toHaveBeenCalled();
    expect(mockCreateTab).not.toHaveBeenCalled();
    expect(mockCloseTab).not.toHaveBeenCalled();
  });

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        aiPromptPanelRef: aiPromptPanelRef as React.RefObject<{ focusPrompt: () => void }>,
      })
    );
    unmount();
    fireKeydown('t');
    expect(mockCreateTab).not.toHaveBeenCalled();
  });
});
