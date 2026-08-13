import type { VisualElement, VisualElementShape } from '$lib/types';
import { addVisualElement, validatedState } from './state.svelte';
import { visualDocument, requestVisualEdit } from './visualDocument.svelte';
import { selectVisualElement, visualSelection } from './visualSelection.svelte';
import {
  clientToConnectionPoint,
  createVisualConnection,
  inferVisualConnectionAppearance,
  isStableConnectableItem
} from './visualConnections';
import {
  createVisualElement,
  visualElementScreenScale,
  visualElementSizeFromScreen
} from './visualElements';

const selectCreatedElement = (id: string, edit = false): void => {
  let attempts = 0;
  const select = (): void => {
    const item = visualDocument.current.find((candidate) => candidate.id === id);
    if (item) {
      selectVisualElement(item);
      if (edit) requestVisualEdit(id);
      return;
    }
    attempts += 1;
    if (attempts < 8) requestAnimationFrame(select);
  };
  requestAnimationFrame(select);
};

const ownerSvg = (element?: Element): SVGSVGElement | undefined =>
  (element as SVGGraphicsElement | undefined)?.ownerSVGElement ??
  document.querySelector<SVGSVGElement>('#view svg') ??
  undefined;

const placementFor = (
  svg: SVGSVGElement,
  width: number,
  height: number,
  parent?: Element,
  occupied: readonly Element[] = []
): { x: number; y: number } => {
  const viewport = svg.getBoundingClientRect();
  const parentRect = parent?.getBoundingClientRect();
  const scale = visualElementScreenScale(svg);
  const clientWidth = width * scale.x;
  const clientHeight = height * scale.y;
  const margin = 20;
  const clamp = (value: number, minimum: number, maximum: number): number =>
    minimum <= maximum ? Math.min(Math.max(value, minimum), maximum) : (minimum + maximum) / 2;
  const clampCenter = ({ x, y }: { x: number; y: number }) => ({
    x: clamp(
      x,
      viewport.left + clientWidth / 2 + margin,
      viewport.right - clientWidth / 2 - margin
    ),
    y: clamp(
      y,
      viewport.top + clientHeight / 2 + margin,
      viewport.bottom - clientHeight / 2 - margin
    )
  });
  const gap = 24;
  const candidates: { x: number; y: number }[] = [];
  if (parentRect) {
    const centerX = parentRect.left + parentRect.width / 2;
    const centerY = parentRect.top + parentRect.height / 2;
    const verticalStep = Math.max(clientHeight + gap, parentRect.height * 0.75);
    const horizontalStep = Math.max(clientWidth + gap, parentRect.width * 0.75);
    const lanes = [0, 1, -1, 2, -2, 3, -3];
    for (const lane of lanes) {
      candidates.push({
        x: parentRect.right + gap + clientWidth / 2,
        y: centerY + lane * verticalStep
      });
    }
    for (const lane of lanes) {
      candidates.push({
        x: parentRect.left - gap - clientWidth / 2,
        y: centerY + lane * verticalStep
      });
    }
    for (const lane of lanes) {
      candidates.push({
        x: centerX + lane * horizontalStep,
        y: parentRect.bottom + gap + clientHeight / 2
      });
    }
    for (const lane of lanes) {
      candidates.push({
        x: centerX + lane * horizontalStep,
        y: parentRect.top - gap - clientHeight / 2
      });
    }
  } else {
    const center = { x: viewport.left + viewport.width / 2, y: viewport.top + viewport.height / 2 };
    candidates.push(center);
    for (let ring = 1; ring <= 4; ring += 1) {
      candidates.push(
        { x: center.x + ring * (clientWidth + gap), y: center.y },
        { x: center.x - ring * (clientWidth + gap), y: center.y },
        { x: center.x, y: center.y + ring * (clientHeight + gap) },
        { x: center.x, y: center.y - ring * (clientHeight + gap) }
      );
    }
  }
  const occupiedRects = [...(parent ? [parent] : []), ...occupied]
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  const overlapArea = ({ x, y }: { x: number; y: number }): number => {
    const left = x - clientWidth / 2 - gap / 2;
    const right = x + clientWidth / 2 + gap / 2;
    const top = y - clientHeight / 2 - gap / 2;
    const bottom = y + clientHeight / 2 + gap / 2;
    return occupiedRects.reduce((total, rect) => {
      const overlapWidth = Math.max(0, Math.min(right, rect.right) - Math.max(left, rect.left));
      const overlapHeight = Math.max(0, Math.min(bottom, rect.bottom) - Math.max(top, rect.top));
      return total + overlapWidth * overlapHeight;
    }, 0);
  };
  const uniqueCandidates = candidates
    .map(clampCenter)
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (other) => Math.abs(other.x - candidate.x) < 1 && Math.abs(other.y - candidate.y) < 1
        ) === index
    );
  const chosen = uniqueCandidates.reduce(
    (best, candidate) => {
      const overlap = overlapArea(candidate);
      return overlap < best.overlap ? { candidate, overlap } : best;
    },
    {
      candidate: uniqueCandidates[0] ?? clampCenter({ x: viewport.left, y: viewport.top }),
      overlap: Infinity
    }
  ).candidate;
  const clientX = chosen.x;
  const clientY = chosen.y;
  const point = clientToConnectionPoint(svg, clientX, clientY) ?? { x: width, y: height };
  return { x: point.x - width / 2, y: point.y - height / 2 };
};

