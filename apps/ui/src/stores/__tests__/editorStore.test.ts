/**
 * @jest-environment node
 */
import { createStore } from 'zustand/vanilla';
import { createEditorStore } from '../editorStore';

describe('editorStore', () => {
  const createTestStore = () => createStore(createEditorStore);

  it('setSource updates source', () => {
    const store = createTestStore();
    store.getState().setSource('cube(1);');
    expect(store.getState().source).toBe('cube(1);');
  });

  it('syncFromOpenScad updates all fields atomically', () => {
    const store = createTestStore();
    const output = {
      source: 'sphere(2);',
      previewSrc: 'blob://preview',
      previewKind: 'svg' as const,
      diagnostics: [{ severity: 'warning' as const, message: 'warn', line: 1 }],
      isRendering: true,
      error: 'oops',
      ready: true,
      dimensionMode: '2d' as const,
      auxiliaryFiles: { 'lib.scad': 'module test() {}' },
    };

    store.getState().syncFromOpenScad(output);

    const state = store.getState();
    expect(state.source).toBe(output.source);
    expect(state.previewSrc).toBe(output.previewSrc);
    expect(state.previewKind).toBe(output.previewKind);
    expect(state.diagnostics).toEqual(output.diagnostics);
    expect(state.isRendering).toBe(output.isRendering);
    expect(state.error).toBe(output.error);
    expect(state.ready).toBe(output.ready);
    expect(state.dimensionMode).toBe(output.dimensionMode);
    expect(state.auxiliaryFiles).toEqual(output.auxiliaryFiles);
  });

  it('setRenderCallbacks stores references', () => {
    const store = createTestStore();
    const callbacks = {
      manualRender: jest.fn(),
      renderOnSave: jest.fn(),
      updateSource: jest.fn(),
      updateSourceAndRender: jest.fn(),
    };

    store.getState().setRenderCallbacks(callbacks);

    const state = store.getState();
    expect(state._manualRender).toBe(callbacks.manualRender);
    expect(state._renderOnSave).toBe(callbacks.renderOnSave);
    expect(state._updateSource).toBe(callbacks.updateSource);
    expect(state._updateSourceAndRender).toBe(callbacks.updateSourceAndRender);
  });

  it('manualRender calls callback', () => {
    const store = createTestStore();
    const manualRender = jest.fn();
    store.getState().setRenderCallbacks({
      manualRender,
      renderOnSave: null,
      updateSource: null,
      updateSourceAndRender: null,
    });

    store.getState().manualRender();

    expect(manualRender).toHaveBeenCalledTimes(1);
  });

  it('manualRender no-ops when callback is null', () => {
    const store = createTestStore();
    expect(() => store.getState().manualRender()).not.toThrow();
  });

  it('renderOnSave calls callback', () => {
    const store = createTestStore();
    const renderOnSave = jest.fn();
    store.getState().setRenderCallbacks({
      manualRender: null,
      renderOnSave,
      updateSource: null,
      updateSourceAndRender: null,
    });

    store.getState().renderOnSave();

    expect(renderOnSave).toHaveBeenCalledTimes(1);
  });

  it('updateSource delegates to callback', () => {
    const store = createTestStore();
    const updateSource = jest.fn();
    store.getState().setRenderCallbacks({
      manualRender: null,
      renderOnSave: null,
      updateSource,
      updateSourceAndRender: null,
    });

    store.getState().updateSource('cube(2);');

    expect(updateSource).toHaveBeenCalledWith('cube(2);');
  });

  it('updateSourceAndRender delegates to callback', () => {
    const store = createTestStore();
    const updateSourceAndRender = jest.fn();
    store.getState().setRenderCallbacks({
      manualRender: null,
      renderOnSave: null,
      updateSource: null,
      updateSourceAndRender,
    });

    store.getState().updateSourceAndRender('sphere(3);');

    expect(updateSourceAndRender).toHaveBeenCalledWith('sphere(3);');
  });
});
