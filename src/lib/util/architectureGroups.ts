import type { VisualPosition } from '$lib/types';

export const ARCHITECTURE_GROUP_PREFIX = 'architecture-group-';
const SVG_NS = 'http://www.w3.org/2000/svg';
const metadataPattern = /^\s*%%\s*architecture-group\s+(\{.*\})\s*$/gm;

export interface ArchitectureGroup {
  auto?: boolean;
  height: number;
  id: string;
  label: string;
  memberIds: string[];
  moveMembers: boolean;
  width: number;
  x: number;
  y: number;
}

export type ArchitectureResizeHandle =
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right'
  | 'top'
  | 'top-left'
  | 'top-right';

const finite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const normalizeGroup = (value: unknown): ArchitectureGroup | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const id =
    typeof candidate.id === 'string' && candidate.id.startsWith(ARCHITECTURE_GROUP_PREFIX)
      ? candidate.id
      : '';
  if (!id) return undefined;
  return {
    auto: candidate.auto === true,
    height: clamp(finite(candidate.height, 180), 96, 5_000),
    id,
    label:
      typeof candidate.label === 'string' && candidate.label.trim()
        ? candidate.label.trim().slice(0, 80)
        : '新分组',
    memberIds: Array.isArray(candidate.memberIds)
      ? candidate.memberIds
          .filter((item): item is string => typeof item === 'string' && Boolean(item))
          .filter((item, index, values) => values.indexOf(item) === index)
          .slice(0, 500)
      : [],
    moveMembers: candidate.moveMembers !== false,
    width: clamp(finite(candidate.width, 320), 160, 5_000),
    x: clamp(finite(candidate.x, 40), -10_000, 10_000),
    y: clamp(finite(candidate.y, 40), -10_000, 10_000)
  };
};

export const parseArchitectureGroups = (code: string): ArchitectureGroup[] =>
  [...code.matchAll(metadataPattern)].flatMap((match) => {
    try {
      const group = normalizeGroup(JSON.parse(match[1]));
      return group ? [group] : [];
    } catch {
      return [];
    }
  });

const serializeGroup = (group: ArchitectureGroup): string =>
  `%% architecture-group ${JSON.stringify(group)}`;

export const upsertArchitectureGroupCode = (code: string, group: ArchitectureGroup): string => {
  const normalized = normalizeGroup(group);
  if (!normalized) return code;
  let replaced = false;
  const next = code.replace(metadataPattern, (line, json: string) => {
    try {
      const current = normalizeGroup(JSON.parse(json));
      if (current?.id !== normalized.id) return line;
      replaced = true;
      return serializeGroup(normalized);
    } catch {
      return line;
    }
  });
  return replaced ? next : `${next.trimEnd()}\n${serializeGroup(normalized)}\n`;
};

export const removeArchitectureGroupCode = (code: string, id: string): string =>
  `${code
    .split('\n')
    .filter((line) => {
      const match = line.match(/^\s*%%\s*architecture-group\s+(\{.*\})\s*$/);
      if (!match) return true;
      try {
        return normalizeGroup(JSON.parse(match[1]))?.id !== id;
      } catch {
        return true;
      }
    })
    .join('\n')
    .trimEnd()}\n`;

export const createArchitectureGroup = (code: string): ArchitectureGroup => {
  const ids = new Set(parseArchitectureGroups(code).map(({ id }) => id));
  let index = 1;
  while (ids.has(`${ARCHITECTURE_GROUP_PREFIX}${index}`)) index += 1;
  return {
    auto: false,
    height: 180,
    id: `${ARCHITECTURE_GROUP_PREFIX}${index}`,
    label: `新分组${index > 1 ? ` ${index}` : ''}`,
    memberIds: [],
    moveMembers: true,
    width: 320,
    x: 48 + (index - 1) * 24,
    y: 48 + (index - 1) * 24
  };
};

export const resizeArchitectureGroup = (
  group: ArchitectureGroup,
  handle: ArchitectureResizeHandle,
  delta: VisualPosition
): ArchitectureGroup => {
  const minimumWidth = 160;
  const minimumHeight = 96;
  let { height, width, x, y } = group;
  if (handle.includes('right')) width = Math.max(minimumWidth, group.width + delta.x);
  if (handle.includes('bottom')) height = Math.max(minimumHeight, group.height + delta.y);
  if (handle.includes('left')) {
    width = Math.max(minimumWidth, group.width - delta.x);
    x = group.x + (group.width - width);
  }
  if (handle.includes('top')) {
    height = Math.max(minimumHeight, group.height - delta.y);
    y = group.y + (group.height - height);
  }
  return { ...group, auto: false, height, width, x, y };
};

const createSvgElement = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
  document.createElementNS(SVG_NS, tag);

const viewportOf = (svg: SVGSVGElement): SVGGElement =>
  svg.querySelector<SVGGElement>('.svg-pan-zoom_viewport') ??
  svg.querySelector<SVGGElement>(':scope > g') ??
  svg;

