import { SvelteMap } from 'svelte/reactivity';

export type CommandCategory = '编辑' | '对齐' | '图层' | '搜索' | '视图';

export interface WorkspaceCommand {
  category: CommandCategory;
  disabledReason?: () => string | undefined;
  id: string;
  isEnabled?: () => boolean;
  keywords?: string[];
  label: string;
  run: () => void;
  shortcut?: string;
}

let commands = $state.raw<WorkspaceCommand[]>([]);
let paletteOpen = $state(false);
const ownerRegistrations = new SvelteMap<string, number>();
let registrationId = 0;

export const commandRegistry = {
  get current(): WorkspaceCommand[] {
    return commands;
  },
  get isPaletteOpen(): boolean {
    return paletteOpen;
  }
};

export const registerWorkspaceCommands = (
  owner: string,
  next: readonly WorkspaceCommand[]
): (() => void) => {
  const ownerPrefix = `${owner}:`;
  registrationId += 1;
  const currentRegistration = registrationId;
  ownerRegistrations.set(owner, currentRegistration);
  commands = [
    ...commands.filter((command) => !command.id.startsWith(ownerPrefix)),
    ...next.map((command) => ({ ...command, id: `${ownerPrefix}${command.id}` }))
  ];
  return () => {
    if (ownerRegistrations.get(owner) !== currentRegistration) return;
    ownerRegistrations.delete(owner);
    commands = commands.filter((command) => !command.id.startsWith(ownerPrefix));
  };
};

export const executeWorkspaceCommand = (id: string): boolean => {
  const command = commands.find((item) => item.id === id);
  if (!command || command.isEnabled?.() === false) return false;
  command.run();
  return true;
};

export const openCommandPalette = (): void => {
  paletteOpen = true;
};

export const closeCommandPalette = (): void => {
  paletteOpen = false;
};
