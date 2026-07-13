import type { State } from '$lib/types';
import { diagramData } from '@mermaid-js/examples';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { parse } from './mermaid';
import { serializeState } from './serde';
import {
  createDiagramBranchCode,
  defaultState,
  inputState,
  loadState,
  normalizeState,
  replaceAllDiagramText,
  replaceInputState,
  loadDiagramCode,
  redoLastEdit,
  resetToDefaultGraph,
  toggleDarkTheme,
  updateCode,
  updateCodeStore,
  updateVisualLayer,
  updateVisualPositions,
  updateVisualPositionsBatch,
  updateVisualStyle,
  updateVisualStyles,
  updateConfig,
  undoLastEdit,
  validatedState,
  verifyState
} from './state.svelte';
import { searchEditableSourceText } from './searchModel';

describe('saved state compatibility', () => {
  it('fills fields missing from legacy saved data without replacing its diagram', () => {
    const normalized = normalizeState({ code: 'flowchart LR\n  Legacy[旧作品]' });

    expect(normalized.code).toContain('Legacy[旧作品]');
    expect(normalized.mermaid).toBe(defaultState.mermaid);
    expect(normalized.grid).toBe(defaultState.grid);
    expect(normalized.panZoom).toBe(defaultState.panZoom);
    expect(normalized.rough).toBe(defaultState.rough);
    expect(normalized.updateDiagram).toBe(defaultState.updateDiagram);
    expect(normalized.editorMode).toBe('code');
    expect(normalized.snapToGrid).toBe(true);
    expect(normalized.visualLayers).toBeUndefined();
  });

  it('drops invalid view coordinates while retaining valid optional data', () => {
    const normalized = normalizeState({
      code: 'flowchart LR\n  A --> B',
      mermaid: '{}',
      pan: { x: Number.NaN, y: 10 },
      rough: false,
      updateDiagram: true,
      visualPositions: { A: { x: 20, y: 30 } },
      zoom: Number.POSITIVE_INFINITY
    });

    expect(normalized.pan).toBeUndefined();
    expect(normalized.zoom).toBeUndefined();
    expect(normalized.visualPositions?.A).toEqual({ x: 20, y: 30 });
  });

  it('sanitizes malformed legacy visual styles and positions', () => {
    const normalized = normalizeState({
      ...defaultState,
      visualPositions: {
        broken: { x: Number.NaN, y: 'wrong' },
        valid: { x: 12, y: 18 }
      },
      visualStyles: {
        broken: 'orange',
        valid: { alpha: 4, fill: '#f97316', ignored: true }
      }
    });

    expect(normalized.visualPositions).toEqual({ valid: { x: 12, y: 18 } });
    expect(normalized.visualStyles).toEqual({ valid: { alpha: 1, fill: '#f97316' } });
  });

  it('does not leak optional fields from the current diagram into a legacy link', () => {
    updateCodeStore({
      pan: { x: 80, y: 40 },
      visualPositions: { A: { x: 20, y: 30 } },
      visualStyles: { A: { fill: '#ffffff' } },
      zoom: 2
    });
    const legacy = serializeState({
      code: 'flowchart LR\n  Legacy[旧链接]',
      mermaid: '{}',
      rough: false,
      updateDiagram: true
    } as State);

    loadState(legacy);

    expect(inputState.code).toContain('Legacy[旧链接]');
    expect(inputState.pan).toBeUndefined();
    expect(inputState.zoom).toBeUndefined();
    expect(inputState.visualPositions).toBeUndefined();
    expect(inputState.visualStyles).toBeUndefined();
    expect(inputState.grid).toBe(defaultState.grid);
  });
});

// Runs `body` inside an effect and reports how often the effect (re-)runs.
const countEffectRuns = (body: () => void): { runs: () => number; stop: () => void } => {
  let runs = 0;
  const stop = $effect.root(() => {
    $effect(() => {
      runs++;
      body();
    });
  });
  flushSync();
  return { runs: () => runs, stop };
};

const readStoredState = (): State =>
  JSON.parse(window.localStorage.getItem('codeStore') ?? '{}') as State;

describe('update functions called from effects', () => {
  // Effects that call an update function must not subscribe to the input
  // state the function reads, or unrelated state changes re-fire the effect
  // (and self-reads loop, e.g. the dark-theme effect in +layout.svelte).
  const cases: [string, () => void][] = [
    ['updateCodeStore', () => updateCodeStore({})],
    ['updateCode', () => updateCode('graph TD\n inside-effect')],
    ['updateConfig', () => updateConfig('{"theme":"default"}')],
    ['toggleDarkTheme', () => toggleDarkTheme(false)],
    ['replaceInputState', () => replaceInputState({ ...defaultState })],
    ['verifyState', () => verifyState()],
    ['loadState', () => loadState('')]
  ];

  it.each(cases)('%s does not make the calling effect track input state', (_name, call) => {
    const counter = countEffectRuns(call);
    try {
      expect(counter.runs()).toBe(1);
      updateCode('graph TD\n external-change');
      updateConfig('{"theme":"forest"}');
      updateCodeStore({ pan: { x: 1, y: 2 } });
      flushSync();
      expect(counter.runs()).toBe(1);
    } finally {
      counter.stop();
    }
  });
});

