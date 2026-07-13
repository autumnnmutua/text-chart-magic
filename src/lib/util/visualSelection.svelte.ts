import type { VisualStyle } from '$/types';

interface VisualSelection {
  id: string;
  label: string;
}

let selected = $state<VisualSelection | undefined>();
let colorPanelOpen = $state(false);

export const visualSelection = {
  get current() {
    return selected;
  },
  get isColorPanelOpen() {
    return colorPanelOpen;
  }
};

export const selectVisualElement = (selection: VisualSelection): void => {
  selected = selection;
};

export const openVisualColorPanel = (): void => {
  if (selected) {
    colorPanelOpen = true;
  }
};

export const closeVisualColorPanel = (): void => {
  colorPanelOpen = false;
};

export const clearVisualSelection = (): void => {
  selected = undefined;
  colorPanelOpen = false;
};

export const defaultVisualStyle: Required<VisualStyle> = {
  alpha: 1,
  fill: '#ffedd5',
  stroke: '#f97316',
  text: '#431407'
};
