import { describe, expect, it } from 'vitest';
import type { VisualDocumentItem } from './visualDocument.svelte';
import { buildVisualOutline } from './visualOutline';

const item = (id: string, parentId?: string): VisualDocumentItem => ({
  canAlign: true,
  canDelete: true,
  canHide: true,
  canReorder: true,
  element: document.createElementNS('http://www.w3.org/2000/svg', 'g'),
  id,
  kind: 'node',
  label: id,
  parentId
});

describe('visual outline', () => {
  it('preserves real parent-child order and depth', () => {
    const outline = buildVisualOutline([
      item('root'),
      item('child-a', 'root'),
      item('grandchild', 'child-a'),
      item('child-b', 'root')
    ]);

    expect(outline.map(({ depth, item: current }) => [current.id, depth])).toEqual([
      ['root', 0],
      ['child-a', 1],
      ['grandchild', 2],
      ['child-b', 1]
    ]);
  });

  it('collapses descendants without deleting them from the source model', () => {
    const items = [item('root'), item('child', 'root'), item('orphan', 'missing')];
    const outline = buildVisualOutline(items, ['root']);

    expect(outline.map(({ item: current }) => current.id)).toEqual(['root', 'orphan']);
    expect(items).toHaveLength(3);
  });

  it('does not recurse forever when malformed legacy data contains a cycle', () => {
    const outline = buildVisualOutline([item('a', 'b'), item('b', 'a')]);
    expect(outline.map(({ item: current }) => current.id).sort()).toEqual(['a', 'b']);
  });
});
