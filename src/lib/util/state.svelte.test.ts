import type { State } from '$lib/types';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { parse } from './mermaid';
import { serializeState } from './serde';
import {
  addVisualConnection,
  addVisualElement,
  createDiagramBranchCode,
  defaultState,
  deleteVisualConnections,
  deleteVisualElements,
  inputState,
  loadDiagramTemplate,
  loadState,
  normalizeState,
  persistenceState,
  replaceAllDiagramText,
  replaceInputState,
  loadDiagramCode,
  redoLastEdit,
  resetToDefaultGraph,
  toggleDarkTheme,
  updateCode,
  updateCodeStore,
  updateSampleDescription,
  updateVisualLayer,
  updateVisualConnection,
  updateVisualPositions,
  updateVisualPositionsBatch,
  updateVisualStyle,
  updateVisualStyles,
  updateConfig,
  undoLastEdit,
  validatedState,
  verifyState,
  waitForStateValidation
} from './state.svelte';
import { searchEditableSourceText } from './searchModel';
import { createVisualConnection } from './visualConnections';

describe('saved state compatibility', () => {
  it('waits for the newest validation when updates arrive back to back', async () => {
    updateCode('flowchart LR\n  A[过期状态]');
    updateCode('flowchart LR\n  B[最终状态]');

    await waitForStateValidation();

    expect(validatedState.current.code).toContain('B[最终状态]');
    expect(validatedState.current.code).not.toContain('过期状态');
  });

  it('keeps an invalid manual draft instead of silently rolling it back while the user pauses', async () => {
    const validCode = 'flowchart LR\n  A[有效内容] --> B[终点]';
    const invalidDraft = `${validCode}\n  C[尚未写完`;
    loadDiagramCode(validCode);
    await waitForStateValidation();

    updateCode(invalidDraft);
    await waitForStateValidation();
    expect(validatedState.current.error).toBeDefined();
    expect(inputState.code).toBe(invalidDraft);

    await new Promise((resolve) => setTimeout(resolve, 1_300));
    expect(inputState.code).toBe(invalidDraft);

    loadDiagramCode(validCode);
    await waitForStateValidation();
  });

  it('fills fields missing from legacy saved data without replacing its diagram', () => {
    const normalized = normalizeState({ code: 'flowchart LR\n  Legacy[旧作品]' });

    expect(normalized.code).toContain('Legacy[旧作品]');
    expect(normalized.mermaid).toBe(defaultState.mermaid);
    expect(normalized.grid).toBe(defaultState.grid);
    expect(normalized.panZoom).toBe(defaultState.panZoom);
    expect(normalized.rough).toBe(defaultState.rough);
    expect(normalized.updateDiagram).toBe(defaultState.updateDiagram);
    expect(normalized.editorMode).toBe('code');
    expect(normalized.schemaVersion).toBe(1);
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

  it('clamps finite legacy zoom values to the supported viewport range', () => {
    expect(normalizeState({ ...defaultState, zoom: -4 }).zoom).toBe(0.05);
    expect(normalizeState({ ...defaultState, zoom: 200 }).zoom).toBe(12);
    expect(normalizeState({ ...defaultState, zoom: 2.5 }).zoom).toBe(2.5);
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

  it('loads saved independent arrows with safe defaults', () => {
    const normalized = normalizeState({
      ...defaultState,
      visualConnections: {
        'connection-old': {
          id: 'connection-old',
          source: { elementId: 'A', anchor: 'right', x: 10, y: 20 },
          target: { x: 80, y: 20 }
        }
      }
    });
    expect(normalized.visualConnections?.['connection-old']).toMatchObject({
      direction: 'forward',
      label: '关系',
      lineStyle: 'solid',
      strokeWidth: 2
    });
  });

  it('detaches imported arrows from missing overlay elements without deleting the arrow', () => {
    const normalized = normalizeState({
      ...defaultState,
      visualConnections: {
        'connection-orphan': {
          direction: 'forward',
          id: 'connection-orphan',
          label: '仍可编辑',
          lineStyle: 'solid',
          source: {
            anchor: 'right',
            elementId: 'element-missing',
            x: 10,
            y: 20
          },
          strokeWidth: 2,
          target: { x: 80, y: 20 }
        }
      }
    });

    expect(normalized.visualConnections?.['connection-orphan'].source).toEqual({ x: 10, y: 20 });
    expect(normalized.visualConnections?.['connection-orphan'].label).toBe('仍可编辑');
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
  it('stores create, edit and delete arrow actions as reversible state changes', () => {
    loadDiagramCode('block-beta\n  A["A"]\n  B["B"]');
    const connection = createVisualConnection(
      { anchor: 'right', elementId: 'A', x: 10, y: 20 },
      { anchor: 'left', elementId: 'B', x: 80, y: 20 },
      'connection-history'
    );
    expect(addVisualConnection(connection)).toBe(true);
    expect(inputState.visualConnections?.[connection.id]?.label).toBe('关系');

    expect(updateVisualConnection({ ...connection, label: '调用' })).toBe(true);
    expect(inputState.visualConnections?.[connection.id]?.label).toBe('调用');
    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualConnections?.[connection.id]?.label).toBe('关系');
    expect(redoLastEdit()).toBe(true);
    expect(inputState.visualConnections?.[connection.id]?.label).toBe('调用');

    expect(deleteVisualConnections([connection.id])).toBe(1);
    expect(inputState.visualConnections).toBeUndefined();
    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualConnections?.[connection.id]?.label).toBe('调用');
  });

  it('stores editable visual elements and removes their connected arrows atomically', () => {
    loadDiagramCode('block-beta\n  A["原始模块"]');
    const element = {
      height: 76,
      id: 'element-test',
      kind: 'shape' as const,
      label: '菱形分支',
      parentId: 'A',
      shape: 'diamond' as const,
      width: 132,
      x: 180,
      y: 40
    };
    const connection = createVisualConnection(
      { anchor: 'right', elementId: 'A', x: 0, y: 0 },
      { anchor: 'left', elementId: element.id, x: 0, y: 0 },
      'connection-element-test'
    );
    expect(addVisualElement(element, connection)).toBe(true);
    expect(inputState.visualElements?.[element.id]?.shape).toBe('diamond');
    expect(inputState.visualConnections?.[connection.id]?.target.elementId).toBe(element.id);

    expect(deleteVisualElements([element.id])).toBe(1);
    expect(inputState.visualElements).toBeUndefined();
    expect(inputState.visualConnections).toBeUndefined();
    expect(undoLastEdit()).toBe(true);
    expect(inputState.visualElements?.[element.id]?.label).toBe('菱形分支');
    expect(inputState.visualConnections?.[connection.id]).toBeDefined();
  });

  it('deletes a visual parent, its descendants and every connected arrow as one undo step', () => {
    loadDiagramCode('block-beta\n  A["原始模块"]');
    const parent = {
      height: 76,
      id: 'element-parent',
      kind: 'shape' as const,
      label: '父模块',
      parentId: 'A',
      shape: 'rounded' as const,
      width: 132,
      x: 180,
      y: 40
    };
    const child = {
      ...parent,
      id: 'element-child',
      label: '子模块',
      parentId: parent.id,
      x: 340
    };
    const grandchild = {
      ...parent,
      id: 'element-grandchild',
      label: '孙模块',
      parentId: child.id,
      x: 500
    };
    const connection = createVisualConnection(
      { anchor: 'right', elementId: parent.id, x: 0, y: 0 },
      { anchor: 'left', elementId: child.id, x: 0, y: 0 },
      'connection-parent-child'
    );

    expect(addVisualElement(parent)).toBe(true);
    expect(addVisualElement(child, connection)).toBe(true);
    expect(addVisualElement(grandchild)).toBe(true);
    expect(deleteVisualElements([parent.id])).toBe(3);
    expect(inputState.visualElements).toBeUndefined();
    expect(inputState.visualConnections).toBeUndefined();

    expect(undoLastEdit()).toBe(true);
    expect(Object.keys(inputState.visualElements ?? {})).toEqual([
      parent.id,
      child.id,
      grandchild.id
    ]);
    expect(inputState.visualConnections?.[connection.id]).toBeDefined();
  });

  it('edits and deletes a sample description without changing the diagram', () => {
    const code = 'flowchart LR\n  A[示例]';
    loadDiagramTemplate({ code, sampleDescription: '原始说明' });
    expect(updateSampleDescription('更新后的说明')).toBe(true);
    expect(inputState.sampleDescription).toBe('更新后的说明');
    expect(updateSampleDescription(undefined)).toBe(true);
    expect(inputState.sampleDescription).toBeUndefined();
    expect(inputState.code).toBe(code);
    expect(undoLastEdit()).toBe(true);
    expect(inputState.sampleDescription).toBe('原始说明');
  });

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

  it('replaces source and independent-arrow text in one undoable transaction', () => {
    const code = 'block-beta\n  A["旧模块"]\n  B["目标"]';
    loadDiagramCode(code);
    const connection = {
      ...createVisualConnection(
        { anchor: 'right', elementId: 'A', x: 10, y: 20 },
        { anchor: 'left', elementId: 'B', x: 80, y: 20 },
        'connection-replace'
      ),
      label: '旧关系'
    };
    expect(addVisualConnection(connection)).toBe(true);
    const sourceMatch = searchEditableSourceText(code, '旧', {
      caseSensitive: false,
      wholeWord: false
    })[0];
    expect(
      replaceAllDiagramText([
        { currentText: sourceMatch.text, nextText: '新', range: sourceMatch.range },
        {
          connectionId: connection.id,
          currentText: '旧',
          nextText: '新',
          range: { end: 1, start: 0 }
        }
      ])
    ).toBe(2);
    expect(inputState.code).toContain('新模块');
    expect(inputState.visualConnections?.[connection.id].label).toBe('新关系');
    expect(undoLastEdit()).toBe(true);
    expect(inputState.code).toBe(code);
    expect(inputState.visualConnections?.[connection.id].label).toBe('旧关系');
  });

  it('replaces source, arrow and free-element text in one undoable transaction', () => {
    const code = 'flowchart LR\n  A[旧入口] --> B[目标]';
    loadDiagramCode(code);
    const element = {
      height: 76,
      id: 'element-replace',
      kind: 'shape' as const,
      label: '旧模块',
      shape: 'rounded' as const,
      width: 132,
      x: 180,
      y: 40
    };
    expect(addVisualElement(element)).toBe(true);
    const sourceMatch = searchEditableSourceText(code, '旧', {
      caseSensitive: false,
      wholeWord: false
    })[0];

    expect(
      replaceAllDiagramText([
        { currentText: sourceMatch.text, nextText: '新', range: sourceMatch.range },
        {
          currentText: '旧',
          nextText: '新',
          range: { end: 1, start: 0 },
          visualElementId: element.id
        }
      ])
    ).toBe(2);
    expect(inputState.code).toContain('新入口');
    expect(inputState.visualElements?.[element.id].label).toBe('新模块');

    expect(undoLastEdit()).toBe(true);
    expect(inputState.code).toBe(code);
    expect(inputState.visualElements?.[element.id].label).toBe('旧模块');
  });

  it('keeps an explicitly empty visual-element label across normalization', () => {
    const normalized = normalizeState({
      ...defaultState,
      visualElements: {
        'element-empty': {
          height: 76,
          id: 'element-empty',
          kind: 'shape',
          label: '',
          shape: 'rectangle',
          width: 132,
          x: 0,
          y: 0
        }
      }
    });

    expect(normalized.visualElements?.['element-empty'].label).toBe('');
  });

  it('does not create history or report replacements when text stays unchanged', () => {
    const code = 'flowchart LR\n  A[保持原文] --> B[目标]';
    loadDiagramCode(code);
    const match = searchEditableSourceText(code, '保持', {
      caseSensitive: false,
      wholeWord: false
    })[0];

    expect(
      replaceAllDiagramText([{ currentText: match.text, nextText: match.text, range: match.range }])
    ).toBe(0);
    expect(inputState.code).toBe(code);
    expect(undoLastEdit()).toBe(false);
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

  it('reports a blocked code-store write and recovers on the next successful update', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    updateCode('graph TD\n storage-blocked');
    expect(persistenceState.hasWriteFailure).toBe(true);

    setItem.mockRestore();
    updateCode('graph TD\n storage-restored');
    expect(persistenceState.lastWriteSucceeded).toBe(true);
    expect(readStoredState().code).toContain('storage-restored');
  });

  it('keeps the current document when an invalid shared state is loaded', () => {
    loadDiagramCode('flowchart LR\n  Current[当前作品]');
    loadState('not-a-valid-state');

    expect(inputState.code).toContain('Current[当前作品]');
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

  it('keeps an explicit diagram render pulse even when the flag is already true', () => {
    updateCodeStore({ updateDiagram: true });
    const firstRenderCount = inputState.renderCount ?? 0;
    updateCodeStore({ updateDiagram: true });
    expect(inputState.renderCount).toBeGreaterThan(firstRenderCount);
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

  it('loads a complete showcase template and resets code, style, position and arrows together', async () => {
    const code = 'block-beta\n  A["起点"]\n  B["终点"]';
    const connection = createVisualConnection(
      { anchor: 'right', elementId: 'A', x: 10, y: 10 },
      { anchor: 'left', elementId: 'B', x: 100, y: 10 },
      'connection-template'
    );
    loadDiagramTemplate({
      code,
      visualConnections: { [connection.id]: connection },
      visualPositions: { A: { x: 20, y: 30 } },
      visualStyles: { A: { fill: '#fed7aa' } }
    });
    await vi.waitUntil(
      () => validatedState.current.code === code && validatedState.current.error === undefined
    );

    updateVisualPositions({ A: { x: 200, y: 300 } });
    deleteVisualConnections([connection.id]);
    updateVisualStyle('A', { fill: '#ffffff' });
    resetToDefaultGraph();

    expect(inputState.code).toBe(code);
    expect(inputState.visualPositions?.A).toEqual({ x: 20, y: 30 });
    expect(inputState.visualStyles?.A.fill).toBe('#fed7aa');
    expect(inputState.visualConnections?.[connection.id]).toEqual(connection);
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
});
