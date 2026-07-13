import type { State } from '$lib/types';

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
    snapToGrid: state.snapToGrid ?? true,
    visualConnections: state.visualConnections ?? {},
    visualLayers: state.visualLayers ?? {},
    visualPositions: state.visualPositions ?? {},
    visualStyles: state.visualStyles ?? {}
  });
