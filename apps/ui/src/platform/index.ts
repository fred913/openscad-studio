export type {
  PlatformBridge,
  PlatformCapabilities,
  FileOpenResult,
  FileFilter,
  ConfirmDialogOptions,
  ExportFormat,
} from './types';
export { eventBus } from './eventBus';
export type { EventMap } from './eventBus';
export { historyService } from './historyService';
export type { EditorCheckpoint, CheckpointDiff, Diagnostic, ChangeType } from './historyService';

import type { PlatformBridge } from './types';

let _bridge: PlatformBridge | null = null;

function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

export async function initializePlatform(): Promise<PlatformBridge> {
  if (_bridge) return _bridge;

  if (isTauri()) {
    const { TauriBridge } = await import('./tauriBridge');
    _bridge = new TauriBridge();
  } else {
    const { WebBridge } = await import('./webBridge');
    _bridge = new WebBridge();
  }

  if (_bridge.initialize) {
    await _bridge.initialize();
  }

  return _bridge;
}

export function getPlatform(): PlatformBridge {
  if (!_bridge) {
    throw new Error('Platform not initialized. Call initializePlatform() first.');
  }
  return _bridge;
}
