import type { VisualPosition } from '$/types';
import { notify } from './notify';
import {
  deleteDiagramElements,
  deleteVisualElements,
  inputState,
  updateVisualLayer,
  updateVisualLayers,
  updateVisualPositionsBatch,
  validatedState
} from './state.svelte';
import { visualDocument, type VisualDocumentItem } from './visualDocument.svelte';
import {
  clearVisualSelection,
  selectVisualElement,
  setVisualSelection,
  visualSelection
} from './visualSelection.svelte';

export type AlignmentCommand =
  | 'bottom'
  | 'center-horizontal'
  | 'center-vertical'
  | 'distribute-horizontal'
  | 'distribute-vertical'
  | 'left'
  | 'right'
  | 'top';

const selectedDocumentItems = (): VisualDocumentItem[] =>
  visualSelection.items
    .map(({ id }) => visualDocument.current.find((item) => item.id === id))
    .filter((item): item is VisualDocumentItem => Boolean(item));

const isLocked = (id: string): boolean =>
  Boolean(validatedState.current.visualLayers?.[id]?.locked);

const getFreeLayoutSelection = (
  minimum = 1,
  { quiet = false }: { quiet?: boolean } = {}
): VisualDocumentItem[] => {
  const selected = selectedDocumentItems();
  const movable = selected.filter((item) => item.canAlign && item.layoutKind && !isLocked(item.id));
  const kinds = new Set(movable.map(({ layoutKind }) => layoutKind));
  if (movable.length < minimum || movable.length !== selected.length || kinds.size !== 1) {
    if (!quiet) {
      notify(
        '该操作只适用于同一种自由布局中的未锁定模块。流程、时序和甘特等专业布局会保留自身规则。'
      );
    }
    return [];
  }
  return movable;
};

const clientDeltaToSvg = (item: VisualDocumentItem, dx: number, dy: number): VisualPosition => {
  const svg = (item.element as SVGGraphicsElement).ownerSVGElement;
  const coordinateSpace = svg?.querySelector<SVGGraphicsElement>('.svg-pan-zoom_viewport') ?? svg;
  const matrix = coordinateSpace?.getScreenCTM();
  if (!matrix) return { x: dx, y: dy };
  const inverse = matrix.inverse();
  const start = new DOMPoint(0, 0).matrixTransform(inverse);
  const end = new DOMPoint(dx, dy).matrixTransform(inverse);
  return { x: end.x - start.x, y: end.y - start.y };
};

const updatesFromClientDeltas = (
  deltas: ReadonlyMap<string, VisualPosition>
): Record<string, VisualPosition> => {
  const updates: Record<string, VisualPosition> = {};
  for (const item of selectedDocumentItems()) {
    const clientDelta = deltas.get(item.id);
    if (!clientDelta) continue;
    const delta = clientDeltaToSvg(item, clientDelta.x, clientDelta.y);
    const current = validatedState.current.visualPositions?.[item.id] ?? { x: 0, y: 0 };
    updates[item.id] = { x: current.x + delta.x, y: current.y + delta.y };
  }
  return updates;
};

export const canAlignSelection = (minimum = 2): boolean =>
  getFreeLayoutSelection(minimum, { quiet: true }).length >= minimum;

export const alignSelected = (command: AlignmentCommand): boolean => {
  const minimum = command.startsWith('distribute') ? 3 : 2;
  const items = getFreeLayoutSelection(minimum);
  if (items.length < minimum) return false;
  const boxes = new Map(items.map((item) => [item.id, item.element.getBoundingClientRect()]));
  const deltas = new Map<string, VisualPosition>();

  const left = Math.min(...items.map((item) => boxes.get(item.id)?.left ?? 0));
  const right = Math.max(...items.map((item) => boxes.get(item.id)?.right ?? 0));
  const top = Math.min(...items.map((item) => boxes.get(item.id)?.top ?? 0));
  const bottom = Math.max(...items.map((item) => boxes.get(item.id)?.bottom ?? 0));
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  if (command === 'distribute-horizontal') {
    const sorted = [...items].sort(
      (a, b) => (boxes.get(a.id)?.left ?? 0) - (boxes.get(b.id)?.left ?? 0)
    );
    const totalWidth = sorted.reduce((sum, item) => sum + (boxes.get(item.id)?.width ?? 0), 0);
    const gap = (right - left - totalWidth) / Math.max(sorted.length - 1, 1);
    let cursor = left;
    for (const item of sorted) {
      const box = boxes.get(item.id);
      if (!box) continue;
      deltas.set(item.id, { x: cursor - box.left, y: 0 });
      cursor += box.width + gap;
    }
  } else if (command === 'distribute-vertical') {
    const sorted = [...items].sort(
      (a, b) => (boxes.get(a.id)?.top ?? 0) - (boxes.get(b.id)?.top ?? 0)
    );
    const totalHeight = sorted.reduce((sum, item) => sum + (boxes.get(item.id)?.height ?? 0), 0);
    const gap = (bottom - top - totalHeight) / Math.max(sorted.length - 1, 1);
    let cursor = top;
    for (const item of sorted) {
      const box = boxes.get(item.id);
      if (!box) continue;
      deltas.set(item.id, { x: 0, y: cursor - box.top });
      cursor += box.height + gap;
    }
  } else {
    for (const item of items) {
      const box = boxes.get(item.id);
      if (!box) continue;
      const x =
        command === 'left'
          ? left - box.left
          : command === 'right'
            ? right - box.right
            : command === 'center-horizontal'
              ? centerX - (box.left + box.right) / 2
              : 0;
      const y =
        command === 'top'
          ? top - box.top
          : command === 'bottom'
            ? bottom - box.bottom
            : command === 'center-vertical'
              ? centerY - (box.top + box.bottom) / 2
              : 0;
      deltas.set(item.id, { x, y });
    }
  }
  return updateVisualPositionsBatch(updatesFromClientDeltas(deltas));
};

