import { clearVisualSelection } from './visualSelection.svelte';
import type { InvestorSample, SampleExample } from './diagramCatalog';
import { loadDiagramCode, loadDiagramTemplate } from './state.svelte';
import { logEvent } from './stats';

export const loadCatalogDiagram = (diagramType: string, example: SampleExample): void => {
  clearVisualSelection();
  loadDiagramCode(example.code);
  logEvent('loadSampleDiagram', { diagramType, exampleTitle: example.title });
};

export const loadCatalogShowcase = (example: InvestorSample): void => {
  clearVisualSelection();
  loadDiagramTemplate(example.state);
  logEvent('loadSampleDiagram', {
    diagramType: example.diagramType,
    exampleTitle: example.title
  });
};
