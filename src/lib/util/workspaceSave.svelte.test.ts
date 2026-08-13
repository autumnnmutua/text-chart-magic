import { clearActive, historyState, setMode } from '$lib/components/History/historyState.svelte';
import { defaultState, replaceInputState } from '$lib/util/state.svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveCurrentWorkspace, workspaceSaveState } from './workspaceSave.svelte';

beforeEach(() => {
  setMode('manual');
  clearActive();
  replaceInputState({ ...defaultState, code: 'flowchart TD\n A --> B' });
});

describe('workspace save', () => {
  it('stores one complete manual snapshot and marks the workspace saved', async () => {
    replaceInputState({
      ...defaultState,
      code: 'flowchart TD\n A --> B',
      sampleDescription: '完整作品说明',
      visualElements: {
        'element-person-1': {
          height: 120,
          id: 'element-person-1',
          kind: 'icon',
          label: '移动端用户',
          shape: 'person',
          width: 100,
          x: 20,
          y: 30
        }
      },
      visualPositions: { 'element-person-1': { x: 45, y: 25 } },
      visualStyles: { 'element-person-1': { fill: '#fb923c', stroke: '#c2410c' } }
    });
    expect(workspaceSaveState.hasUnsavedChanges).toBe(true);
    expect(await saveCurrentWorkspace()).toBe('saved');
    expect(historyState.manualEntries).toHaveLength(1);
    expect(historyState.manualEntries[0].state.code).toBe('flowchart TD\n A --> B');
    expect(historyState.manualEntries[0].state.sampleDescription).toBe('完整作品说明');
    expect(historyState.manualEntries[0].state.visualElements?.['element-person-1'].label).toBe(
      '移动端用户'
    );
    expect(historyState.manualEntries[0].state.visualPositions?.['element-person-1']).toEqual({
      x: 45,
      y: 25
    });
    expect(historyState.manualEntries[0].state.visualStyles?.['element-person-1'].fill).toBe(
      '#fb923c'
    );
    expect(workspaceSaveState.hasUnsavedChanges).toBe(false);
  });

  it('deduplicates repeated saves and rejects a concurrent trigger', async () => {
    const first = saveCurrentWorkspace();
    expect(await saveCurrentWorkspace()).toBe('busy');
    expect(await first).toBe('saved');
    expect(await saveCurrentWorkspace()).toBe('unchanged');
    expect(historyState.manualEntries).toHaveLength(1);
  });

  it('keeps the workspace unsaved when browser storage rejects the snapshot', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === 'manualHistoryStore') {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
    });
    expect(await saveCurrentWorkspace()).toBe('failed');
    expect(historyState.manualEntries).toHaveLength(0);
    expect(workspaceSaveState.hasUnsavedChanges).toBe(true);
    setItem.mockRestore();
  });
});
