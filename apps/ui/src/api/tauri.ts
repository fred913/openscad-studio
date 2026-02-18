import { invoke } from '@tauri-apps/api/core';

export interface Diagnostic {
  severity: 'error' | 'warning' | 'info';
  line?: number;
  col?: number;
  message: string;
}

export type RenderKind = 'png' | 'svg' | 'mesh';
export type ExportFormat = 'stl' | 'obj' | 'amf' | '3mf' | 'png' | 'svg' | 'dxf';

export async function updateEditorState(code: string): Promise<void> {
  return await invoke('update_editor_state', { code });
}

export async function updateWorkingDir(workingDir: string | null): Promise<void> {
  return await invoke('update_working_dir', { workingDir });
}
