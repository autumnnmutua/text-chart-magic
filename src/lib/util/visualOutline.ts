import type { VisualDocumentItem } from './visualDocument.svelte';

export interface VisualOutlineItem {
  depth: number;
  hasChildren: boolean;
  item: VisualDocumentItem;
}

export const buildVisualOutline = (
  items: readonly VisualDocumentItem[],
  collapsedIds: readonly string[] = []
): VisualOutlineItem[] => {
  const ids = new Set(items.map(({ id }) => id));
  const children = new Map<string, VisualDocumentItem[]>();
  for (const item of items) {
    if (!item.parentId || !ids.has(item.parentId) || item.parentId === item.id) continue;
    children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  }
  const roots = items.filter(
    ({ id, parentId }) => !parentId || !ids.has(parentId) || parentId === id
  );
  const result: VisualOutlineItem[] = [];
  const visited = new Set<string>();

  const visit = (item: VisualDocumentItem, depth: number): void => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    const nested = children.get(item.id) ?? [];
    result.push({ depth, hasChildren: nested.length > 0, item });
    if (!collapsedIds.includes(item.id)) {
      for (const child of nested) visit(child, depth + 1);
    }
  };

  for (const root of roots) visit(root, 0);
  const isInsideCollapsedParent = (item: VisualDocumentItem): boolean => {
    let parentId = item.parentId;
    const checked = new Set<string>();
    while (parentId && ids.has(parentId) && !checked.has(parentId)) {
      if (collapsedIds.includes(parentId)) return true;
      checked.add(parentId);
      parentId = items.find(({ id }) => id === parentId)?.parentId;
    }
    return false;
  };
  for (const item of items) {
    if (!isInsideCollapsedParent(item)) visit(item, 0);
  }
  return result;
};