export const nudgeSelected = (dx: number, dy: number): boolean => {
  const items = getFreeLayoutSelection(1);
  if (items.length === 0) return false;
  const deltas = new Map(items.map((item) => [item.id, { x: dx, y: dy }]));
  return updateVisualPositionsBatch(updatesFromClientDeltas(deltas));
};

export const deleteSelectedElements = (): number => {
  const selected = selectedDocumentItems();
  const selectedVisualElementIds = new Set(
    selected
      .filter((item) => Boolean(validatedState.current.visualElements?.[item.id]))
      .map(({ id }) => id)
  );
  const items = selected.filter((item) => item.canDelete && !isLocked(item.id));
  if (items.length === 0) {
    notify('当前选择没有可删除的未锁定元素。');
    return 0;
  }
  const connectionIds = items
    .filter((item) => Boolean(validatedState.current.visualConnections?.[item.id]))
    .map(({ id }) => id);
  const visualElementIds = items
    .filter((item) => Boolean(validatedState.current.visualElements?.[item.id]))
    .map(({ id }) => id);
  const diagramItems = items.filter(
    (item) => !connectionIds.includes(item.id) && !visualElementIds.includes(item.id)
  );
  const deletedVisualElements = deleteVisualElements(visualElementIds);
  const deletedDiagramElements =
    diagramItems.length > 0 || connectionIds.length > 0
      ? deleteDiagramElements(
          diagramItems.map((item) => ({
            occurrence: item.occurrence,
            sourceId: item.sourceId,
            styleId: item.styleId ?? item.id,
            text: item.kind === 'edge' && item.label === '连线' ? '箭头' : item.label
          })),
          connectionIds
        )
      : 0;
  const deleted = deletedVisualElements + deletedDiagramElements;
  if (deleted > 0) {
    const skipped = selected.filter(
      (item) =>
        !items.some(({ id }) => id === item.id) &&
        (!selectedVisualElementIds.has(item.id) || Boolean(inputState.visualElements?.[item.id]))
    );
    if (skipped.length > 0) {
      setVisualSelection(skipped);
      notify(`已删除可编辑元素，保留 ${skipped.length} 个锁定或固定结构元素。`);
    } else {
      clearVisualSelection();
    }
  }
  return deleted;
};

export const selectAllVisualElements = (): void => {
  setVisualSelection(
    visualDocument.current.filter((item) => !validatedState.current.visualLayers?.[item.id]?.hidden)
  );
};

export const selectVisualDocumentItem = (id: string, additive = false): void => {
  const item = visualDocument.current.find((candidate) => candidate.id === id);
  if (item) selectVisualElement(item, { additive });
};

export const setSelectedLocked = (locked: boolean): boolean =>
  updateVisualLayer(visualSelection.ids, { locked });

export const setSelectedHidden = (hidden: boolean): boolean => {
  const ids = selectedDocumentItems()
    .filter(({ canHide }) => canHide)
    .map(({ id }) => id);
  if (ids.length === 0) {
    notify('该图表的专业结构不允许隐藏当前元素。');
    return false;
  }
  const changed = updateVisualLayer(ids, { hidden });
  if (changed && hidden) clearVisualSelection();
  return changed;
};

export const moveSelectedLayer = (direction: -1 | 1): boolean => {
  const items = selectedDocumentItems().filter((item) => item.canReorder);
  if (items.length === 0) {
    notify('当前图表使用固定语义层级，不能调整前后顺序。');
    return false;
  }
  const currentLayers = validatedState.current.visualLayers ?? {};
  return updateVisualLayers(
    Object.fromEntries(
      items.map(({ id }) => [id, { zIndex: (currentLayers[id]?.zIndex ?? 0) + direction }])
    )
  );
};
