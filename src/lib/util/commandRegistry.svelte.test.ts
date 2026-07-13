import { describe, expect, it, vi } from 'vitest';
import {
  closeCommandPalette,
  commandRegistry,
  executeWorkspaceCommand,
  openCommandPalette,
  registerWorkspaceCommands
} from './commandRegistry.svelte';

describe('workspace command registry', () => {
  it('registers one owner copy, executes enabled commands and cleans up', () => {
    const first = vi.fn();
    const replacement = vi.fn();
    const removeFirst = registerWorkspaceCommands('test-owner', [
      { category: '编辑', id: 'save', label: '保存', run: first }
    ]);
    const removeReplacement = registerWorkspaceCommands('test-owner', [
      { category: '编辑', id: 'save', label: '保存新版本', run: replacement }
    ]);

    expect(commandRegistry.current.filter(({ id }) => id === 'test-owner:save')).toHaveLength(1);
    expect(executeWorkspaceCommand('test-owner:save')).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledOnce();

    removeFirst();
    expect(commandRegistry.current.some(({ id }) => id === 'test-owner:save')).toBe(true);
    removeReplacement();
    expect(commandRegistry.current.some(({ id }) => id.startsWith('test-owner:'))).toBe(false);
  });

  it('does not execute disabled commands and tracks palette state', () => {
    const run = vi.fn();
    const unregister = registerWorkspaceCommands('disabled-owner', [
      { category: '编辑', id: 'delete', isEnabled: () => false, label: '删除', run }
    ]);

    expect(executeWorkspaceCommand('disabled-owner:delete')).toBe(false);
    expect(run).not.toHaveBeenCalled();
    openCommandPalette();
    expect(commandRegistry.isPaletteOpen).toBe(true);
    closeCommandPalette();
    expect(commandRegistry.isPaletteOpen).toBe(false);
    unregister();
  });
});
