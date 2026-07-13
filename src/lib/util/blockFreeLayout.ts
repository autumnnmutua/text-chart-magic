import { pointAlongRoute, routeOrthogonalEdge, routeToPathData } from './edgeRouting';

export interface VisualPosition {
  x: number;
  y: number;
}

export interface BlockEdge {
  index: number;
  lineIndex: number;
  source: string;
  target: string;
}

const numberPair = /translate\(\s*(-?\d*\.?\d+)\s*[, ]\s*(-?\d*\.?\d+)\s*\)/;

const getBasePosition = (node: SVGGElement): VisualPosition => {
  const savedX = Number(node.dataset.baseX);
  const savedY = Number(node.dataset.baseY);
  if (Number.isFinite(savedX) && Number.isFinite(savedY)) return { x: savedX, y: savedY };
  const match = node.getAttribute('transform')?.match(numberPair);
  const base = { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) };
  node.dataset.baseX = `${base.x}`;
  node.dataset.baseY = `${base.y}`;
  return base;
};

const getNodeMap = (svg: SVGSVGElement): Map<string, SVGGElement> =>
  new Map(
    [...svg.querySelectorAll<SVGGElement>('g.node[data-style-id]')]
      .map((node) => [node.dataset.styleId ?? '', node] as const)
      .filter(([id]) => id)
  );

export const getBlockNodeId = (target: EventTarget | null): string =>
  target instanceof Element
    ? (target.closest<SVGGElement>('g.node[data-style-id]')?.dataset.styleId ?? '')
    : '';

export const getBlockEdges = (code: string): BlockEdge[] => {
  const edges: BlockEdge[] = [];
  for (const match of code.matchAll(
    /^[ \t]*([A-Za-z][\w-]*)[ \t]*(?:-->|==>|-\.->|--[ \t]*(?:"[^"]*"|[^\r\n]+?)[ \t]*-->)[ \t]*([A-Za-z][\w-]*)[ \t]*\r?$/gm
  )) {
    edges.push({
      index: edges.length,
      lineIndex: code.slice(0, match.index).split('\n').length - 1,
      source: match[1],
      target: match[2]
    });
  }
  return edges;
};

export const getBlockEdgeStyleId = (edge: BlockEdge): string =>
  `L_${edge.source}_${edge.target}_${edge.index}`;

export const prepareBlockEdgeTargets = (svg: SVGSVGElement, code: string): void => {
  const paths = [...svg.querySelectorAll<SVGPathElement>('path.flowchart-link')];
  const available = new Set(paths);
  for (const edge of getBlockEdges(code)) {
    const suffix = `-${edge.source}-${edge.target}`;
    const path =
      paths.find((candidate) => available.has(candidate) && candidate.id.endsWith(suffix)) ??
      paths.find((candidate) => available.has(candidate));
    if (!path) continue;
    available.delete(path);
    path.dataset.styleId = getBlockEdgeStyleId(edge);
    path.dataset.edge = 'true';
    path.style.cursor = 'pointer';
    path.style.pointerEvents = 'stroke';
  }
};

const getCenterAndSize = (node: SVGGElement) => {
  const base = getBasePosition(node);
  const offset = {
    x: Number(node.dataset.offsetX ?? 0),
    y: Number(node.dataset.offsetY ?? 0)
  };
  const box = node.getBBox();
  return {
    height: Math.max(box.height, 1),
    width: Math.max(box.width, 1),
    x: base.x + offset.x,
    y: base.y + offset.y
  };
};

const boundaryPoint = (
  from: ReturnType<typeof getCenterAndSize>,
  to: ReturnType<typeof getCenterAndSize>
): VisualPosition => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const halfWidth = from.width / 2;
  const halfHeight = from.height / 2;
  if (Math.abs(dx) / halfWidth >= Math.abs(dy) / halfHeight) {
    return { x: from.x + Math.sign(dx || 1) * halfWidth, y: from.y };
  }
  return { x: from.x, y: from.y + Math.sign(dy || 1) * halfHeight };
};

export const updateBlockEdges = (svg: SVGSVGElement, code: string, movedId = ''): void => {
  prepareBlockEdgeTargets(svg, code);
  const nodes = getNodeMap(svg);
  const edges = getBlockEdges(code);
  const labels = [...svg.querySelectorAll<SVGGElement>('g.edgeLabel')];
  for (const edge of edges) {
    if (movedId && edge.source !== movedId && edge.target !== movedId) continue;
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    const path = [...svg.querySelectorAll<SVGPathElement>('path.flowchart-link')].find(
      (candidate) => candidate.dataset.styleId === getBlockEdgeStyleId(edge)
    );
    if (!source || !target || !path) continue;
    const sourceGeometry = getCenterAndSize(source);
    const targetGeometry = getCenterAndSize(target);
    const start = boundaryPoint(sourceGeometry, targetGeometry);
    const end = boundaryPoint(targetGeometry, sourceGeometry);
    const obstacles = [...nodes.entries()]
      .filter(([id]) => id !== edge.source && id !== edge.target)
      .map(([, node]) => {
        const geometry = getCenterAndSize(node);
        return {
          bottom: geometry.y + geometry.height / 2,
          left: geometry.x - geometry.width / 2,
          right: geometry.x + geometry.width / 2,
          top: geometry.y - geometry.height / 2
        };
      });
    const parallelIndex = edges
      .slice(0, edge.index)
      .filter(
        (candidate) => candidate.source === edge.source && candidate.target === edge.target
      ).length;
    const route = routeOrthogonalEdge(start, end, obstacles, {
      laneOffset: parallelIndex * 12
    });
    path.setAttribute('d', routeToPathData(route));
    const label = labels[edge.index];
    if (label && label.textContent?.trim()) {
      const point = pointAlongRoute(route);
      label.setAttribute('transform', `translate(${point.x}, ${point.y})`);
    }
  }
};

export const applyBlockPositions = (
  svg: SVGSVGElement,
  code: string,
  positions: Record<string, VisualPosition> = {}
): void => {
  const nodes = getNodeMap(svg);
  for (const [id, node] of nodes) {
    const base = getBasePosition(node);
    const offset = positions[id] ?? { x: 0, y: 0 };
    node.dataset.offsetX = `${offset.x}`;
    node.dataset.offsetY = `${offset.y}`;
    node.setAttribute('transform', `translate(${base.x + offset.x}, ${base.y + offset.y})`);
    node.style.cursor = 'grab';
    node.style.touchAction = 'none';
  }
  updateBlockEdges(svg, code);
};

export const moveBlockNode = (
  svg: SVGSVGElement,
  code: string,
  id: string,
  position: VisualPosition
): boolean => {
  const node = getNodeMap(svg).get(id);
  if (!node) return false;
  const base = getBasePosition(node);
  node.dataset.offsetX = `${position.x}`;
  node.dataset.offsetY = `${position.y}`;
  node.setAttribute('transform', `translate(${base.x + position.x}, ${base.y + position.y})`);
  node.style.cursor = 'grabbing';
  updateBlockEdges(svg, code, id);
  return true;
};

export const clientToSvgPoint = (
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): VisualPosition | undefined => {
  const matrix = svg.getScreenCTM();
  if (!matrix) return undefined;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
};
