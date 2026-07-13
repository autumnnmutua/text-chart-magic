import type { State } from '$/types';
import { getArchitectureNodeId } from './architectureFreeLayout';
import { getBlockNodeId } from './blockFreeLayout';
import { getC4NodeId } from './c4FreeLayout';
import { getDiagramKeyword } from './diagramBranch';
import type { VisualDocumentItem } from './visualDocument.svelte';
import { collectEditableSourceText, normalizeVisibleText } from './visualTextEdit';

const semanticSelector = [
  'g[data-visual-connection]',
  'g[data-c4-id]',
  'g[data-architecture-id]',
  'g.node[data-style-id]',
  'g.cluster[data-style-id]',
  'g.edgePath[data-style-id]',
  'g.edgeLabel[data-style-id]',
  'path[data-edge="true"][data-style-id]',
  'text[data-style-id]',
  'foreignObject[data-style-id]',
  'line[data-style-id]',
  'path[data-style-id][marker-end]',
  'path[data-style-id][class*="messageLine"]'
].join(',');

const fixedSemanticDiagrams = new Set([
  'gantt',
  'gitgraph',
  'journey',
  'packet',
  'radar-beta',
  'sankey-beta',
  'sequence',
  'timeline',
  'xychart-beta'
]);

const parseRenderedSourceId = (id: string): string =>
  id.match(/(?:^|-)flowchart-([A-Za-z][A-Za-z0-9_]*)-\d+$/)?.[1] ||
  id.match(/(?:^|-)classId-(.+)-\d+$/)?.[1] ||
  id.match(/(?:^|-)(?:requirement|element)-([A-Za-z][\w-]*)-\d+$/i)?.[1] ||
  '';

const sourceIdFromNode = (node: Element): string => {
  const nodeId = node.id ?? '';
  const styleId = node.getAttribute('data-style-id') ?? '';
  return (
    (node.getAttribute('data-visual-connection') ? node.getAttribute('data-visual-id') : '') ||
    getC4NodeId(node) ||
    getArchitectureNodeId(node) ||
    parseRenderedSourceId(nodeId) ||
    parseRenderedSourceId(styleId) ||
    getBlockNodeId(node) ||
    styleId ||
    nodeId
  );
};

interface SourceHierarchy {
  containerAliasesByLabel: Map<string, string[]>;
  parentByAlias: Map<string, string>;
}

const addContainerAlias = (hierarchy: SourceHierarchy, alias: string, label: string): void => {
  const key = normalizeVisibleText(label).toLocaleLowerCase();
  if (!key) return;
  hierarchy.containerAliasesByLabel.set(key, [
    ...(hierarchy.containerAliasesByLabel.get(key) ?? []),
    alias
  ]);
};

