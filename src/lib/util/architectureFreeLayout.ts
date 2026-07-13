import type { VisualPosition } from './blockFreeLayout';
import { routeOrthogonalEdge, routeToPathData } from './edgeRouting';

interface ArchitectureEdge {
  source: string;
  target: string;
}

interface NodeBounds {
  bottom: number;
  centerX: number;
  centerY: number;
  left: number;
  right: number;
  top: number;
}

const parseTranslate = (value = ''): VisualPosition => {
  const match = value.match(/translate\(\s*(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
};

const architectureEdges = (code: string): ArchitectureEdge[] =>
  [...code.matchAll(/^\s*([\w-]+):[TBRL]\s*--[^\n]*?[TBRL]:([\w-]+)\s*$/gim)].map((match) => ({
    source: match[1],
    target: match[2]
  }));

const getServiceGroup = (svg: SVGSVGElement, id: string): SVGGElement | undefined =>
  [...svg.querySelectorAll<SVGGElement>('g.architecture-service')].find(
    (group) => group.id.match(/-service-(.+)$/)?.[1] === id
  );

export const findArchitectureEdgePath = <T extends { id: string }>(
  paths: readonly T[],
  source: string,
  target: string
): T | undefined =>
  paths.find((path) => path.id.includes(`L_${source}_${target}_`)) ??
  paths.find((path) => path.id.includes(`L_${target}_${source}_`));

const getNodeBounds = (group: SVGGElement, position: VisualPosition | undefined): NodeBounds => {
  const base = parseTranslate(group.dataset.baseTransform);
  const offset = position ?? { x: 0, y: 0 };
  const box = group.getBBox();
  const left = base.x + offset.x + box.x;
  const top = base.y + offset.y + box.y;
  return {
    bottom: top + box.height,
    centerX: left + box.width / 2,
    centerY: top + box.height / 2,
    left,
    right: left + box.width,
    top
  };
};

const edgeEndpoints = (
  source: NodeBounds,
  target: NodeBounds
): [number, number, number, number] => {
  const dx = target.centerX - source.centerX;
  const dy = target.centerY - source.centerY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? [source.right, source.centerY, target.left, target.centerY]
      : [source.left, source.centerY, target.right, target.centerY];
  }
  return dy >= 0
    ? [source.centerX, source.bottom, target.centerX, target.top]
    : [source.centerX, source.top, target.centerX, target.bottom];
};

const updateArchitectureEdges = (
  svg: SVGSVGElement,
  code: string,
  positions: Record<string, VisualPosition> = {},
  movedId = ''
) => {
  const edges = architectureEdges(code);
  for (const { source, target } of edges) {
    if (movedId && source !== movedId && target !== movedId) continue;
    const sourceGroup = getServiceGroup(svg, source);
    const targetGroup = getServiceGroup(svg, target);
    const path = findArchitectureEdgePath(
      [...svg.querySelectorAll<SVGPathElement>('.architecture-edges path.edge')],
      source,
      target
    );
    if (!sourceGroup || !targetGroup || !path) continue;
    const sourceBounds = getNodeBounds(sourceGroup, positions[source]);
    const targetBounds = getNodeBounds(targetGroup, positions[target]);
    const [x1, y1, x2, y2] = edgeEndpoints(sourceBounds, targetBounds);
    const obstacles = [...svg.querySelectorAll<SVGGElement>('g.architecture-service')].flatMap(
      (group) => {
        const id = group.dataset.architectureId ?? group.id.match(/-service-(.+)$/)?.[1];
        if (!id || id === source || id === target) return [];
        return [getNodeBounds(group, positions[id])];
      }
    );
    const route = routeOrthogonalEdge({ x: x1, y: y1 }, { x: x2, y: y2 }, obstacles);
    path.setAttribute('d', routeToPathData(route));
  }
};

export const applyArchitecturePositions = (
  svg: SVGSVGElement,
  code: string,
  positions: Record<string, VisualPosition> = {}
) => {
  for (const group of svg.querySelectorAll<SVGGElement>('g.architecture-service')) {
    const id = group.id.match(/-service-(.+)$/)?.[1];
    if (!id) continue;
    group.dataset.architectureId = id;
    group.dataset.baseTransform ||= group.getAttribute('transform') ?? 'translate(0, 0)';
    const base = parseTranslate(group.dataset.baseTransform);
    const offset = positions[id] ?? { x: 0, y: 0 };
    group.setAttribute('transform', `translate(${base.x + offset.x}, ${base.y + offset.y})`);
    group.style.cursor = 'move';
    group.style.pointerEvents = 'all';
    group.style.touchAction = 'none';
  }
  updateArchitectureEdges(svg, code, positions);
};

export const getArchitectureNodeId = (target: EventTarget | null): string =>
  target instanceof Element
    ? (target.closest<SVGGElement>('g[data-architecture-id]')?.dataset.architectureId ?? '')
    : '';

export const moveArchitectureNode = (
  svg: SVGSVGElement,
  code: string,
  id: string,
  position: VisualPosition,
  positions: Record<string, VisualPosition> = {}
) => {
  const nextPositions = { ...positions, [id]: position };
  const group = getServiceGroup(svg, id);
  if (!group) return;
  const base = parseTranslate(group.dataset.baseTransform);
  group.setAttribute('transform', `translate(${base.x + position.x}, ${base.y + position.y})`);
  group.style.cursor = 'grabbing';
  updateArchitectureEdges(svg, code, nextPositions, id);
};
