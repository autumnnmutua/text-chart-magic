import type {
  VisualElementKind,
  VisualLayoutKind,
  VisualSelectionItem
} from './visualSelection.svelte';

export interface VisualDocumentItem extends VisualSelectionItem {
  canAlign: boolean;
  canDelete: boolean;
  canHide: boolean;
  canReorder: boolean;
  element: Element;
  kind: VisualElementKind;
  layoutKind?: VisualLayoutKind;
}

export interface VisualFocusRequest {
  id: number;
  occurrence?: number;
  text?: string;
  visualId?: string;
}

export interface VisualEditRequest {
  id: number;
  visualId: string;
}

let items = $state.raw<VisualDocumentItem[]>([]);
let focusRequest = $state<VisualFocusRequest | undefined>();
let editRequest = $state<VisualEditRequest | undefined>();
let focusRequestId = 0;
let editRequestId = 0;

export const visualDocument = {
  get current(): VisualDocumentItem[] {
    return items;
  },
  get editRequest(): VisualEditRequest | undefined {
    return editRequest;
  },
  get focusRequest(): VisualFocusRequest | undefined {
    return focusRequest;
  }
};

export const setVisualDocument = (next: readonly VisualDocumentItem[]): void => {
  items = [...next];
};

export const clearVisualDocument = (): void => {
  items = [];
};

export const getVisualDocumentItem = (id: string): VisualDocumentItem | undefined =>
  items.find((item) => item.id === id);

export const getVisualDocumentBounds = (id: string): DOMRect | undefined => {
  const element = getVisualDocumentItem(id)?.element;
  if (!element?.isConnected) return undefined;
  return element.getBoundingClientRect();
};

export const requestVisualFocus = (request: Omit<VisualFocusRequest, 'id'>): void => {
  focusRequestId += 1;
  focusRequest = { ...request, id: focusRequestId };
};

export const requestVisualEdit = (visualId: string): void => {
  if (!visualId) return;
  editRequestId += 1;
  editRequest = { id: editRequestId, visualId };
};