describe('update functions persist input state', () => {
  it('stores block positions as one undoable and redoable interaction', () => {
    loadDiagramCode('block-beta\n  A["A"]');
    updateVisualPositions({ A: { x: 120, y: 80 } });
    expect(readStoredState().visualPositions?.A).toEqual({ x: 120, y: 80 });
    expect(undoLastEdit()).toBe(true);
    expect(readStoredState().visualPositions).toBeUndefined();
    expect(redoLastEdit()).toBe(true);
    expect(readStoredState().visualPositions?.A).toEqual({ x: 120, y: 80 });
  });

  it('stores a batch move as one undoable transaction', () => {
    loadDiagramCode('block-beta\n  A["A"]\n  B["B"]');
    expect(
      updateVisualPositionsBatch({
        A: { x: 80, y: 30 },
        B: { x: 160, y: 30 }
      })
    ).toBe(true);
    expect(inputState.visualPositions).toEqual({
      A: { x: 80, y: 30 },
      B: { x: 160, y: 30 }
    });

    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualPositions).toBeUndefined();
    expect(redoLastEdit()).toBe(true);
    expect(inputState.visualPositions?.B).toEqual({ x: 160, y: 30 });
  });

  it('stores batch style and lock changes without splitting each operation per element', () => {
    loadDiagramCode('block-beta\n  A["A"]\n  B["B"]');
    expect(updateVisualStyles(['A', 'B'], { fill: '#fb923c', stroke: '#c2410c' })).toBe(true);
    expect(inputState.visualStyles?.A.fill).toBe('#fb923c');
    expect(inputState.visualStyles?.B.stroke).toBe('#c2410c');
    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualStyles).toBeUndefined();

    expect(updateVisualLayer(['A', 'B'], { locked: true })).toBe(true);
    expect(inputState.visualLayers?.A.locked).toBe(true);
    expect(inputState.visualLayers?.B.locked).toBe(true);
    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualLayers).toBeUndefined();
  });

  it('keeps batch movement and batch color as separate undo transactions', () => {
    loadDiagramCode('block-beta\n  A["A"]\n  B["B"]');
    updateVisualPositionsBatch({
      A: { x: 60, y: 20 },
      B: { x: 120, y: 20 }
    });
    updateVisualStyles(['A', 'B'], { fill: '#f97316', stroke: '#c2410c' });

    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualStyles).toBeUndefined();
    expect(inputState.visualPositions?.A).toEqual({ x: 60, y: 20 });
    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualPositions).toBeUndefined();
  });

  it('replaces every search match as one undoable operation', () => {
    const code = 'flowchart LR\n  A[旧名称] -->|旧关系| B[旧名称]';
    loadDiagramCode(code);
    const matches = searchEditableSourceText(code, '旧', {
      caseSensitive: false,
      wholeWord: false
    });
    expect(
      replaceAllDiagramText(
        matches.map(({ range, text }) => ({ currentText: text, nextText: '新', range }))
      )
    ).toBe(3);
    expect(inputState.code).toContain('A[新名称]');
    expect(inputState.code).toContain('|新关系|');
    expect(undoLastEdit()).toBe(true);
    expect(inputState.code).toBe(code);
  });

  it('normalizes reactive position objects before persistence', () => {
    loadDiagramCode('C4Context\n  System(app, "应用")');
    const positions = $state({ app: { x: 48, y: 32 } });
    expect(() => updateVisualPositions(positions)).not.toThrow();
    expect(readStoredState().visualPositions?.app).toEqual({ x: 48, y: 32 });
  });

  it('updateCode writes the new code to localStorage', () => {
    updateCode('graph TD\n persisted-by-test');
    expect(readStoredState().code).toBe('graph TD\n persisted-by-test');
  });

  it('keeps the viewport for same-type edits and resets it when the diagram type changes', () => {
    loadDiagramCode('flowchart LR\n  A --> B');
    updateCodeStore({ pan: { x: 80, y: 40 }, zoom: 1.5 });

    updateCode('flowchart TD\n  A --> B');
    expect(inputState.pan).toEqual({ x: 80, y: 40 });
    expect(inputState.zoom).toBe(1.5);

    updateCode('treemap-beta\n"产品"\n  "需求": 12');
    expect(inputState.pan).toBeUndefined();
    expect(inputState.zoom).toBeUndefined();
  });

  it('updateCodeStore merges partial state and persists it', () => {
    updateCodeStore({ rough: true });
    expect(inputState.rough).toBe(true);
    expect(readStoredState().rough).toBe(true);
  });

  it('replaceInputState drops keys absent from the next state and persists', () => {
    updateCodeStore({ pan: { x: 1, y: 2 } });
    expect(inputState.pan).toEqual({ x: 1, y: 2 });
    replaceInputState({ ...defaultState });
    expect(inputState.pan).toBeUndefined();
    expect(readStoredState().pan).toBeUndefined();
    expect(readStoredState().code).toBe(defaultState.code);
  });

  it('can undo a history restore that changes only visual state', () => {
    const code = 'flowchart LR\n  A[同一源码]';
    replaceInputState({ ...defaultState, code, visualStyles: { A: { fill: '#fed7aa' } } });
    replaceInputState({
      ...defaultState,
      code,
      visualPositions: { A: { x: 80, y: 40 } },
      visualStyles: { A: { fill: '#f97316' } }
    });
    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualStyles?.A.fill).toBe('#fed7aa');
    expect(inputState.visualPositions).toBeUndefined();
  });

  it('verifyState forces panZoom back on', () => {
    updateCodeStore({ panZoom: false });
    verifyState();
    expect(inputState.panZoom).toBe(true);
    expect(readStoredState().panZoom).toBe(true);
  });

  it('does not rewrite a custom Mermaid theme when the page theme changes', () => {
    const mermaid = '{"theme":"forest","themeVariables":{"primaryColor":"#123456"}}';
    replaceInputState({ ...defaultState, mermaid });
    toggleDarkTheme(true);
    expect(inputState.mermaid).toBe(mermaid);
  });

  it('reset restores the complete loaded baseline, including style and position', async () => {
    const code = 'flowchart LR\n  A[初始节点] --> B[目标节点]';
    replaceInputState({
      ...defaultState,
      code,
      visualPositions: { A: { x: 25, y: 40 } },
      visualStyles: { A: { fill: '#fed7aa', stroke: '#ea580c' } }
    });
    await vi.waitUntil(
      () => validatedState.current.code === code && validatedState.current.error === undefined
    );

    updateCode('flowchart LR\n  A[已修改] --> B[目标节点]');
    updateVisualPositions({ A: { x: 140, y: 160 } });
    updateVisualStyle('A', { fill: '#ffffff', stroke: '#111111' });
    resetToDefaultGraph();

    expect(inputState.code).toBe(code);
    expect(inputState.visualPositions?.A).toEqual({ x: 25, y: 40 });
    expect(inputState.visualStyles?.A).toEqual({ fill: '#fed7aa', stroke: '#ea580c' });
  });

  it('keeps the persisted reset baseline when the page initializes without a URL hash', async () => {
    const code = 'block-beta\n  A["初始模块"]';
    loadDiagramCode(code);
    await vi.waitUntil(
      () => validatedState.current.code === code && validatedState.current.error === undefined
    );

    const storedInitial = JSON.parse(
      window.localStorage.getItem('diagramInitialStore') ?? '{}'
    ) as { state?: State };
    expect(storedInitial.state?.code).toBe(code);
    expect(storedInitial.state?.visualPositions).toBeUndefined();

    updateVisualPositions({ A: { x: 180, y: 90 } });
    loadState('');
    resetToDefaultGraph();

    expect(inputState.code).toBe(code);
    expect(inputState.visualPositions).toBeUndefined();
  });
});

describe('diagram branch generation', () => {
  it('allocates a new packet bit range for every added field', async () => {
    let code = `packet
0-15: "字段A"`;

    code = createDiagramBranchCode({ code, label: '字段A' }) as string;
    expect(code).toContain('16-31: "新分支"');

    code = createDiagramBranchCode({ code, label: '新分支' }) as string;
    expect(code).toContain('32-47: "新分支 2"');
    expect(code.match(/^\d+(?:-\d+)?:/gm)).toHaveLength(3);
    await expect(parse(code)).resolves.toBeDefined();
  });

  it('keeps every bundled Mermaid example parseable after adding a branch', async () => {
    for (const diagram of diagramData) {
      const code = diagram.examples?.[0]?.code;
      if (!code) {
        continue;
      }
      const branchCode = createDiagramBranchCode({
        code,
        label: 'A',
        sourceId: 'A'
      });
      expect(branchCode, diagram.id).toBeTruthy();
      await expect(parse(branchCode as string), diagram.id).resolves.toBeDefined();
    }
  });
});
