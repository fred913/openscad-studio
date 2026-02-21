import { useCallback } from 'react';
import { useTabStore } from '../stores/tabStore';
import { useEditorStore } from '../stores/editorStore';
import { useUiStore } from '../stores/uiStore';
import { getPlatform } from '../platform';
import { loadSettings } from '../stores/settingsStore';
import { formatOpenScadCode } from '../utils/formatter';
import { addToRecentFiles } from '../components/WelcomeScreen';
import { getDockviewApi } from '../stores/layoutStore';
import { toast } from 'sonner';

export interface UseFileManagerReturn {
  saveFile: (promptForPath?: boolean) => Promise<boolean>;
  handleOpenFile: () => Promise<void>;
  handleOpenRecent: (path: string) => Promise<void>;
  handleStartWithPrompt: (prompt: string, submitPrompt: (p: string) => void) => void;
  handleStartManually: () => void;
  checkUnsavedChanges: () => Promise<boolean>;
}

export function useFileManager(): UseFileManagerReturn {
  const saveFile = useCallback(async (promptForPath: boolean = false): Promise<boolean> => {
    try {
      const currentTab = useTabStore.getState().getActiveTab();
      let currentSource = useEditorStore.getState().source;
      const platform = getPlatform();
      const filters = [{ name: 'OpenSCAD Files', extensions: ['scad'] }];

      const currentSettings = loadSettings();
      if (currentSettings.editor.formatOnSave) {
        try {
          currentSource = await formatOpenScadCode(currentSource, {
            indentSize: currentSettings.editor.indentSize,
            useTabs: currentSettings.editor.useTabs,
          });
          useEditorStore.getState().updateSource(currentSource);
        } catch (err) {
          console.error('[saveFile] Failed to format code:', err);
        }
      }

      const suggestedName = currentTab.name || 'untitled';
      let savePath: string | null;
      if (promptForPath) {
        savePath = await platform.fileSaveAs(currentSource, filters, suggestedName);
      } else {
        savePath = await platform.fileSave(
          currentSource,
          currentTab.filePath,
          filters,
          suggestedName
        );
      }

      if (!savePath) return false;

      const fileName = savePath.split('/').pop() || savePath;
      useTabStore.getState().markTabSaved(currentTab.id, savePath, fileName, currentSource);

      const dockPanel = getDockviewApi()?.getPanel(currentTab.id);
      if (dockPanel) {
        dockPanel.api.setTitle(fileName);
      }

      addToRecentFiles(savePath);
      useEditorStore.getState().renderOnSave();

      return true;
    } catch (err) {
      console.error('[saveFile] Save failed:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to save file: ${errorMsg}`);
      return false;
    }
  }, []);

  const handleOpenFile = useCallback(async () => {
    try {
      const result = await getPlatform().fileOpen([
        { name: 'OpenSCAD Files', extensions: ['scad'] },
      ]);
      if (!result) return;

      const { tabs } = useTabStore.getState();

      if (result.path) {
        const existingTab = tabs.find((t) => t.filePath === result.path);
        if (existingTab) {
          useTabStore.getState().switchTab(existingTab.id);
          useUiStore.getState().setShowWelcome(false);
          return;
        }
      }

      const firstTab = tabs[0];
      const showWelcome = useUiStore.getState().showWelcome;
      const shouldReplaceFirstTab =
        showWelcome && tabs.length === 1 && !firstTab.filePath && !firstTab.isDirty;

      if (shouldReplaceFirstTab) {
        useTabStore.getState().replaceFirstTab(result.path, result.name, result.content);
        useEditorStore.getState().updateSource(result.content);
      } else {
        useTabStore.getState().createTab(result.path, result.content, result.name);
      }

      useUiStore.getState().setShowWelcome(false);
      if (result.path) addToRecentFiles(result.path);

      setTimeout(() => {
        useEditorStore.getState().manualRender();
      }, 100);
    } catch (err) {
      console.error('Failed to open file:', err);
      toast.error(`Failed to open file: ${err}`);
    }
  }, []);

  const handleOpenRecent = useCallback(async (path: string) => {
    try {
      const { tabs } = useTabStore.getState();
      const existingTab = tabs.find((t) => t.filePath === path);
      if (existingTab) {
        useTabStore.getState().switchTab(existingTab.id);
        useUiStore.getState().setShowWelcome(false);
        return;
      }

      const platform = getPlatform();
      if (!platform.capabilities.hasFileSystem) {
        toast.error('Cannot open recent files in web mode');
        return;
      }

      const result = await platform.fileRead(path);
      if (!result) return;

      const showWelcome = useUiStore.getState().showWelcome;
      const firstTab = tabs[0];
      const shouldReplaceFirstTab =
        showWelcome && tabs.length === 1 && !firstTab.filePath && !firstTab.isDirty;

      if (shouldReplaceFirstTab) {
        useTabStore.getState().replaceFirstTab(result.path, result.name, result.content);
        useEditorStore.getState().updateSource(result.content);
      } else {
        useTabStore.getState().createTab(result.path, result.content, result.name);
      }

      useUiStore.getState().setShowWelcome(false);
      if (result.path) addToRecentFiles(result.path);

      setTimeout(() => {
        useEditorStore.getState().manualRender();
      }, 100);
    } catch (err) {
      console.error('Failed to open recent file:', err);
      toast.error(`Failed to open file: ${err}`);
    }
  }, []);

  const handleStartWithPrompt = useCallback((prompt: string, submitPrompt: (p: string) => void) => {
    useUiStore.getState().setShowWelcome(false);
    setTimeout(() => {
      submitPrompt(prompt);
    }, 100);
  }, []);

  const handleStartManually = useCallback(() => {
    useUiStore.getState().setShowWelcome(false);
  }, []);

  const checkUnsavedChanges = useCallback(async (): Promise<boolean> => {
    const activeTab = useTabStore.getState().getActiveTab();
    if (!activeTab.isDirty) return true;

    const platform = getPlatform();

    const wantsToSave = await platform.ask('Do you want to save the changes you made?', {
      title: 'Unsaved Changes',
      kind: 'warning',
      okLabel: 'Save',
      cancelLabel: "Don't Save",
    });

    if (wantsToSave) {
      return await saveFile(false);
    } else {
      const confirmDiscard = await platform.confirm(
        'Are you sure you want to discard your changes?',
        {
          title: 'Discard Changes',
          kind: 'warning',
          okLabel: 'Discard',
          cancelLabel: 'Cancel',
        }
      );
      return confirmDiscard;
    }
  }, [saveFile]);

  return {
    saveFile,
    handleOpenFile,
    handleOpenRecent,
    handleStartWithPrompt,
    handleStartManually,
    checkUnsavedChanges,
  };
}
