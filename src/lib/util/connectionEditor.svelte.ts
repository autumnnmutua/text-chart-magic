import { clearVisualSelection } from './visualSelection.svelte';

export type ConnectionCreationPhase = 'source' | 'target';

let creating = $state(false);
let phase = $state<ConnectionCreationPhase>('source');
let revision = $state(0);

export const connectionEditor = {
  get isCreating(): boolean {
    return creating;
  },
  get phase(): ConnectionCreationPhase {
    return phase;
  },
  get revision(): number {
    return revision;
  }
};

export const startConnectionCreation = (): void => {
  clearVisualSelection();
  creating = true;
  phase = 'source';
  revision += 1;
};

export const setConnectionCreationPhase = (next: ConnectionCreationPhase): void => {
  if (!creating) return;
  phase = next;
};

export const finishConnectionCreation = (): void => {
  creating = false;
  phase = 'source';
  revision += 1;
};

export const cancelConnectionCreation = (): boolean => {
  if (!creating) return false;
  finishConnectionCreation();
  return true;
};