export const addVisualElementFromSelection = ({
  kind,
  label,
  shape
}: {
  kind: VisualElement['kind'];
  label?: string;
  shape: VisualElementShape;
}): boolean => {
  const selected = visualSelection.current
    ? visualDocument.current.find(({ id }) => id === visualSelection.current?.id)
    : undefined;
  const parent = selected && selected.kind !== 'edge' ? selected : undefined;
  const svg = ownerSvg(parent?.element);
  if (!svg) return false;
  const provisional = createVisualElement({ kind, label, position: { x: 0, y: 0 }, shape });
  const size = visualElementSizeFromScreen(svg, provisional.width, provisional.height);
  const occupied = visualDocument.current
    .filter(({ id, layoutKind }) => layoutKind === 'overlay' && id !== parent?.id)
    .map(({ element }) => element);
  const position = placementFor(svg, size.width, size.height, parent?.element, occupied);
  const element: VisualElement = {
    ...provisional,
    ...(parent ? { parentId: parent.id } : {}),
    ...size,
    ...position
  };
  const connection =
    parent && isStableConnectableItem(parent)
      ? createVisualConnection(
          { anchor: 'right', elementId: parent.id, x: 0, y: 0 },
          { anchor: 'left', elementId: element.id, x: 0, y: 0 },
          undefined,
          inferVisualConnectionAppearance(svg, validatedState.current.visualConnections, parent.id)
        )
      : undefined;
  const added = addVisualElement(element, connection);
  if (added) selectCreatedElement(element.id, true);
  return added;
};

export const addVisualElementBranch = (sourceId: string): boolean => {
  const source = validatedState.current.visualElements?.[sourceId];
  if (!source) return false;
  const sourceItem = visualDocument.current.find(({ id }) => id === sourceId);
  const svg = ownerSvg(sourceItem?.element);
  if (!svg) return false;
  const occupied = visualDocument.current
    .filter(({ id, layoutKind }) => layoutKind === 'overlay' && id !== sourceId)
    .map(({ element }) => element);
  const position = placementFor(svg, source.width, source.height, sourceItem?.element, occupied);
  const element = createVisualElement({
    kind: source.kind,
    label: `${source.label || '元素'} 分支`,
    parentId: source.id,
    position,
    shape: source.shape,
    size: { height: source.height, width: source.width }
  });
  const connection = createVisualConnection(
    { anchor: 'right', elementId: source.id, x: 0, y: 0 },
    { anchor: 'left', elementId: element.id, x: 0, y: 0 },
    undefined,
    inferVisualConnectionAppearance(svg, validatedState.current.visualConnections, source.id)
  );
  const added = addVisualElement(element, connection);
  if (added) selectCreatedElement(element.id, true);
  return added;
};
