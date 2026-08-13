import type { State, VisualElement, VisualElementShape, VisualPosition } from '$lib/types';

export const VISUAL_ELEMENT_PREFIX = 'element-';
// Stored dimensions use the diagram coordinate system. Screen-size limits are
// converted at interaction time because Mermaid diagrams can start at very
// different fit-to-view scales.
export const VISUAL_ELEMENT_MIN_WIDTH = 1;
export const VISUAL_ELEMENT_MIN_HEIGHT = 1;
export const VISUAL_ELEMENT_MIN_SCREEN_WIDTH = 64;
export const VISUAL_ELEMENT_MIN_SCREEN_HEIGHT = 52;
const VISUAL_ELEMENT_MAX_SIZE = 100_000;
const MAX_VISUAL_ELEMENTS = 5_000;
export const visualShapeOptions: readonly {
  kind: VisualElement['kind'];
  label: string;
  shape: VisualElementShape;
}[] = [
  { kind: 'shape', label: '矩形', shape: 'rectangle' },
  { kind: 'shape', label: '圆角矩形', shape: 'rounded' },
  { kind: 'shape', label: '菱形', shape: 'diamond' },
  { kind: 'shape', label: '圆形', shape: 'circle' },
  { kind: 'shape', label: '椭圆', shape: 'ellipse' },
  { kind: 'shape', label: '圆柱', shape: 'cylinder' },
  { kind: 'icon', label: '人物', shape: 'person' },
  { kind: 'icon', label: '服务器', shape: 'server' },
  { kind: 'icon', label: '数据库', shape: 'cylinder' },
  { kind: 'icon', label: '文档', shape: 'document' },
  { kind: 'icon', label: '云服务', shape: 'cloud' }
];

const SVG_NS = 'http://www.w3.org/2000/svg';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const supportedShapes = new Set<VisualElementShape>(visualShapeOptions.map(({ shape }) => shape));

export const normalizeVisualElements = (value: unknown): State['visualElements'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const elements: NonNullable<State['visualElements']> = {};
  for (const [key, raw] of Object.entries(value).slice(0, MAX_VISUAL_ELEMENTS)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const candidate = raw as Record<string, unknown>;
    const id =
      typeof candidate.id === 'string' && candidate.id.startsWith(VISUAL_ELEMENT_PREFIX)
        ? candidate.id
        : key.startsWith(VISUAL_ELEMENT_PREFIX)
          ? key
          : '';
    if (
      !id ||
      !finite(candidate.x) ||
      !finite(candidate.y) ||
      !finite(candidate.width) ||
      !finite(candidate.height) ||
      typeof candidate.shape !== 'string' ||
      !supportedShapes.has(candidate.shape as VisualElementShape)
    ) {
      continue;
    }
    const kind = candidate.kind === 'icon' ? 'icon' : 'shape';
    const rawLabel = typeof candidate.label === 'string' ? candidate.label : undefined;
    const label = rawLabel?.trim().slice(0, 240) ?? '';
    if (elements[id]) continue;
    elements[id] = {
      height: clamp(candidate.height, VISUAL_ELEMENT_MIN_HEIGHT, VISUAL_ELEMENT_MAX_SIZE),
      id,
      kind,
      label: rawLabel === undefined ? (kind === 'icon' ? '未命名图标' : '未命名模块') : label,
      ...(typeof candidate.parentId === 'string' && candidate.parentId
        ? { parentId: candidate.parentId }
        : {}),
      shape: candidate.shape as VisualElementShape,
      width: clamp(candidate.width, VISUAL_ELEMENT_MIN_WIDTH, VISUAL_ELEMENT_MAX_SIZE),
      x: candidate.x,
      y: candidate.y
    };
  }
  for (const [id, element] of Object.entries(elements)) {
    let parentId = element.parentId;
    const visited = new Set([id]);
    while (parentId && elements[parentId]) {
      if (visited.has(parentId)) {
        delete element.parentId;
        break;
      }
      visited.add(parentId);
      parentId = elements[parentId]?.parentId;
    }
  }
  return Object.keys(elements).length > 0 ? elements : undefined;
};