const buildSourceHierarchy = (code: string, keyword: string): SourceHierarchy => {
  const hierarchy: SourceHierarchy = {
    containerAliasesByLabel: new Map(),
    parentByAlias: new Map()
  };
  const lines = code.split(/\r?\n/);

  if (keyword === 'flowchart' || keyword === 'graph') {
    const stack: string[] = [];
    for (const line of lines) {
      if (/^\s*end\s*$/i.test(line)) {
        stack.pop();
        continue;
      }
      const subgraph = line.match(
        /^\s*subgraph\s+([A-Za-z][\w-]*)(?:\s*\[\s*["']?([^\]"']+)["']?\s*\])?/i
      );
      if (subgraph) {
        const [, alias, label = alias] = subgraph;
        if (stack.at(-1)) hierarchy.parentByAlias.set(alias, stack.at(-1) ?? '');
        addContainerAlias(hierarchy, alias, label);
        stack.push(alias);
        continue;
      }
      const parent = stack.at(-1);
      if (!parent) continue;
      for (const match of line.matchAll(/(?:^|[;\s])([A-Za-z][\w-]*)\s*(?=[[(>{])/g)) {
        hierarchy.parentByAlias.set(match[1], parent);
      }
    }
  } else if (keyword.startsWith('c4')) {
    const stack: string[] = [];
    for (const line of lines) {
      if (/^\s*}/.test(line)) stack.pop();
      const declaration = line.match(/^\s*([A-Za-z][\w]*)\(\s*([A-Za-z][\w-]*)\s*,\s*"([^"]*)"/i);
      if (
        !declaration ||
        /^(?:BiRel|Rel|Rel_[A-Za-z]+|UpdateLayoutConfig)$/i.test(declaration[1])
      ) {
        continue;
      }
      const [, type, alias, label] = declaration;
      if (stack.at(-1)) hierarchy.parentByAlias.set(alias, stack.at(-1) ?? '');
      if (/Boundary$/i.test(type) && /{\s*$/.test(line)) {
        addContainerAlias(hierarchy, alias, label);
        stack.push(alias);
      }
    }
  } else if (keyword === 'architecture-beta') {
    for (const line of lines) {
      const declaration = line.match(/^\s*(group|service|junction)\s+([A-Za-z][\w-]*)/i);
      if (!declaration) continue;
      const [, type, alias] = declaration;
      const parent = line.match(/\s+in\s+([A-Za-z][\w-]*)\s*$/i)?.[1];
      if (parent) hierarchy.parentByAlias.set(alias, parent);
      if (type.toLocaleLowerCase() === 'group') {
        const label = line.match(/\[([^\]]+)\]/)?.[1] ?? alias;
        addContainerAlias(hierarchy, alias, label);
      }
    }
  } else if (keyword === 'requirementdiagram') {
    for (const line of lines) {
      const relation = line.match(/^\s*([\w-]+)\s*-\s*contains\s*->\s*([\w-]+)\s*$/i);
      if (relation) hierarchy.parentByAlias.set(relation[2], relation[1]);
    }
  }
  return hierarchy;
};

const isGeneratedVisualId = (id: string | undefined): boolean =>
  /^(?:visual|text|foreignObject|line|path)-\d+$/i.test(id ?? '');

const applySourceHierarchy = (items: VisualDocumentItem[], hierarchy: SourceHierarchy): void => {
  const itemIdByAlias = new Map<string, string>();
  for (const item of items) {
    if (item.sourceId && !isGeneratedVisualId(item.sourceId)) {
      itemIdByAlias.set(item.sourceId, item.id);
    }
  }
  for (const item of items) {
    if (item.sourceId && !isGeneratedVisualId(item.sourceId)) continue;
    const key = normalizeVisibleText(item.label).toLocaleLowerCase();
    const alias = hierarchy.containerAliasesByLabel
      .get(key)
      ?.find((candidate) => !itemIdByAlias.has(candidate));
    if (!alias) continue;
    item.sourceId = alias;
    item.kind = 'container';
    item.element.setAttribute('data-visual-kind', 'container');
    itemIdByAlias.set(alias, item.id);
  }
  for (const item of items) {
    if (!item.sourceId) continue;
    const parentAlias = hierarchy.parentByAlias.get(item.sourceId);
    const parentId = parentAlias ? itemIdByAlias.get(parentAlias) : undefined;
    if (parentId && parentId !== item.id) item.parentId = parentId;
  }
};

export const getVisualSourceId = (target: EventTarget | null): string => {
  if (!(target instanceof Element)) return '';
  const semanticNode = target.closest<Element>(
    'g[data-c4-id], g[data-architecture-id], g.node, .requirement, .element'
  );
  return sourceIdFromNode(semanticNode ?? target);
};

const labelFromElement = (element: Element): string => {
  const leaves = [
    ...element.querySelectorAll<HTMLElement | SVGElement>(
      ':scope > text, :scope > foreignObject, .nodeLabel, .edgeLabel, .label'
    )
  ];
  const labels = leaves.map((item) => normalizeVisibleText(item.textContent ?? '')).filter(Boolean);
  const preferred = labels.find((label) => !/^<<[^>]+>>$/.test(label)) ?? labels[0];
  return preferred ?? normalizeVisibleText(element.textContent ?? '');
};

const kindFromElement = (element: Element): VisualDocumentItem['kind'] => {
  if (
    element.matches('[data-visual-connection]') ||
    element.matches(
      '.edgePath, .edgeLabel, path[data-edge="true"], line, path[marker-end], path[class*="messageLine"]'
    )
  )
    return 'edge';
  if (element.matches('.cluster')) return 'container';
  if (element.matches('text, foreignObject, .label, .nodeLabel')) return 'text';
  return 'node';
};

const layoutKindFromElement = (
  element: Element,
  keyword: string
): VisualDocumentItem['layoutKind'] => {
  if (getC4NodeId(element)) return 'c4';
  if (getArchitectureNodeId(element)) return 'architecture';
  if (keyword === 'block-beta' && getBlockNodeId(element)) return 'block';
  return undefined;
};

const ensureVisualIdentity = (element: Element, keyword: string, index: number): string => {
  const layoutId =
    getC4NodeId(element) || getArchitectureNodeId(element) || getBlockNodeId(element);
  const styleId = element.getAttribute('data-style-id');
  const id = layoutId || styleId || element.id || `visual-${index}`;
  element.setAttribute('data-visual-id', id);
  if (!styleId) element.setAttribute('data-style-id', id);
  element.setAttribute('data-visual-kind', kindFromElement(element));
  if (layoutKindFromElement(element, keyword)) element.setAttribute('data-free-layout', 'true');
  return id;
};

export const buildVisualDocument = (graph: SVGSVGElement, code: string): VisualDocumentItem[] => {
  const keyword = getDiagramKeyword(code);
  const sourceHierarchy = buildSourceHierarchy(code, keyword);
  const candidates = [...graph.querySelectorAll<Element>(semanticSelector)];
  const candidateSet = new Set(candidates);
  const elements = candidates.filter((element) => {
    let ancestor = element.parentElement;
    while (ancestor) {
      if (candidateSet.has(ancestor)) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
  const seen = new Set<string>();
  const labelOccurrences = new Map<string, number>();
  const sourceTextCounts = new Map<string, number>();
  for (const entry of collectEditableSourceText(code)) {
    const key = normalizeVisibleText(entry.text).toLocaleLowerCase();
    sourceTextCounts.set(key, (sourceTextCounts.get(key) ?? 0) + 1);
  }
  const result: VisualDocumentItem[] = [];

  elements.forEach((element, index) => {
    const id = ensureVisualIdentity(element, keyword, index);
    if (!id || seen.has(id)) return;
    const kind = kindFromElement(element);
    const visibleLabel = labelFromElement(element);
    if (!visibleLabel && kind !== 'edge') return;
    const label = visibleLabel || '连线';
    const occurrence = labelOccurrences.get(label) ?? 0;
    const primitiveText = kind === 'text' && element.matches('text, foreignObject');
    const labelKey = normalizeVisibleText(label).toLocaleLowerCase();
    if (primitiveText && occurrence >= (sourceTextCounts.get(labelKey) ?? 0)) {
      const duplicate = result.find(
        (item) =>
          item.kind === 'text' &&
          normalizeVisibleText(item.label).toLocaleLowerCase() ===
            normalizeVisibleText(label).toLocaleLowerCase()
      );
      if (duplicate) {
        element.setAttribute('data-visual-id', duplicate.id);
        element.setAttribute('data-style-id', duplicate.styleId ?? duplicate.id);
        element.setAttribute('data-visual-kind', duplicate.kind);
      }
      return;
    }
    seen.add(id);
    labelOccurrences.set(label, occurrence + 1);
    const layoutKind = layoutKindFromElement(element, keyword);
    const parent = element.parentElement?.closest<Element>('[data-visual-id]');
    const canDeleteEdge =
      kind === 'edge' &&
      Boolean(
        visibleLabel ||
        element.matches('[data-visual-connection], .edgePath, path[data-edge="true"]')
      );
    result.push({
      canAlign: Boolean(layoutKind),
      canDelete: kind === 'edge' ? canDeleteEdge : Boolean(label),
      canHide: Boolean(layoutKind) || !fixedSemanticDiagrams.has(keyword),
      canReorder: Boolean(layoutKind),
      element,
      id,
      kind,
      label,
      layoutKind,
      occurrence,
      parentId: parent?.getAttribute('data-visual-id') || undefined,
      sourceId: sourceIdFromNode(element) || undefined,
      styleId: element.getAttribute('data-style-id') || undefined
    });
  });
  applySourceHierarchy(result, sourceHierarchy);
  return result;
};

export const getVisualDocumentTarget = (
  target: EventTarget | null,
  items: readonly VisualDocumentItem[]
): VisualDocumentItem | undefined => {
  if (!(target instanceof Element)) return undefined;
  const root = target.closest<Element>('[data-visual-id]');
  const id = root?.getAttribute('data-visual-id');
  return id ? items.find((item) => item.id === id) : undefined;
};

export const applyVisualLayerState = (
  items: readonly VisualDocumentItem[],
  layers: State['visualLayers']
): void => {
  for (const item of items) {
    const layer = layers?.[item.id];
    const element = item.element as HTMLElement | SVGElement;
    element.style.display = layer?.hidden ? 'none' : '';
    element.classList.toggle('visual-element-locked', Boolean(layer?.locked));
    element.setAttribute('aria-disabled', layer?.locked ? 'true' : 'false');
  }

  const reorderable = items.filter((item) => item.canReorder && item.element.parentElement);
  const byParent = new Map<Element, VisualDocumentItem[]>();
  for (const item of reorderable) {
    const parent = item.element.parentElement;
    if (!parent) continue;
    byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
  }
  for (const [parent, siblings] of byParent) {
    siblings
      .sort((left, right) => (layers?.[left.id]?.zIndex ?? 0) - (layers?.[right.id]?.zIndex ?? 0))
      .forEach(({ element }) => parent.append(element));
  }
};

export const applyVisualSelectionState = (
  items: readonly VisualDocumentItem[],
  selectedIds: ReadonlySet<string>,
  primaryId = ''
): void => {
  for (const item of items) {
    item.element.classList.toggle('visual-element-selected', selectedIds.has(item.id));
    item.element.classList.toggle('visual-element-primary', item.id === primaryId);
  }
};
