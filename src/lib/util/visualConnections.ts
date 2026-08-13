import type {
  State,
  VisualAnchorId,
  VisualConnection,
  VisualConnectionEndpoint,
  VisualPosition
} from '$lib/types';
import {
  pointAlongRoute,
  routeOrthogonalEdge,
  routeToPathData,
  type RouteRect
} from './edgeRouting';
import type { VisualDocumentItem } from './visualDocument.svelte';

export const VISUAL_CONNECTION_PREFIX = 'connection-';
export const DEFAULT_CONNECTION_LABEL = '关系';
export const CONNECTION_SNAP_PX = 14;
export const TOUCH_CONNECTION_SNAP_PX = 18;
export const PARALLEL_CONNECTION_SPACING = 12;
const MAX_VISUAL_CONNECTIONS = 10_000;

const SVG_NS = 'http://www.w3.org/2000/svg';
const anchorOrder: VisualAnchorId[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left'
];

export interface VisualAnchorPoint extends VisualPosition {
  anchor: VisualAnchorId;
  elementId: string;
}

export interface VisualObstacle extends RouteRect {
  elementId: string;
}

export interface VisualConnectionGeometry {
  anchors: VisualAnchorPoint[];
  obstacles: VisualObstacle[];
  screenAnchors: VisualAnchorPoint[];
  viewport: SVGGElement;
}

export interface ConnectionSnapCandidate extends VisualAnchorPoint {
  distance: number;
}

export interface VisualConnectionRenderOptions {
  activeEndpoint?: VisualConnectionEndpoint;
  baseConnections?: State['visualConnections'];
  geometry?: VisualConnectionGeometry;
  laneOffset?: number;
  overrides?: Readonly<Record<string, VisualConnection>>;
  selectedIds?: ReadonlySet<string>;
  showAnchors?: boolean;
}

export type VisualConnectionAppearance = Pick<
  VisualConnection,
  'direction' | 'labelBackground' | 'labelColor' | 'lineStyle' | 'stroke' | 'strokeWidth'
>;

const DEFAULT_CONNECTION_APPEARANCE: VisualConnectionAppearance = {
  direction: 'forward',
  labelBackground: '#fff7ed',
  labelColor: '#431407',
  lineStyle: 'solid',
  stroke: '#ea580c',
  strokeWidth: 2
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeColor = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const color = value.trim();
  return /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%+-]+\)|currentColor)$/i.test(color)
    ? color
    : undefined;
};

const normalizeEndpoint = (value: unknown): VisualConnectionEndpoint | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y)) return undefined;
  const endpoint: VisualConnectionEndpoint = { x: candidate.x, y: candidate.y };
  if (typeof candidate.elementId === 'string' && candidate.elementId) {
    endpoint.elementId = candidate.elementId;
  }
  if (
    typeof candidate.anchor === 'string' &&
    anchorOrder.includes(candidate.anchor as VisualAnchorId)
  ) {
    endpoint.anchor = candidate.anchor as VisualAnchorId;
  }
  return endpoint;
};

export const normalizeVisualConnections = (value: unknown): State['visualConnections'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const connections: NonNullable<State['visualConnections']> = {};
  for (const [key, rawConnection] of Object.entries(value).slice(0, MAX_VISUAL_CONNECTIONS)) {
    if (!rawConnection || typeof rawConnection !== 'object' || Array.isArray(rawConnection))
      continue;
    const candidate = rawConnection as Record<string, unknown>;
    const source = normalizeEndpoint(candidate.source);
    const target = normalizeEndpoint(candidate.target);
    if (!source || !target) continue;
    const id =
      typeof candidate.id === 'string' && candidate.id.startsWith(VISUAL_CONNECTION_PREFIX)
        ? candidate.id
        : key.startsWith(VISUAL_CONNECTION_PREFIX)
          ? key
          : '';
    if (!id) continue;
    if (connections[id]) continue;
    const direction = ['both', 'forward', 'none'].includes(String(candidate.direction))
      ? (candidate.direction as VisualConnection['direction'])
      : 'forward';
    const labelBackground = normalizeColor(candidate.labelBackground);
    const labelColor = normalizeColor(candidate.labelColor);
    const stroke = normalizeColor(candidate.stroke);
    connections[id] = {
      direction,
      id,
      ...(labelBackground ? { labelBackground } : {}),
      ...(labelColor ? { labelColor } : {}),
      label:
        typeof candidate.label === 'string'
          ? candidate.label.slice(0, 240)
          : DEFAULT_CONNECTION_LABEL,
      lineStyle: candidate.lineStyle === 'dashed' ? 'dashed' : 'solid',
      source,
      ...(stroke ? { stroke } : {}),
      strokeWidth: isFiniteNumber(candidate.strokeWidth)
        ? Math.min(Math.max(candidate.strokeWidth, 1), 8)
        : 2,
      target
    };
  }
  return Object.keys(connections).length > 0 ? connections : undefined;
};

