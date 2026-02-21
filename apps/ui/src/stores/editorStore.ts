import { create } from 'zustand';
import type { StateCreator } from 'zustand';

export type RenderKind = 'mesh' | 'svg';

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
}

export interface RenderCallbacks {
  manualRender: (() => void) | null;
  renderOnSave: (() => void) | null;
  updateSource: ((code: string) => void) | null;
  updateSourceAndRender: ((code: string) => void) | null;
}

export interface EditorState {
  source: string;
  previewSrc: string;
  previewKind: RenderKind;
  diagnostics: Diagnostic[];
  isRendering: boolean;
  error: string | undefined;
  ready: boolean;
  dimensionMode: '2d' | '3d';
  auxiliaryFiles: Record<string, string>;

  _manualRender: (() => void) | null;
  _renderOnSave: (() => void) | null;
  _updateSource: ((code: string) => void) | null;
  _updateSourceAndRender: ((code: string) => void) | null;

  setSource: (code: string) => void;
  syncFromOpenScad: (output: {
    source: string;
    previewSrc: string;
    previewKind: RenderKind;
    diagnostics: Diagnostic[];
    isRendering: boolean;
    error: string | undefined;
    ready: boolean;
    dimensionMode: '2d' | '3d';
    auxiliaryFiles: Record<string, string>;
  }) => void;
  setRenderCallbacks: (cbs: RenderCallbacks) => void;
  manualRender: () => void;
  renderOnSave: () => void;
  updateSource: (code: string) => void;
  updateSourceAndRender: (code: string) => void;
}

export const createEditorStore: StateCreator<EditorState> = (set, get) => ({
  source: '',
  previewSrc: '',
  previewKind: 'mesh',
  diagnostics: [],
  isRendering: false,
  error: undefined,
  ready: false,
  dimensionMode: '3d',
  auxiliaryFiles: {},

  _manualRender: null,
  _renderOnSave: null,
  _updateSource: null,
  _updateSourceAndRender: null,

  setSource: (code) => set({ source: code }),
  syncFromOpenScad: (output) =>
    set({
      source: output.source,
      previewSrc: output.previewSrc,
      previewKind: output.previewKind,
      diagnostics: output.diagnostics,
      isRendering: output.isRendering,
      error: output.error,
      ready: output.ready,
      dimensionMode: output.dimensionMode,
      auxiliaryFiles: output.auxiliaryFiles,
    }),
  setRenderCallbacks: (cbs) =>
    set({
      _manualRender: cbs.manualRender,
      _renderOnSave: cbs.renderOnSave,
      _updateSource: cbs.updateSource,
      _updateSourceAndRender: cbs.updateSourceAndRender,
    }),
  manualRender: () => {
    get()._manualRender?.();
  },
  renderOnSave: () => {
    get()._renderOnSave?.();
  },
  updateSource: (code) => {
    get()._updateSource?.(code);
  },
  updateSourceAndRender: (code) => {
    get()._updateSourceAndRender?.(code);
  },
});

export const useEditorStore = create<EditorState>(createEditorStore);