const relativeRect = (element: SVGGraphicsElement, viewport: SVGGraphicsElement) => {
  const elementMatrix = element.getCTM();
  const viewportMatrix = viewport.getCTM();
  if (!elementMatrix || !viewportMatrix) return undefined;
  const matrix = viewportMatrix.inverse().multiply(elementMatrix);
  const box = element.getBBox();
  const corners = [
    new DOMPoint(box.x, box.y),
    new DOMPoint(box.x + box.width, box.y),
    new DOMPoint(box.x + box.width, box.y + box.height),
    new DOMPoint(box.x, box.y + box.height)
  ].map((point) => point.matrixTransform(matrix));
  const left = Math.min(...corners.map(({ x }) => x));
  const right = Math.max(...corners.map(({ x }) => x));
  const top = Math.min(...corners.map(({ y }) => y));
  const bottom = Math.max(...corners.map(({ y }) => y));
  return { height: bottom - top, width: right - left, x: left, y: top };
};

const resolvedGroup = (
  svg: SVGSVGElement,
  viewport: SVGGElement,
  group: ArchitectureGroup
): ArchitectureGroup => {
  if (!group.auto || group.memberIds.length === 0) return group;
  const boxes = group.memberIds.flatMap((id) => {
    const element = svg.querySelector<SVGGElement>(`g[data-architecture-id="${CSS.escape(id)}"]`);
    const rect = element ? relativeRect(element, viewport) : undefined;
    return rect ? [rect] : [];
  });
  if (boxes.length === 0) return { ...group, auto: false };
  const left = Math.min(...boxes.map(({ x }) => x)) - 36;
  const top = Math.min(...boxes.map(({ y }) => y)) - 48;
  const right = Math.max(...boxes.map(({ width, x }) => x + width)) + 36;
  const bottom = Math.max(...boxes.map(({ height, y }) => y + height)) + 32;
  return { ...group, height: bottom - top, width: right - left, x: left, y: top };
};

const handlePoints = (group: ArchitectureGroup) => {
  const centerX = group.x + group.width / 2;
  const centerY = group.y + group.height / 2;
  return [
    ['top-left', group.x, group.y],
    ['top', centerX, group.y],
    ['top-right', group.x + group.width, group.y],
    ['right', group.x + group.width, centerY],
    ['bottom-right', group.x + group.width, group.y + group.height],
    ['bottom', centerX, group.y + group.height],
    ['bottom-left', group.x, group.y + group.height],
    ['left', group.x, centerY]
  ] as const;
};

export const updateRenderedArchitectureGroup = (
  element: SVGGElement,
  group: ArchitectureGroup
): void => {
  element.dataset.groupX = `${group.x}`;
  element.dataset.groupY = `${group.y}`;
  element.dataset.groupWidth = `${group.width}`;
  element.dataset.groupHeight = `${group.height}`;
  for (const rect of element.querySelectorAll<SVGRectElement>(
    '[data-architecture-group-border], [data-architecture-group-hit]'
  )) {
    rect.setAttribute('x', `${group.x}`);
    rect.setAttribute('y', `${group.y}`);
    rect.setAttribute('width', `${group.width}`);
    rect.setAttribute('height', `${group.height}`);
  }
  const title = element.querySelector<SVGTextElement>('[data-architecture-group-title]');
  title?.setAttribute('x', `${group.x + 14}`);
  title?.setAttribute('y', `${group.y + 24}`);
  if (title) title.textContent = group.label;
  for (const [handle, x, y] of handlePoints(group)) {
    const point = element.querySelector<SVGCircleElement>(
      `[data-architecture-group-resize="${handle}"]`
    );
    point?.setAttribute('cx', `${x}`);
    point?.setAttribute('cy', `${y}`);
  }
};

const appendResizeHandles = (element: SVGGElement, group: ArchitectureGroup): void => {
  for (const [handle] of handlePoints(group)) {
    const point = createSvgElement('circle');
    point.dataset.architectureGroupResize = handle;
    point.setAttribute('fill', '#ffffff');
    point.setAttribute('r', '6');
    point.setAttribute('stroke', '#f97316');
    point.setAttribute('stroke-width', '2');
    point.setAttribute('vector-effect', 'non-scaling-stroke');
    point.style.cursor = `${handle}-resize`;
    point.style.pointerEvents = 'all';
    element.append(point);
  }
};

export const updateArchitectureGroupSelection = (
  svg: SVGSVGElement,
  code: string,
  selectedIds: ReadonlySet<string>
): void => {
  const groups = new Map(parseArchitectureGroups(code).map((group) => [group.id, group]));
  for (const element of svg.querySelectorAll<SVGGElement>('[data-architecture-group-id]')) {
    const source = groups.get(element.dataset.architectureGroupId ?? '');
    if (!source) continue;
    const selected = selectedIds.has(source.id);
    element.classList.toggle('visual-element-selected', selected);
    element.classList.toggle('visual-element-primary', selected);
    element
      .querySelectorAll('[data-architecture-group-resize]')
      .forEach((handle) => handle.remove());
    const group = architectureGroupResolvedRect(element, source);
    if (selected) appendResizeHandles(element, group);
    updateRenderedArchitectureGroup(element, group);
  }
};

