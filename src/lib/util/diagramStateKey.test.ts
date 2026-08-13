import { describe, expect, it } from 'vitest';
import type { State } from '$lib/types';
import { diagramRenderKey, diagramStateKey } from './diagramStateKey';

const state: State = {
  code: 'flowchart LR\n  A --> B',
  grid: true,
  mermaid: '{}',
  rough: false,
  sampleDescription: 'Initial description',
  snapToGrid: true,
  updateDiagram: true
};

describe('diagram state fingerprints', () => {
  it('keeps workspace-only metadata out of the SVG render fingerprint', () => {
    const changedDescription = { ...state, sampleDescription: 'Updated description' };

    expect(diagramRenderKey(changedDescription)).toBe(diagramRenderKey(state));
    expect(diagramStateKey(changedDescription)).not.toBe(diagramStateKey(state));
  });

  it('changes the render fingerprint when diagram content changes', () => {
    expect(diagramRenderKey({ ...state, code: 'flowchart LR\n  A --> C' })).not.toBe(
      diagramRenderKey(state)
    );
  });
});
