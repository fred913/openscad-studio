import type {
  PlatformBridge,
  PlatformCapabilities,
  FileOpenResult,
  FileFilter,
  ConfirmDialogOptions,
} from './types';

const capabilities: PlatformCapabilities = {
  multiFile: false,
  hasNativeMenu: false,
  hasFileSystem: true,
  canSetWindowTitle: true,
};

function filtersToAccept(filters?: FileFilter[]): string {
  if (!filters?.length) return '';
  return filters.flatMap((f) => f.extensions.map((ext) => `.${ext}`)).join(',');
}

function hasFileSystemAccess(): boolean {
  return 'showOpenFilePicker' in window;
}

export class WebBridge implements PlatformBridge {
  readonly capabilities = capabilities;

  async fileRead(_path: string): Promise<FileOpenResult | null> {
    return null;
  }

  async fileOpen(filters?: FileFilter[]): Promise<FileOpenResult | null> {
    if (hasFileSystemAccess()) {
      return this.fileOpenNative(filters);
    }
    return this.fileOpenFallback(filters);
  }

  private async fileOpenNative(filters?: FileFilter[]): Promise<FileOpenResult | null> {
    try {
      const types: FilePickerAcceptType[] = filters?.length
        ? filters.map((f) => ({
            description: f.name,
            accept: { 'text/plain': f.extensions.map((ext) => `.${ext}` as `.${string}`) },
          }))
        : [];

      const [handle] = await window.showOpenFilePicker({
        types: types.length ? types : undefined,
        multiple: false,
      });

      const file = await handle.getFile();
      const content = await file.text();
      return { path: null, name: file.name, content };
    } catch {
      return null;
    }
  }

  private async fileOpenFallback(filters?: FileFilter[]): Promise<FileOpenResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = filtersToAccept(filters);

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const content = await file.text();
        resolve({ path: null, name: file.name, content });
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  async fileSave(
    content: string,
    _path?: string | null,
    filters?: FileFilter[]
  ): Promise<string | null> {
    return this.fileSaveAs(content, filters);
  }

  async fileSaveAs(content: string, filters?: FileFilter[]): Promise<string | null> {
    if (hasFileSystemAccess()) {
      return this.fileSaveNative(content, filters);
    }
    this.downloadFile(content, 'untitled.scad', 'text/plain');
    return 'untitled.scad';
  }

  private async fileSaveNative(content: string, filters?: FileFilter[]): Promise<string | null> {
    try {
      const types: FilePickerAcceptType[] = filters?.length
        ? filters.map((f) => ({
            description: f.name,
            accept: { 'text/plain': f.extensions.map((ext) => `.${ext}` as `.${string}`) },
          }))
        : [];

      const handle = await window.showSaveFilePicker({
        types: types.length ? types : undefined,
        suggestedName: 'untitled.scad',
      });

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return handle.name;
    } catch {
      return null;
    }
  }

  async fileExport(
    data: Uint8Array,
    defaultFilename: string,
    filters?: FileFilter[]
  ): Promise<void> {
    if (hasFileSystemAccess()) {
      try {
        const types: FilePickerAcceptType[] = filters?.length
          ? filters.map((f) => ({
              description: f.name,
              accept: {
                'application/octet-stream': f.extensions.map((ext) => `.${ext}` as `.${string}`),
              },
            }))
          : [];

        const handle = await window.showSaveFilePicker({
          types: types.length ? types : undefined,
          suggestedName: defaultFilename,
        });

        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
        return;
      } catch {
        /* use download fallback */
      }
    }

    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async confirm(message: string, _options?: ConfirmDialogOptions): Promise<boolean> {
    return window.confirm(message);
  }

  async ask(message: string, _options?: ConfirmDialogOptions): Promise<boolean> {
    return window.confirm(message);
  }

  setWindowTitle(title: string): void {
    document.title = title;
  }

  onCloseRequested(handler: () => Promise<boolean>): () => void {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', beforeUnload);
    (window as Record<string, unknown>).__closeHandler = handler;

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      delete (window as Record<string, unknown>).__closeHandler;
    };
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
