import { useEffect } from 'react';
import { useTabStore } from '../stores/tabStore';
import { useUiStore } from '../stores/uiStore';

interface UseKeyboardShortcutsOptions {
  aiPromptPanelRef: React.RefObject<{ focusPrompt: () => void } | null>;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { aiPromptPanelRef } = options;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setTimeout(() => {
          aiPromptPanelRef.current?.focusPrompt();
        }, 0);
      }

      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        useUiStore.getState().openSettings();
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 't') {
        event.preventDefault();
        useTabStore.getState().createTab();
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'w') {
        event.preventDefault();
        const { activeTabId, closeTab } = useTabStore.getState();
        closeTab(activeTabId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [aiPromptPanelRef]);
}