export const createVisualConnectionId = (): string => {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${VISUAL_CONNECTION_PREFIX}${suffix}`;
};

export const createVisualConnection = (
  source: VisualConnectionEndpoint,
  target: VisualConnectionEndpoint,
  id = createVisualConnectionId(),
  appearance: Partial<VisualConnectionAppearance> = {}
): VisualConnection => ({
  ...DEFAULT_CONNECTION_APPEARANCE,
  ...appearance,
  direction: appearance.direction ?? DEFAULT_CONNECTION_APPEARANCE.direction,
  id,
  label: DEFAULT_CONNECTION_LABEL,
  lineStyle: appearance.lineStyle ?? DEFAULT_CONNECTION_APPEARANCE.lineStyle,
  source: { ...source },
  strokeWidth: appearance.strokeWidth ?? DEFAULT_CONNECTION_APPEARANCE.strokeWidth,
  target: { ...target }
});

const connectionAppearance = (connection: VisualConnection): VisualConnectionAppearance => ({
  direction: connection.direction,
  labelBackground: connection.labelBackground ?? DEFAULT_CONNECTION_APPEARANCE.labelBackground,
  labelColor: connection.labelColor ?? DEFAULT_CONNECTION_APPEARANCE.labelColor,
  lineStyle: connection.lineStyle,
  stroke: connection.stroke ?? DEFAULT_CONNECTION_APPEARANCE.stroke,
  strokeWidth: connection.strokeWidth
});

const readableStroke = (element: SVGElement): string | undefined => {
  const attribute = normalizeColor(element.getAttribute('stroke'));
  if (attribute && attribute !== 'currentColor') return attribute;
  if (typeof getComputedStyle !== 'function') return attribute;
  const computed = normalizeColor(getComputedStyle(element).stroke);
  return computed && computed !== 'currentColor' ? computed : attribute;
};

export const inferVisualConnectionAppearance = (
  svg: SVGSVGElement,
  connections: State['visualConnections'],
  sourceElementId = ''
): VisualConnectionAppearance => {
  const existing = Object.values(connections ?? {});
  const related = existing.find(
    ({ source, target }) =>
      sourceElementId &&
      (source.elementId === sourceElementId || target.elementId === sourceElementId)
  );
  if (related) return connectionAppearance(related);
  if (existing[0]) return connectionAppearance(existing[0]);

  const nativePath = [
    ...svg.querySelectorAll<SVGElement>('path.flowchart-link, g.edgePath path, line')
  ].find(
    (element) =>
      !element.closest('[data-visual-connection]') &&
      element.getAttribute('stroke') !== 'transparent'
  );
  if (!nativePath) return { ...DEFAULT_CONNECTION_APPEARANCE };
  const width = Number.parseFloat(
    nativePath.getAttribute('stroke-width') ??
      (typeof getComputedStyle === 'function' ? getComputedStyle(nativePath).strokeWidth : '')
  );
  const markerStart = nativePath.getAttribute('marker-start');
  const markerEnd = nativePath.getAttribute('marker-end');
  return {
    ...DEFAULT_CONNECTION_APPEARANCE,
    direction: markerStart && markerEnd ? 'both' : markerEnd ? 'forward' : 'none',
    lineStyle:
      nativePath.hasAttribute('stroke-dasharray') ||
      (typeof getComputedStyle === 'function' &&
        getComputedStyle(nativePath).strokeDasharray !== 'none')
        ? 'dashed'
        : 'solid',
    stroke: readableStroke(nativePath) ?? DEFAULT_CONNECTION_APPEARANCE.stroke,
    strokeWidth: Number.isFinite(width) ? Math.min(Math.max(width, 1), 8) : 2
  };
};

const endpointLaneKey = (endpoint: VisualConnectionEndpoint): string =>
  endpoint.elementId && endpoint.anchor
    ? `element:${endpoint.elementId}:${endpoint.anchor}`
    : `point:${Math.round(endpoint.x * 10) / 10}:${Math.round(endpoint.y * 10) / 10}`;

export const connectionLaneOffsets = (
  connections: readonly VisualConnection[]
): Readonly<Record<string, number>> => {
  const groups = new Map<string, VisualConnection[]>();
  for (const connection of connections) {
    const endpointKeys = [
      endpointLaneKey(connection.source),
      endpointLaneKey(connection.target)
    ].sort();
    const key = endpointKeys.join('|');
    const group = groups.get(key) ?? [];
    group.push(connection);
    groups.set(key, group);
  }
  const offsets: Record<string, number> = {};
  for (const group of groups.values()) {
    const ordered = [...group].sort((left, right) => left.id.localeCompare(right.id));
    const center = (ordered.length - 1) / 2;
    ordered.forEach((connection, index) => {
      offsets[connection.id] = (index - center) * PARALLEL_CONNECTION_SPACING;
    });
  }
  return offsets;
};

export const anchorPointsForRect = (elementId: string, rect: RouteRect): VisualAnchorPoint[] => {
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;
  return [
    { anchor: 'top-left', elementId, x: rect.left, y: rect.top },
    { anchor: 'top', elementId, x: centerX, y: rect.top },
    { anchor: 'top-right', elementId, x: rect.right, y: rect.top },
    { anchor: 'right', elementId, x: rect.right, y: centerY },
    { anchor: 'bottom-right', elementId, x: rect.right, y: rect.bottom },
    { anchor: 'bottom', elementId, x: centerX, y: rect.bottom },
    { anchor: 'bottom-left', elementId, x: rect.left, y: rect.bottom },
    { anchor: 'left', elementId, x: rect.left, y: centerY }
  ];
};

export const findConnectionSnapCandidate = (
  point: VisualPosition,
  anchors: readonly VisualAnchorPoint[],
  threshold: number,
  current?: Pick<VisualAnchorPoint, 'anchor' | 'elementId'>
): ConnectionSnapCandidate | undefined => {
  const candidates = anchors
    .map((anchor) => ({ ...anchor, distance: Math.hypot(point.x - anchor.x, point.y - anchor.y) }))
    .sort((left, right) => left.distance - right.distance);
  const nearest = candidates.find(({ distance }) => distance <= threshold);
  if (!current) return nearest;
  const retained = candidates.find(
    ({ anchor, elementId, distance }) =>
      anchor === current.anchor && elementId === current.elementId && distance <= threshold * 1.35
  );
  if (!retained) return nearest;
  if (
    nearest &&
    (nearest.anchor !== retained.anchor || nearest.elementId !== retained.elementId) &&
    nearest.distance + threshold * 0.25 < retained.distance
  ) {
    return nearest;
  }
  return retained;
};

const connectionLayer = (svg: SVGSVGElement): SVGGElement =>
  svg.querySelector<SVGGElement>('.svg-pan-zoom_viewport') ??
  svg.querySelector<SVGGElement>(':scope > g') ??
  svg;

const relativeMatrix = (
  element: SVGGraphicsElement,
  parent: SVGGraphicsElement
): DOMMatrix | undefined => {
  const elementMatrix = element.getCTM();
  const parentMatrix = parent.getCTM();
  if (!elementMatrix || !parentMatrix) return undefined;
  return parentMatrix.inverse().multiply(elementMatrix);
};

const elementRect = (element: Element, layer: SVGGElement): RouteRect | undefined => {
  if (!(element instanceof SVGGraphicsElement)) return undefined;
  try {
    const box = element.getBBox();
    const matrix = relativeMatrix(element, layer);
    if (!matrix) return undefined;
    const corners = [
      new DOMPoint(box.x, box.y),
      new DOMPoint(box.x + box.width, box.y),
      new DOMPoint(box.x + box.width, box.y + box.height),
      new DOMPoint(box.x, box.y + box.height)
    ].map((point) => point.matrixTransform(matrix));
    return {
      bottom: Math.max(...corners.map(({ y }) => y)),
      left: Math.min(...corners.map(({ x }) => x)),
      right: Math.max(...corners.map(({ x }) => x)),
      top: Math.min(...corners.map(({ y }) => y))
    };
  } catch {
    return undefined;
  }
};

export const isStableConnectableItem = (item: VisualDocumentItem): boolean =>
  (item.kind === 'node' || item.kind === 'container') &&
  Boolean(item.id) &&
  !/^(?:visual|text|foreignObject|line|path)-\d+$/i.test(item.id);

export const collectVisualAnchors = (
  svg: SVGSVGElement,
  items: readonly VisualDocumentItem[]
): VisualAnchorPoint[] => {
  const layer = connectionLayer(svg);
  return items.flatMap((item) => {
    if (!isStableConnectableItem(item) || !item.element.isConnected) return [];
    const rect = elementRect(item.element, layer);
    return rect ? anchorPointsForRect(item.id, rect) : [];
  });
};

const anchorForEndpoint = (
  endpoint: VisualConnectionEndpoint,
  anchors: readonly VisualAnchorPoint[]
): VisualPosition => {
  if (!endpoint.elementId || !endpoint.anchor) return { x: endpoint.x, y: endpoint.y };
  return (
    anchors.find(
      ({ anchor, elementId }) => anchor === endpoint.anchor && elementId === endpoint.elementId
    ) ?? endpoint
  );
};

const createSvgElement = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, tag);

const ensureMarkers = (svg: SVGSVGElement): void => {
  if (svg.querySelector('defs[data-visual-connection-defs]')) return;
  const defs = createSvgElement('defs');
  defs.dataset.visualConnectionDefs = 'true';
  for (const [id, orient] of [
    ['visual-connection-arrow-end', 'auto'],
    ['visual-connection-arrow-start', 'auto-start-reverse']
  ] as const) {
    const marker = createSvgElement('marker');
    marker.id = id;
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('markerWidth', '8');
    marker.setAttribute('orient', orient);
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '4');
    marker.setAttribute('viewBox', '0 0 8 8');
    const arrow = createSvgElement('path');
    arrow.setAttribute('d', 'M0,0 L8,4 L0,8 Z');
    arrow.setAttribute('fill', 'context-stroke');
    marker.append(arrow);
    defs.append(marker);
  }
  svg.prepend(defs);
};

const connectionRoute = (
  connection: VisualConnection,
  anchors: readonly VisualAnchorPoint[],
  obstacles: readonly VisualObstacle[],
  laneOffset = 0
) => {
  const source = anchorForEndpoint(connection.source, anchors);
  const target = anchorForEndpoint(connection.target, anchors);
  return routeOrthogonalEdge(
    source,
    target,
    obstacles.filter(
      ({ elementId }) =>
        elementId !== connection.source.elementId && elementId !== connection.target.elementId
    ),
    { laneOffset, margin: 18, padding: 8 }
  );
};

const renderConnectionGroup = (
  connection: VisualConnection,
  anchors: readonly VisualAnchorPoint[],
  obstacles: readonly VisualObstacle[],
  selected: boolean,
  laneOffset = 0
): SVGGElement => {
  const route = connectionRoute(connection, anchors, obstacles, laneOffset);
  const group = createSvgElement('g');
  group.classList.add('edgePath', 'visual-connection');
  if (selected) group.classList.add('visual-element-selected', 'visual-element-primary');
  group.dataset.styleId = connection.id;
  group.dataset.visualConnection = 'true';
  group.dataset.visualId = connection.id;
  group.dataset.visualKind = 'edge';
  group.setAttribute('aria-label', connection.label || '箭头');

  const hit = createSvgElement('path');
  hit.dataset.connectionHit = 'true';
  hit.setAttribute('d', routeToPathData(route));
  hit.setAttribute('fill', 'none');
  hit.setAttribute('stroke', 'transparent');
  hit.setAttribute('stroke-width', '16');
  hit.setAttribute('vector-effect', 'non-scaling-stroke');
  hit.style.cursor = 'pointer';
  hit.style.pointerEvents = 'stroke';

  const path = createSvgElement('path');
  path.dataset.connectionPath = 'true';
  path.setAttribute('d', routeToPathData(route));
  path.setAttribute('fill', 'none');
  path.setAttribute(
    'stroke',
    connection.stroke ?? DEFAULT_CONNECTION_APPEARANCE.stroke ?? '#ea580c'
  );
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-width', `${connection.strokeWidth}`);
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  if (connection.lineStyle === 'dashed') path.setAttribute('stroke-dasharray', '8 6');
  if (connection.direction === 'forward' || connection.direction === 'both') {
    path.setAttribute('marker-end', 'url(#visual-connection-arrow-end)');
  }
  if (connection.direction === 'both') {
    path.setAttribute('marker-start', 'url(#visual-connection-arrow-start)');
  }
  group.append(hit, path);

  if (connection.label) {
    const labelPoint = pointAlongRoute(route);
    const label = createSvgElement('text');
    label.dataset.connectionLabel = 'true';
    label.setAttribute('aria-label', connection.label);
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('paint-order', 'stroke');
    label.setAttribute(
      'stroke',
      connection.labelBackground ?? DEFAULT_CONNECTION_APPEARANCE.labelBackground ?? '#fff7ed'
    );
    label.setAttribute('stroke-width', '5');
    label.setAttribute(
      'fill',
      connection.labelColor ?? DEFAULT_CONNECTION_APPEARANCE.labelColor ?? '#431407'
    );
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('x', `${labelPoint.x}`);
    label.setAttribute('y', `${labelPoint.y}`);
    label.dataset.labelBaseX = `${labelPoint.x}`;
    label.dataset.labelBaseY = `${labelPoint.y}`;
    label.style.cursor = 'text';
    label.style.pointerEvents = 'all';
    label.textContent = connection.label;
    group.append(label);
  }

  for (const [role, endpoint] of [
    ['source', anchorForEndpoint(connection.source, anchors)],
    ['target', anchorForEndpoint(connection.target, anchors)]
  ] as const) {
    const handleHit = createSvgElement('circle');
    handleHit.dataset.connectionEndpointHit = role;
    handleHit.dataset.connectionHandle = 'true';
    handleHit.setAttribute('cx', `${endpoint.x}`);
    handleHit.setAttribute('cy', `${endpoint.y}`);
    handleHit.setAttribute('r', '8');
    handleHit.setAttribute('vector-effect', 'non-scaling-stroke');
    handleHit.style.cursor = 'crosshair';
    handleHit.style.fill = 'transparent';
    handleHit.style.pointerEvents = 'all';
    handleHit.style.stroke = 'transparent';
    handleHit.style.strokeWidth = '24px';
    const handle = createSvgElement('circle');
    handle.dataset.connectionEndpoint = role;
    handle.dataset.connectionHandle = 'true';
    handle.setAttribute('cx', `${endpoint.x}`);
    handle.setAttribute('cy', `${endpoint.y}`);
    handle.setAttribute('r', '6');
    handle.setAttribute('vector-effect', 'non-scaling-stroke');
    group.append(handleHit, handle);
  }
  return group;
};

interface ClientRectBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const labelOffsets: readonly VisualPosition[] = [
  { x: 0, y: 0 },
  { x: 0, y: -18 },
  { x: 0, y: 18 },
  { x: -24, y: 0 },
  { x: 24, y: 0 },
  { x: 0, y: -36 },
  { x: 0, y: 36 },
  { x: -24, y: -18 },
  { x: 24, y: -18 },
  { x: -24, y: 18 },
  { x: 24, y: 18 }
];

const shiftedBounds = (
  rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>,
  offset: VisualPosition
): ClientRectBounds => ({
  bottom: rect.bottom + offset.y,
  left: rect.left + offset.x,
  right: rect.right + offset.x,
  top: rect.top + offset.y
});

const labelBoundsOverlap = (left: ClientRectBounds, right: ClientRectBounds): boolean => {
  const gap = 4;
  return (
    left.left < right.right + gap &&
    left.right + gap > right.left &&
    left.top < right.bottom + gap &&
    left.bottom + gap > right.top
  );
};

const labelOverlapArea = (
  candidate: ClientRectBounds,
  placed: readonly ClientRectBounds[]
): number =>
  placed.reduce((total, other) => {
    const width = Math.max(
      0,
      Math.min(candidate.right, other.right) - Math.max(candidate.left, other.left)
    );
    const height = Math.max(
      0,
      Math.min(candidate.bottom, other.bottom) - Math.max(candidate.top, other.top)
    );
    return total + width * height;
  }, 0);

const applyClientLabelOffset = (
  layer: SVGGElement,
  label: SVGTextElement,
  base: VisualPosition,
  offset: VisualPosition
): void => {
  const matrix = layer.getScreenCTM();
  if (!matrix || (offset.x === 0 && offset.y === 0)) {
    label.setAttribute('x', `${base.x}`);
    label.setAttribute('y', `${base.y}`);
    return;
  }
  const screen = new DOMPoint(base.x, base.y).matrixTransform(matrix);
  const adjusted = new DOMPoint(screen.x + offset.x, screen.y + offset.y).matrixTransform(
    matrix.inverse()
  );
  label.setAttribute('x', `${adjusted.x}`);
  label.setAttribute('y', `${adjusted.y}`);
};

const resolveConnectionLabelCollisions = (
  layer: SVGGElement,
  changedIds?: ReadonlySet<string>
): void => {
  const labels = [...layer.querySelectorAll<SVGTextElement>('[data-connection-label]')];
  if (labels.length < 2) return;
  const shouldPlace = (label: SVGTextElement): boolean => {
    if (!changedIds) return true;
    const id = label.closest<SVGGElement>('[data-visual-connection]')?.dataset.visualId ?? '';
    return changedIds.has(id);
  };
  const moving = labels.filter(shouldPlace);
  const placed: ClientRectBounds[] = labels
    .filter((label) => !shouldPlace(label))
    .map((label) => label.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => shiftedBounds(rect, { x: 0, y: 0 }));

  for (const label of moving) {
    const base = {
      x: Number(label.dataset.labelBaseX),
      y: Number(label.dataset.labelBaseY)
    };
    if (!Number.isFinite(base.x) || !Number.isFinite(base.y)) continue;
    applyClientLabelOffset(layer, label, base, { x: 0, y: 0 });
    const rect = label.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const options = labelOffsets.map((offset) => ({
      bounds: shiftedBounds(rect, offset),
      offset
    }));
    const chosen =
      options.find(({ bounds }) => placed.every((other) => !labelBoundsOverlap(bounds, other))) ??
      options.reduce((best, option) =>
        labelOverlapArea(option.bounds, placed) < labelOverlapArea(best.bounds, placed)
          ? option
          : best
      );
    applyClientLabelOffset(layer, label, base, chosen.offset);
    placed.push(chosen.bounds);
  }
};

const renderAnchorLayer = (
  anchors: readonly VisualAnchorPoint[],
  activeEndpoint: VisualConnectionEndpoint | undefined
): SVGGElement => {
  const layer = createSvgElement('g');
  layer.dataset.visualConnectionAnchors = 'true';
  for (const anchor of anchors) {
    const point = createSvgElement('circle');
    point.dataset.connectionAnchor = anchor.anchor;
    point.dataset.connectionAnchorElement = anchor.elementId;
    point.setAttribute('cx', `${anchor.x}`);
    point.setAttribute('cy', `${anchor.y}`);
    point.setAttribute(
      'r',
      activeEndpoint?.elementId === anchor.elementId && activeEndpoint.anchor === anchor.anchor
        ? '6'
        : '4'
    );
    point.setAttribute('vector-effect', 'non-scaling-stroke');
    if (activeEndpoint?.elementId === anchor.elementId && activeEndpoint.anchor === anchor.anchor) {
      point.classList.add('visual-connection-anchor-active');
    }
    layer.append(point);
  }
  return layer;
};

export const collectVisualConnectionGeometry = (
  svg: SVGSVGElement,
  items: readonly VisualDocumentItem[]
): VisualConnectionGeometry => {
  const viewport = connectionLayer(svg);
  const anchors = collectVisualAnchors(svg, items);
  const screenMatrix = viewport.getScreenCTM();
  const screenAnchors = screenMatrix
    ? anchors.map((anchor) => {
        const screen = new DOMPoint(anchor.x, anchor.y).matrixTransform(screenMatrix);
        return { ...anchor, x: screen.x, y: screen.y };
      })
    : [];
  const obstacles = items.flatMap((item) => {
    if (!isStableConnectableItem(item) || !item.element.isConnected) return [];
    const rect = elementRect(item.element, viewport);
    return rect ? [{ ...rect, elementId: item.id }] : [];
  });
  return { anchors, obstacles, screenAnchors, viewport };
};

export const renderVisualConnections = (
  svg: SVGSVGElement,
  connections: State['visualConnections'],
  items: readonly VisualDocumentItem[],
  {
    activeEndpoint,
    overrides = {},
    selectedIds = new Set<string>(),
    showAnchors = false
  }: VisualConnectionRenderOptions = {}
): void => {
  ensureMarkers(svg);
  const { anchors, obstacles, viewport } = collectVisualConnectionGeometry(svg, items);
  viewport.querySelector(':scope > g[data-visual-connection-layer]')?.remove();
  const layer = createSvgElement('g');
  layer.dataset.visualConnectionLayer = 'true';
  const merged = { ...(connections ?? {}), ...overrides };
  const laneOffsets = connectionLaneOffsets(Object.values(merged));
  const orderedConnections = Object.values(merged).sort(
    (left, right) => Number(selectedIds.has(left.id)) - Number(selectedIds.has(right.id))
  );
  for (const connection of orderedConnections) {
    layer.append(
      renderConnectionGroup(
        connection,
        anchors,
        obstacles,
        selectedIds.has(connection.id),
        laneOffsets[connection.id]
      )
    );
  }
  if (showAnchors) layer.append(renderAnchorLayer(anchors, activeEndpoint));
  const elementLayer = viewport.querySelector(':scope > g[data-visual-element-layer]');
  if (elementLayer) viewport.insertBefore(layer, elementLayer);
  else viewport.append(layer);
  resolveConnectionLabelCollisions(layer);
};

export const renderVisualConnectionFrame = (
  svg: SVGSVGElement,
  connection: VisualConnection,
  items: readonly VisualDocumentItem[],
  {
    activeEndpoint,
    baseConnections,
    geometry,
    laneOffset,
    selectedIds = new Set<string>(),
    showAnchors = false
  }: Pick<
    VisualConnectionRenderOptions,
    'activeEndpoint' | 'baseConnections' | 'geometry' | 'laneOffset' | 'selectedIds' | 'showAnchors'
  > = {}
): void => {
  ensureMarkers(svg);
  const { anchors, obstacles, viewport } = geometry ?? collectVisualConnectionGeometry(svg, items);
  const layer = viewport.querySelector<SVGGElement>(':scope > g[data-visual-connection-layer]');
  if (!layer) {
    renderVisualConnections(svg, baseConnections, items, {
      activeEndpoint,
      overrides: { [connection.id]: connection },
      selectedIds,
      showAnchors
    });
    return;
  }
  const current = layer.querySelector<SVGGElement>(
    `:scope > g[data-visual-id="${CSS.escape(connection.id)}"]`
  );
  const replacement = renderConnectionGroup(
    connection,
    anchors,
    obstacles,
    selectedIds.has(connection.id),
    laneOffset
  );
  if (current) current.replaceWith(replacement);
  else layer.prepend(replacement);
  if (selectedIds.has(connection.id)) layer.append(replacement);
  resolveConnectionLabelCollisions(layer, new Set([connection.id]));
  layer.querySelector(':scope > g[data-visual-connection-anchors]')?.remove();
  if (showAnchors) layer.append(renderAnchorLayer(anchors, activeEndpoint));
};

export const refreshVisualConnectionsForElements = (
  svg: SVGSVGElement,
  connections: State['visualConnections'],
  items: readonly VisualDocumentItem[],
  elementIds: ReadonlySet<string>
): void => {
  if (!connections || elementIds.size === 0) return;
  const viewport = connectionLayer(svg);
  const layer = viewport.querySelector<SVGGElement>(':scope > g[data-visual-connection-layer]');
  if (!layer) {
    renderVisualConnections(svg, connections, items);
    return;
  }
  const { anchors, obstacles } = collectVisualConnectionGeometry(svg, items);
  const laneOffsets = connectionLaneOffsets(Object.values(connections));
  const refreshedIds = new Set<string>();
  for (const connection of Object.values(connections)) {
    if (
      !elementIds.has(connection.source.elementId ?? '') &&
      !elementIds.has(connection.target.elementId ?? '')
    ) {
      continue;
    }
    const current = layer.querySelector<SVGGElement>(
      `:scope > g[data-visual-id="${CSS.escape(connection.id)}"]`
    );
    const replacement = renderConnectionGroup(
      connection,
      anchors,
      obstacles,
      Boolean(current?.classList.contains('visual-element-selected')),
      laneOffsets[connection.id]
    );
    if (current) current.replaceWith(replacement);
    else layer.prepend(replacement);
    if (replacement.classList.contains('visual-element-selected')) layer.append(replacement);
    refreshedIds.add(connection.id);
  }
  resolveConnectionLabelCollisions(layer, refreshedIds);
};

export const clientToConnectionPoint = (
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): VisualPosition | undefined => {
  const viewport = connectionLayer(svg);
  const matrix = viewport.getScreenCTM();
  if (!matrix) return undefined;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
};

export const endpointAtClientPoint = (
  svg: SVGSVGElement,
  items: readonly VisualDocumentItem[],
  clientX: number,
  clientY: number,
  thresholdPx = CONNECTION_SNAP_PX,
  current?: Pick<VisualAnchorPoint, 'anchor' | 'elementId'>,
  geometry?: VisualConnectionGeometry
): VisualConnectionEndpoint | undefined => {
  const point = clientToConnectionPoint(svg, clientX, clientY);
  if (!point) return undefined;
  const { anchors, screenAnchors } = geometry ?? collectVisualConnectionGeometry(svg, items);
  if (screenAnchors.length === 0) return point;
  const candidate = findConnectionSnapCandidate(
    { x: clientX, y: clientY },
    screenAnchors,
    thresholdPx,
    current
  );
  if (!candidate) return point;
  const anchor = anchors.find(
    ({ anchor, elementId }) => anchor === candidate.anchor && elementId === candidate.elementId
  );
  return anchor
    ? { anchor: anchor.anchor, elementId: anchor.elementId, x: anchor.x, y: anchor.y }
    : point;
};

export const reverseVisualConnection = (connection: VisualConnection): VisualConnection => ({
  ...connection,
  source: { ...connection.target },
  target: { ...connection.source }
});