export const collectVisualElementSubtreeIds = (
  elements: State['visualElements'],
  rootIds: readonly string[]
): string[] => {
  if (!elements) return [];
  const childrenByParent = new Map<string, string[]>();
  for (const [id, element] of Object.entries(elements)) {
    if (!element.parentId) continue;
    const children = childrenByParent.get(element.parentId) ?? [];
    children.push(id);
    childrenByParent.set(element.parentId, children);
  }
  const collected = new Set(rootIds.filter((id) => Boolean(elements[id])));
  const queue = [...collected];
  for (const parentId of queue) {
    for (const childId of childrenByParent.get(parentId) ?? []) {
      if (collected.has(childId)) continue;
      collected.add(childId);
      queue.push(childId);
    }
  }
  return [...collected];
};

export const createVisualElementId = (): string => {
  const suffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${VISUAL_ELEMENT_PREFIX}${suffix}`;
};

export const createVisualElement = ({
  kind = 'shape',
  label,
  parentId,
  position,
  shape,
  size
}: {
  kind?: VisualElement['kind'];
  label?: string;
  parentId?: string;
  position: VisualPosition;
  shape: VisualElementShape;
  size?: Partial<Pick<VisualElement, 'height' | 'width'>>;
}): VisualElement => {
  const icon = kind === 'icon';
  const width = size?.width ?? (icon ? 104 : shape === 'circle' ? 92 : 132);
  const height = size?.height ?? (icon ? 112 : shape === 'circle' ? 92 : 76);
  const id = createVisualElementId();
  return {
    height,
    id,
    kind,
    label: label?.trim() || (icon ? '新图标' : '新模块'),
    ...(parentId ? { parentId } : {}),
    shape,
    width,
    x: position.x,
    y: position.y
  };
};

const createSvgElement = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, tag);

export const getVisualElementLayer = (svg: SVGSVGElement): SVGGElement =>
  svg.querySelector<SVGGElement>('.svg-pan-zoom_viewport') ??
  svg.querySelector<SVGGElement>(':scope > g') ??
  svg;

export const visualElementScreenScale = (svg: SVGSVGElement): { x: number; y: number } => {
  const layer = getVisualElementLayer(svg);
  const matrix = typeof layer.getScreenCTM === 'function' ? layer.getScreenCTM() : null;
  return {
    x: Math.max(matrix ? Math.hypot(matrix.a, matrix.b) : 1, 0.001),
    y: Math.max(matrix ? Math.hypot(matrix.c, matrix.d) : 1, 0.001)
  };
};

export const visualElementSizeFromScreen = (
  svg: SVGSVGElement,
  width: number,
  height: number
): { height: number; width: number } => {
  const scale = visualElementScreenScale(svg);
  return { height: height / scale.y, width: width / scale.x };
};

const setShapeStyle = (element: SVGElement): void => {
  element.setAttribute('fill', '#ffedd5');
  element.setAttribute('stroke', '#f97316');
  element.setAttribute('stroke-width', '2');
  element.setAttribute('vector-effect', 'non-scaling-stroke');
};

const appendMainShape = (group: SVGGElement, element: VisualElement): void => {
  const { height, shape, width } = element;
  if (shape === 'diamond') {
    const polygon = createSvgElement('polygon');
    polygon.setAttribute(
      'points',
      `${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`
    );
    setShapeStyle(polygon);
    group.append(polygon);
    return;
  }
  if (shape === 'circle' || shape === 'ellipse') {
    const ellipse = createSvgElement('ellipse');
    ellipse.setAttribute('cx', `${width / 2}`);
    ellipse.setAttribute('cy', `${height / 2}`);
    ellipse.setAttribute('rx', `${shape === 'circle' ? Math.min(width, height) / 2 : width / 2}`);
    ellipse.setAttribute('ry', `${shape === 'circle' ? Math.min(width, height) / 2 : height / 2}`);
    setShapeStyle(ellipse);
    group.append(ellipse);
    return;
  }
  if (shape === 'cylinder') {
    const body = createSvgElement('path');
    const cap = Math.min(14, height / 5);
    body.setAttribute(
      'd',
      `M0 ${cap} C0 0 ${width} 0 ${width} ${cap} V${height - cap} C${width} ${height} 0 ${height} 0 ${height - cap} Z`
    );
    setShapeStyle(body);
    const top = createSvgElement('ellipse');
    top.setAttribute('cx', `${width / 2}`);
    top.setAttribute('cy', `${cap}`);
    top.setAttribute('rx', `${width / 2}`);
    top.setAttribute('ry', `${cap}`);
    top.setAttribute('fill', 'none');
    top.setAttribute('stroke', '#f97316');
    top.setAttribute('stroke-width', '2');
    top.setAttribute('vector-effect', 'non-scaling-stroke');
    group.append(body, top);
    return;
  }
  if (shape === 'person') {
    const head = createSvgElement('circle');
    const radius = Math.min(width, height) * 0.16;
    head.setAttribute('cx', `${width / 2}`);
    head.setAttribute('cy', `${radius + 4}`);
    head.setAttribute('r', `${radius}`);
    setShapeStyle(head);
    const body = createSvgElement('path');
    body.setAttribute(
      'd',
      `M${width * 0.18} ${height * 0.72} C${width * 0.2} ${height * 0.42} ${width * 0.8} ${height * 0.42} ${width * 0.82} ${height * 0.72} L${width * 0.82} ${height * 0.82} L${width * 0.18} ${height * 0.82} Z`
    );
    setShapeStyle(body);
    group.append(head, body);
    return;
  }
  if (shape === 'document') {
    const path = createSvgElement('path');
    const fold = Math.min(width, height) * 0.24;
    path.setAttribute(
      'd',
      `M0 0 H${width - fold} L${width} ${fold} V${height} H0 Z M${width - fold} 0 V${fold} H${width}`
    );
    setShapeStyle(path);
    group.append(path);
    return;
  }
  if (shape === 'cloud') {
    const path = createSvgElement('path');
    path.setAttribute(
      'd',
      `M${width * 0.2} ${height * 0.78} C${width * 0.02} ${height * 0.78} ${width * 0.02} ${height * 0.48} ${width * 0.22} ${height * 0.46} C${width * 0.26} ${height * 0.16} ${width * 0.66} ${height * 0.12} ${width * 0.76} ${height * 0.4} C${width * 0.98} ${height * 0.42} ${width} ${height * 0.76} ${width * 0.78} ${height * 0.78} Z`
    );
    setShapeStyle(path);
    group.append(path);
    return;
  }

  const rect = createSvgElement('rect');
  rect.setAttribute('width', `${width}`);
  rect.setAttribute('height', `${height}`);
  rect.setAttribute('rx', shape === 'rounded' || shape === 'server' ? '10' : '2');
  setShapeStyle(rect);
  group.append(rect);
  if (shape === 'server') {
    for (const ratio of [0.3, 0.52, 0.74]) {
      const line = createSvgElement('line');
      line.setAttribute('x1', `${width * 0.16}`);
      line.setAttribute('x2', `${width * 0.84}`);
      line.setAttribute('y1', `${height * ratio}`);
      line.setAttribute('y2', `${height * ratio}`);
      line.setAttribute('stroke', '#f97316');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      group.append(line);
    }
  }
};

const appendResizeHandles = (
  group: SVGGElement,
  element: VisualElement,
  scale: { x: number; y: number }
): void => {
  const handleRadius =
    (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 9 : 6) /
    Math.max(Math.min(scale.x, scale.y), 0.001);
  const points: [string, number, number][] = [
    ['top-left', 0, 0],
    ['top', element.width / 2, 0],
    ['top-right', element.width, 0],
    ['right', element.width, element.height / 2],
    ['bottom-right', element.width, element.height],
    ['bottom', element.width / 2, element.height],
    ['bottom-left', 0, element.height],
    ['left', 0, element.height / 2]
  ];
  for (const [handle, x, y] of points) {
    const circle = createSvgElement('circle');
    circle.dataset.visualElementResize = handle;
    circle.setAttribute('cx', `${x}`);
    circle.setAttribute('cy', `${y}`);
    circle.setAttribute('r', `${handleRadius}`);
    circle.setAttribute('fill', '#fff7ed');
    circle.setAttribute('stroke', '#ea580c');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('vector-effect', 'non-scaling-stroke');
    circle.style.pointerEvents = 'all';
    group.append(circle);
  }
};

const renderVisualElement = (
  element: VisualElement,
  position: VisualPosition,
  selected: boolean,
  scale: { x: number; y: number }
): SVGGElement => {
  const group = createSvgElement('g');
  group.dataset.freeLayout = 'true';
  group.dataset.styleId = element.id;
  group.dataset.visualElement = 'true';
  group.dataset.visualId = element.id;
  group.dataset.visualKind = 'node';
  if (selected) group.classList.add('visual-element-selected');
  group.setAttribute('aria-label', element.label || '图形元素');
  group.setAttribute('transform', `translate(${element.x + position.x} ${element.y + position.y})`);
  group.style.cursor = 'move';
  group.style.pointerEvents = 'all';
  group.style.touchAction = 'none';
  group.style.userSelect = 'none';

  const hit = createSvgElement('rect');
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const hitPadding = coarsePointer ? 10 / Math.max(Math.min(scale.x, scale.y), 0.001) : 0;
  hit.dataset.visualElementHit = 'true';
  hit.setAttribute('x', `${-hitPadding}`);
  hit.setAttribute('y', `${-hitPadding}`);
  hit.setAttribute('width', `${element.width + hitPadding * 2}`);
  hit.setAttribute('height', `${element.height + hitPadding * 2}`);
  hit.setAttribute('fill', 'transparent');
  hit.style.pointerEvents = 'all';
  hit.style.touchAction = 'none';
  group.append(hit);
  appendMainShape(group, element);

  const label = createSvgElement('text');
  const length = Math.max([...element.label].length, 1);
  const screenWidth = element.width * scale.x;
  const fontSize = clamp(screenWidth / Math.max(length * 0.72, 7), 11, 15) / scale.y;
  label.dataset.visualElementLabel = 'true';
  label.setAttribute('dominant-baseline', 'central');
  label.setAttribute('fill', '#431407');
  label.setAttribute('font-size', `${fontSize}`);
  label.setAttribute('font-weight', '600');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('x', `${element.width / 2}`);
  label.setAttribute('y', `${element.height / 2}`);
  label.style.pointerEvents = 'none';
  label.textContent = element.label;
  group.append(label);
  // Keep handles mounted so the first selection can reveal them without rebuilding the SVG node.
  appendResizeHandles(group, element, scale);
  return group;
};

export const renderVisualElements = (
  svg: SVGSVGElement,
  elements: State['visualElements'],
  positions: State['visualPositions'],
  selectedIds: ReadonlySet<string> = new Set()
): void => {
  const viewport = getVisualElementLayer(svg);
  const scale = visualElementScreenScale(svg);
  viewport.querySelector(':scope > g[data-visual-element-layer]')?.remove();
  if (!elements) return;
  const layer = createSvgElement('g');
  layer.dataset.visualElementLayer = 'true';
  for (const element of Object.values(elements)) {
    layer.append(
      renderVisualElement(
        element,
        positions?.[element.id] ?? { x: 0, y: 0 },
        selectedIds.has(element.id),
        scale
      )
    );
  }
  const connectionLayer = viewport.querySelector(':scope > g[data-visual-connection-layer]');
  if (connectionLayer) connectionLayer.after(layer);
  else viewport.append(layer);
};

export const applyVisualElementPositions = (
  svg: SVGSVGElement,
  elements: State['visualElements'],
  positions: State['visualPositions']
): void => {
  for (const element of Object.values(elements ?? {})) {
    const group = svg.querySelector<SVGGElement>(
      `[data-visual-element][data-visual-id="${CSS.escape(element.id)}"]`
    );
    if (!group) continue;
    const position = positions?.[element.id] ?? { x: 0, y: 0 };
    group.setAttribute(
      'transform',
      `translate(${element.x + position.x} ${element.y + position.y})`
    );
  }
};

export const updateRenderedVisualElement = (
  group: SVGGElement,
  element: VisualElement,
  position: VisualPosition = { x: 0, y: 0 },
  selected = true
): SVGGElement => {
  const svg = group.ownerSVGElement;
  const replacement = renderVisualElement(
    element,
    position,
    selected,
    svg ? visualElementScreenScale(svg) : { x: 1, y: 1 }
  );
  group.replaceWith(replacement);
  return replacement;
};

export const getVisualElementId = (target: EventTarget | null): string =>
  target instanceof Element
    ? (target.closest<SVGGElement>('[data-visual-element]')?.dataset.visualId ?? '')
    : '';
