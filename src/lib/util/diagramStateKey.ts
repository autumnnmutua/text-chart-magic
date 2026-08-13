import type { State } from '$lib/types';

/**
 * Fingerprint for state that changes the exported SVG. Workspace-only fields
 * such as the sample description, grid, and snap preference are excluded.
 */
export const diagramRenderKey = (state: State): string =>
  JSON.stringify({
    code: state.code,
    mermaid: state.mermaid,
    rough: state.rough,
    visualConnections: state.visualConnections ?? {},
    visualElements: state.visualElements ?? {},
    visualLayers: state.visualLayers ?? {},
    visualPositions: state.visualPositions ?? {},
    visualStyles: state.visualStyles ?? {}
  });

/**
 * Stable fingerprint for fields that change the diagram itself. Viewport and
 * transient render fields are deliberately excluded.
 */
export const diagramStateKey = (state: State): string =>
  JSON.stringify({
    code: state.code,
    grid: state.grid ?? true,
    mermaid: state.mermaid,
    rough: state.rough,
    sampleDescription: state.sampleDescription ?? '',
    snapToGrid: state.snapToGrid ?? true,
    visualConnections: state.visualConnections ?? {},
    visualElements: state.visualElements ?? {},
    visualLayers: state.visualLayers ?? {},
    visualPositions: state.visualPositions ?? {},
    visualStyles: state.visualStyles ?? {}
  });
