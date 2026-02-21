import { useEffect } from 'react';
import { useTabStore } from '../stores/tabStore';
import { useEditorStore } from '../stores/editorStore';
import { useUiStore } from '../stores/uiStore';
import { getPlatform, eventBus, type ExportFormat } from '../platform';
import { RenderService } from '../services/renderService';
import { addToRecentFiles } from '../components/WelcomeScreen';
import { toast } from 'sonner';

interface UseMenuListenersOptions {
  checkUnsavedChanges: () => Promise<boolean>;
  saveFile: (promptForPath?: boolean) => Promise<boolean>;
}

export function useMenuListeners(options: UseMenuListenersOptions): void {
  const { checkUnsavedChanges, saveFile } = options;

  useEffect(() => {
    const unlistenFns: Array<() => void> = [];

    unlistenFns.push(
      eventBus.on('menu:file:new', async () => {
        const canProceed = await checkUnsavedChanges();
        if (!canProceed) return;
        useTabStore.getState().createTab();
        useUiStore.getState().setShowWelcome(true);
      })
    );

    unlistenFns.push(
      eventBus.on('menu:file:open', async () => {
        try {
          const result = await getPlatform().fileOpen([
            { name: 'OpenSCAD Files', extensions: ['scad'] },
          ]);
          if (!result) return;

          if (result.path) {
            const existingTab = useTabStore.getState().tabs.find((t) => t.filePath === result.path);
            if (existingTab) {
              useTabStore.getState().switchTab(existingTab.id);
              useUiStore.getState().setShowWelcome(false);
              return;
            }
          }

          useTabStore.getState().createTab(result.path, result.content, result.name);
          useUiStore.getState().setShowWelcome(false);
          if (result.path) addToRecentFiles(result.path);

          setTimeout(() => {
            useEditorStore.getState().manualRender();
          }, 100);
        } catch (err) {
          console.error('Open failed:', err);
          toast.error(`Failed to open file: ${err}`);
        }
      })
    );

    unlistenFns.push(
      eventBus.on('menu:file:save', async () => {
        await saveFile(false);
      })
    );

    unlistenFns.push(
      eventBus.on('menu:file:save_as', async () => {
        await saveFile(true);
      })
    );

    unlistenFns.push(
      eventBus.on('menu:file:export', async (format: ExportFormat) => {
        try {
          const formatLabels: Record<ExportFormat, { label: string; ext: string }> = {
            stl: { label: 'STL (3D Model)', ext: 'stl' },
            obj: { label: 'OBJ (3D Model)', ext: 'obj' },
            amf: { label: 'AMF (3D Model)', ext: 'amf' },
            '3mf': { label: '3MF (3D Model)', ext: '3mf' },
            png: { label: 'PNG (Image)', ext: 'png' },
            svg: { label: 'SVG (2D Vector)', ext: 'svg' },
            dxf: { label: 'DXF (2D CAD)', ext: 'dxf' },
          };
          const formatInfo = formatLabels[format];
          const source = useEditorStore.getState().source;
          const exportBytes = await RenderService.getInstance().exportModel(
            source,
            format as 'stl' | 'obj' | 'amf' | '3mf' | 'svg' | 'dxf'
          );
          await getPlatform().fileExport(exportBytes, `export.${formatInfo.ext}`, [
            { name: formatInfo.label, extensions: [formatInfo.ext] },
          ]);
          toast.success('Exported successfully');
        } catch (err) {
          console.error('Export failed:', err);
          toast.error(`Export failed: ${err}`);
        }
      })
    );

    unlistenFns.push(
      eventBus.on('render-requested', () => {
        useEditorStore.getState().manualRender();
      })
    );

    unlistenFns.push(
      eventBus.on('history:restore', ({ code }) => {
        useEditorStore.getState().updateSourceAndRender(code);
        const { activeTabId } = useTabStore.getState();
        useTabStore.getState().updateTabContent(activeTabId, code);
      })
    );

    unlistenFns.push(
      eventBus.on('code-updated', ({ code }) => {
        useEditorStore.getState().updateSourceAndRender(code);
        const { activeTabId } = useTabStore.getState();
        useTabStore.getState().updateTabContent(activeTabId, code);
      })
    );

    return () => {
      unlistenFns.forEach((fn) => fn());
    };
  }, [checkUnsavedChanges, saveFile]);

  useEffect(() => {
    const platform = getPlatform();
    const unlisten = platform.onCloseRequested(async () => {
      const anyDirty = useTabStore.getState().isAnyDirty();
      if (!anyDirty) return true;
      return await checkUnsavedChanges();
    });
    return () => {
      unlisten();
    };
  }, [checkUnsavedChanges]);

  const activeTab = useTabStore((s) => s.getActiveTab());

  useEffect(() => {
    const fileName = activeTab.name;
    const dirtyIndicator = activeTab.isDirty ? '\u2022 ' : '';
    getPlatform().setWindowTitle(`${dirtyIndicator}${fileName} - OpenSCAD Studio`);
  }, [activeTab]);

  const tabs = useTabStore((s) => s.tabs);

  useEffect(() => {
    const platform = getPlatform();
    if ('setDirtyState' in platform) {
      (platform as { setDirtyState: (d: boolean) => void }).setDirtyState(
        tabs.some((t) => t.isDirty)
      );
    }
  }, [tabs]);
}
