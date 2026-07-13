import type { VisualStyle } from '$/types';

export type VisualElementKind = 'container' | 'edge' | 'node' | 'text';
export type VisualLayoutKind = 'architecture' | 'block' | 'c4';

export interface VisualSelectionItem {
  canDelete?: boolean;
  canHide?: boolean;
  canReorder?: boolean;
  id: string;
  kind?: VisualElementKind;
  label: string;
  layoutKind?: VisualLayoutKind;
  occurrence?: number;
  parentId?: string;
  sourceId?: string;
  styleId?: string;
}

let selected = $state<VisualSelectionItem[]>([]);
let colorPanelOpen = $state(false);
let selectionMode = $state(false);

export const visualSelection = {
  get count(): number {
    return selected.length;
  },
  get current(): VisualSelectionItem | undefined {
    return selected.at(-1);
  },
  get ids(): string[] {
    return selected.map(({ id }) => id);
  },
  get isColorPanelOpen(): boolean {
    return colorPanelOpen;
  },
  get isMultiple(): boolean {
    return selected.length > 1;
  },
  get isSelectionMode(): boolean {
    return selectionMode;
  },
  get items(): VisualSelectionItem[] {
    return selected;
  }
};

export const selectVisualElement = (
  selection: VisualSelectionItem,
  { additive = false, toggle = false }: { additive?: boolean; toggle?: boolean } = {}
): void => {
  const existing = selected.findIndex(({ id }) => id === selection.id);
  if (toggle && existing >= 0) {
    selected = selected.filter(({ id }) => id !== selection.id);
  } else if (additive || toggle) {
    selected = [...selected.filter(({ id }) => id !== selection.id), { ...selection }];
  } else {
    selected = [{ ...selection }];
  }
  if (selected.length === 0) colorPanelOpen = false;
};

export const setVisualSelection = (items: readonly VisualSelectionItem[]): void => {
  const unique: VisualSelectionItem[] = [];
  for (const item of items) {
    const index = unique.findIndex(({ id }) => id === item.id);
    if (!item.id) continue;
    if (index >= 0) unique[index] = { ...item };
    else unique.push({ ...item });
  }
  selected = unique;
  if (selected.length === 0) colorPanelOpen = false;
};

export const openVisualColorPanel = (): void => {
  if (selected.length > 0) colorPanelOpen = true;
};

export const closeVisualColorPanel = (): void => {
  colorPanelOpen = false;
};

export const setSelectionMode = (enabled: boolean): void => {
  selectionMode = enabled;
};

export const clearVisualSelection = (): void => {
  selected = [];
  colorPanelOpen = false;
};

export const defaultVisualStyle: Required<VisualStyle> = {
  alpha: 1,
  fill: '#ffedd5',
  stroke: '#f97316',
  text: '#431407'
};
