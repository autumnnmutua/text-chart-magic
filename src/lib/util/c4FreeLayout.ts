import type { VisualPosition } from './blockFreeLayout';

interface C4Element {
  id: string;
  label: string;
}

interface C4Relation {
  source: string;
  target: string;
}

const normalize = (value = '') => value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();

const parseC4Elements = (code: string): C4Element[] =>
  [
    ...code.matchAll(/^\s*(?!BiRel|Rel|Rel_)[A-Za-z][\w]*\(\s*([A-Za-z][\w-]*)\s*,\s*"([^"]+)"/gm)
  ].map((match) => ({ id: match[1], label: normalize(match[2]) }));

const parseC4Relations = (code: string): C4Relation[] =>
  [...code.matchAll(/^\s*(?:BiRel|Rel|Rel_[A-Za-z]+)\(\s*([^,]+)\s*,\s*([^,]+)/gim)].map(
    (match) => ({ source: match[1].trim(), target: match[2].trim() })
  );

const getGroups = (svg: SVGSVGElement, code: string): Map<string, SVGGElement> => {
  const groups = [...svg.querySelectorAll<SVGGElement>('g.person-man')];
  const available = new Set(groups);
  const result = new Map<string, SVGGElement>();
  for (const element of parseC4Elements(code)) {
    const group = [...available].find((item) =>
      normalize(item.textContent ?? '').includes(element.label)
    );
    if (!group) continue;
    available.delete(group);
    group.dataset.c4Id = element.id;
    result.set(element.id, group);
  }
  return result;
};

const getGeometry = (group: SVGGElement) => {
  const box = group.getBBox();
  const x = Number(group.dataset.offsetX ?? 0);
  const y = Number(group.dataset.offsetY ?? 0);
  return {
    height: box.height,
    width: box.width,
    x: box.x + box.width / 2 + x,
    y: box.y + box.height / 2 + y
  };
};

const boundaryPoint = (
  from: ReturnType<typeof getGeometry>,
  to: ReturnType<typeof getGeometry>
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) / Math.max(from.width, 1) >= Math.abs(dy) / Math.max(from.height, 1)) {
    return { x: from.x + (Math.sign(dx || 1) * from.width) / 2, y: from.y };
  }
  return { x: from.x, y: from.y + (Math.sign(dy || 1) * from.height) / 2 };
};

export const updateC4Relations = (svg: SVGSVGElement, code: string): void => {
  const groups = getGroups(svg, code);
  const relationGroups = [...svg.querySelectorAll<SVGGElement>('g')].filter((group) =>
    group.querySelector(':scope > line[marker-end]')
  );
  parseC4Relations(code).forEach((relation, index) => {
    const source = groups.get(relation.source);
    const target = groups.get(relation.target);
    const relationGroup = relationGroups[index];
    const line = relationGroup?.querySelector<SVGLineElement>(':scope > line[marker-end]');
    if (!source || !target || !line) return;
    const start = boundaryPoint(getGeometry(source), getGeometry(target));
    const end = boundaryPoint(getGeometry(target), getGeometry(source));
    line.setAttribute('x1', `${start.x}`);
    line.setAttribute('y1', `${start.y}`);
    line.setAttribute('x2', `${end.x}`);
    line.setAttribute('y2', `${end.y}`);
    const text = relationGroup.querySelector<SVGTextElement>(':scope > text');
    if (text) {
      text.setAttribute('x', `${(start.x + end.x) / 2}`);
      text.setAttribute('y', `${(start.y + end.y) / 2}`);
    }
  });
};

export const applyC4Positions = (
  svg: SVGSVGElement,
  code: string,
  positions: Record<string, VisualPosition> = {}
): void => {
  for (const [id, group] of getGroups(svg, code)) {
    const position = positions[id] ?? { x: 0, y: 0 };
    group.dataset.offsetX = `${position.x}`;
    group.dataset.offsetY = `${position.y}`;
    group.setAttribute('transform', `translate(${position.x}, ${position.y})`);
    group.style.cursor = 'grab';
    group.style.touchAction = 'none';
  }
  updateC4Relations(svg, code);
};

export const getC4NodeId = (target: EventTarget | null): string =>
  target instanceof Element
    ? (target.closest<SVGGElement>('g[data-c4-id]')?.dataset.c4Id ?? '')
    : '';

export const moveC4Node = (
  svg: SVGSVGElement,
  code: string,
  id: string,
  position: VisualPosition
): boolean => {
  const group = getGroups(svg, code).get(id);
  if (!group) return false;
  group.dataset.offsetX = `${position.x}`;
  group.dataset.offsetY = `${position.y}`;
  group.setAttribute('transform', `translate(${position.x}, ${position.y})`);
  group.style.cursor = 'grabbing';
  updateC4Relations(svg, code);
  return true;
};
