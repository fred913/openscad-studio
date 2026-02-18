import type {
  PlatformBridge,
  PlatformCapabilities,
  FileOpenResult,
  FileFilter,
  ConfirmDialogOptions,
} from './types';
import { eventBus } from './eventBus';

const capabilities: PlatformCapabilities = {
  multiFile: true,
  hasNativeMenu: true,
  hasFileSystem: true,
  canSetWindowTitle: true,
};

export class TauriBridge implements PlatformBridge {
  readonly capabilities = capabilities;

  async fileOpen(filters?: FileFilter[]): Promise<FileOpenResult | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');

    const selected = await open({
      filters,
      multiple: false,
    });

    if (!selected) return null;

    const filePath = typeof selected === 'string' ? selected : (selected as { path: string }).path;
    const content = await readTextFile(filePath);
    const name = filePath.split('/').pop() || filePath;

    return { path: filePath, name, content };
  }

  async fileRead(path: string): Promise<FileOpenResult | null> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const content = await readTextFile(path);
    const name = path.split('/').pop() || path;
    return { path, name, content };
  }

  async fileSave(
    content: string,
    path?: string | null,
    filters?: FileFilter[]
  ): Promise<string | null> {
    if (path) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(path, content);
      return path;
    }

    return this.fileSaveAs(content, filters);
  }

  async fileSaveAs(content: string, filters?: FileFilter[]): Promise<string | null> {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const savePath = await save({ filters });
    if (!savePath) return null;

    await writeTextFile(savePath, content);
    return savePath;
  }

  async fileExport(
    data: Uint8Array,
    _defaultFilename: string,
    filters?: FileFilter[]
  ): Promise<void> {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');

    const savePath = await save({ filters });
    if (!savePath) return;

    await writeFile(savePath, data);
  }

  async confirm(message: string, options?: ConfirmDialogOptions): Promise<boolean> {
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    return confirm(message, {
      title: options?.title,
      kind: options?.kind,
      okLabel: options?.okLabel,
      cancelLabel: options?.cancelLabel,
    });
  }

  async ask(message: string, options?: ConfirmDialogOptions): Promise<boolean> {
    const { ask } = await import('@tauri-apps/plugin-dialog');
    return ask(message, {
      title: options?.title,
      kind: options?.kind,
      okLabel: options?.okLabel,
      cancelLabel: options?.cancelLabel,
    });
  }

  setWindowTitle(title: string): void {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().setTitle(title);
    });
  }

  onCloseRequested(handler: () => Promise<boolean>): () => void {
    let unlisten: (() => void) | null = null;

    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow();
      appWindow
        .onCloseRequested(async (event) => {
          const allowClose = await handler();
          if (!allowClose) {
            event.preventDefault();
          }
        })
        .then((fn) => {
          unlisten = fn;
        });
    });

    return () => {
      if (unlisten) unlisten();
    };
  }

  async initialize(): Promise<void> {
    const { listen } = await import('@tauri-apps/api/event');

    await listen('menu:file:new', () => eventBus.emit('menu:file:new'));
    await listen('menu:file:open', () => eventBus.emit('menu:file:open'));
    await listen('menu:file:save', () => eventBus.emit('menu:file:save'));
    await listen('menu:file:save_as', () => eventBus.emit('menu:file:save_as'));
    await listen<string>('menu:file:export', (event) => {
      eventBus.emit('menu:file:export', event.payload as import('./types').ExportFormat);
    });
  }
}
