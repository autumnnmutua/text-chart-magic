import type { DiagramBranchRequest } from './diagramBranch';
import { addDiagramBranch } from './state.svelte';
import { visualDocument, type VisualDocumentItem } from './visualDocument.svelte';

interface BranchFocusBaseline {
  createdAt: number;
  ids: Set<string>;
  label: string;
  labelCounts: Map<string, number>;
  sourceId: string;
}

let pendingFocus: BranchFocusBaseline | undefined;

const normalizeLabel = (label: string): string => label.trim().replace(/\s+/g, ' ').toLowerCase();

const captureFocusBaseline = (
  items: readonly VisualDocumentItem[],
  sourceId: string,
  label: string
): BranchFocusBaseline => {
  const ids = new Set<string>();
  const labelCounts = new Map<string, number>();
  for (const item of items) {
    if (item.kind === 'edge') continue;
    ids.add(item.id);
    const label = normalizeLabel(item.label);
    if (label) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  return { createdAt: Date.now(), ids, label, labelCounts, sourceId };
};

export const addFocusedDiagramBranch = ({
  label = '',
  mode = 'branch',
  sourceId = ''
}: {
  label?: string;
  mode?: NonNullable<DiagramBranchRequest['mode']>;
  sourceId?: string;
}): boolean => {
  pendingFocus = captureFocusBaseline(visualDocument.current, sourceId, label);
  const didAdd = addDiagramBranch({ label, mode, sourceId });
  if (!didAdd) pendingFocus = undefined;
  return didAdd;
};

export const takeAddedBranchFocusTarget = (
  items: readonly VisualDocumentItem[]
): VisualDocumentItem | undefined => {
  const baseline = pendingFocus;
  if (!baseline) return undefined;
  if (Date.now() - baseline.createdAt > 10_000) {
    pendingFocus = undefined;
    return undefined;
  }

  const currentLabelCounts = new Map<string, number>();
  const addedByLabel = items.filter(({ kind, label }) => {
    if (kind === 'edge') return false;
    const normalizedLabel = normalizeLabel(label);
    if (!normalizedLabel) return false;
    const occurrence = (currentLabelCounts.get(normalizedLabel) ?? 0) + 1;
    currentLabelCounts.set(normalizedLabel, occurrence);
    return occurrence > (baseline.labelCounts.get(normalizedLabel) ?? 0);
  });
  const addedById = items.filter(({ id, kind }) => kind !== 'edge' && !baseline.ids.has(id));
  const addedTarget =
    addedByLabel.find(({ kind }) => kind === 'node') ??
    addedByLabel.find(({ kind }) => kind === 'text') ??
    addedByLabel[0];
  const ownerTarget =
    items.find(
      ({ kind, sourceId }) =>
        kind !== 'edge' && Boolean(baseline.sourceId) && sourceId === baseline.sourceId
    ) ??
    items.find(
      ({ kind, label }) =>
        kind !== 'edge' &&
        Boolean(baseline.label) &&
        normalizeLabel(label) === normalizeLabel(baseline.label)
    );
  const addedIdTarget =
    addedById.find(({ kind }) => kind === 'node') ??
    addedById.find(({ kind }) => kind === 'text') ??
    addedById[0];
  const target = addedTarget ?? ownerTarget ?? addedIdTarget;
  if (target) pendingFocus = undefined;
  return target;
};

export const clearPendingBranchFocus = (): void => {
  pendingFocus = undefined;
};