export const renderArchitectureGroups = (
  svg: SVGSVGElement,
  code: string,
  selectedIds: ReadonlySet<string> = new Set()
): void => {
  const viewport = viewportOf(svg);
  viewport.querySelector(':scope > g[data-architecture-group-layer]')?.remove();
  const groups = parseArchitectureGroups(code);
  if (groups.length === 0) return;
  const layer = createSvgElement('g');
  layer.dataset.architectureGroupLayer = 'true';
  for (const sourceGroup of groups) {
    const group = resolvedGroup(svg, viewport, sourceGroup);
    const element = createSvgElement('g');
    element.dataset.architectureGroupId = group.id;
    element.dataset.styleId = group.id;
    element.dataset.visualId = group.id;
    element.dataset.visualKind = 'container';
    element.style.pointerEvents = 'none';
    const hit = createSvgElement('rect');
    hit.dataset.architectureGroupHit = 'true';
    hit.setAttribute('fill', 'none');
    hit.setAttribute('stroke', 'transparent');
    hit.setAttribute('stroke-width', '14');
    hit.setAttribute('vector-effect', 'non-scaling-stroke');
    hit.style.cursor = 'move';
    hit.style.pointerEvents = 'stroke';
    const border = createSvgElement('rect');
    border.dataset.architectureGroupBorder = 'true';
    border.setAttribute('fill', 'rgba(255,255,255,0.04)');
    border.setAttribute('rx', '6');
    border.setAttribute('stroke', '#64748b');
    border.setAttribute('stroke-dasharray', '8 6');
    border.setAttribute('stroke-width', '2');
    border.setAttribute('vector-effect', 'non-scaling-stroke');
    border.style.cursor = 'move';
    border.style.pointerEvents = 'stroke';
    const title = createSvgElement('text');
    title.dataset.architectureGroupTitle = 'true';
    title.setAttribute('fill', '#334155');
    title.setAttribute('font-size', '14');
    title.setAttribute('font-weight', '600');
    title.style.cursor = 'move';
    title.style.pointerEvents = 'all';
    element.append(hit, border, title);
    if (selectedIds.has(group.id)) {
      element.classList.add('visual-element-selected', 'visual-element-primary');
      appendResizeHandles(element, group);
    }
    updateRenderedArchitectureGroup(element, group);
    layer.append(element);
  }
  viewport.prepend(layer);
};

export const architectureGroupAtElement = (
  target: EventTarget | null,
  code: string
): ArchitectureGroup | undefined => {
  if (!(target instanceof Element)) return undefined;
  const element = target.closest<SVGGElement>('[data-architecture-group-id]');
  const id = element?.dataset.architectureGroupId;
  return id ? parseArchitectureGroups(code).find((group) => group.id === id) : undefined;
};

export const architectureGroupElement = (svg: SVGSVGElement, id: string): SVGGElement | undefined =>
  svg.querySelector<SVGGElement>(`g[data-architecture-group-id="${CSS.escape(id)}"]`) ?? undefined;

export const architectureGroupResolvedRect = (
  element: SVGGElement,
  fallback: ArchitectureGroup
): ArchitectureGroup => ({
  ...fallback,
  height: finite(Number(element.dataset.groupHeight), fallback.height),
  width: finite(Number(element.dataset.groupWidth), fallback.width),
  x: finite(Number(element.dataset.groupX), fallback.x),
  y: finite(Number(element.dataset.groupY), fallback.y)
});

export const reconcileArchitectureGroupMembership = (
  svg: SVGSVGElement,
  groups: readonly ArchitectureGroup[],
  movedIds: readonly string[]
): ArchitectureGroup[] => {
  const groupRects = groups.flatMap((group) => {
    const element = architectureGroupElement(svg, group.id);
    const border = element?.querySelector<SVGRectElement>('[data-architecture-group-border]');
    if (!border) return [];
    const rect = border.getBoundingClientRect();
    return [{ area: rect.width * rect.height, group, rect }];
  });
  const assignments = new Map<string, string>();
  for (const id of movedIds) {
    const node = svg.querySelector<SVGGElement>(`g[data-architecture-id="${CSS.escape(id)}"]`);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    const center = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
    const owner = groupRects
      .filter(
        ({ rect: groupRect }) =>
          center.x >= groupRect.left &&
          center.x <= groupRect.right &&
          center.y >= groupRect.top &&
          center.y <= groupRect.bottom
      )
      .sort((left, right) => left.area - right.area)[0];
    if (owner) assignments.set(id, owner.group.id);
  }
  return groups.map((group) => ({
    ...group,
    memberIds: [
      ...group.memberIds.filter((id) => !movedIds.includes(id)),
      ...movedIds.filter((id) => assignments.get(id) === group.id)
    ]
  }));
};
