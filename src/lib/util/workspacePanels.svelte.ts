export type WorkspacePanel = 'layers' | 'search';

let active = $state<WorkspacePanel | undefined>();

export const workspacePanels = {
  get active(): WorkspacePanel | undefined {
    return active;
  }
};

export const openWorkspacePanel = (panel: WorkspacePanel): void => {
  active = panel;
};

export const closeWorkspacePanel = (): void => {
  active = undefined;
};

export const toggleWorkspacePanel = (panel: WorkspacePanel): void => {
  active = active === panel ? undefined : panel;
};
