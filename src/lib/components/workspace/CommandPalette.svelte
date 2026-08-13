<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import {
    closeCommandPalette,
    commandRegistry,
    executeWorkspaceCommand,
    type WorkspaceCommand
  } from '$lib/util/commandRegistry.svelte';
  import { notify } from '$lib/util/notify';
  import { Check, Command, Search, X } from 'lucide-svelte';

  let query = $state('');
  let activeIndex = $state(0);
  let input = $state<HTMLInputElement | null>(null);
  let previouslyOpen = false;
  let returnFocusTo: HTMLElement | null = null;

  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const filtered = $derived(
    commandRegistry.current.filter((command) => {
      if (!normalizedQuery) return true;
      return [command.label, command.category, ...(command.keywords ?? [])]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    })
  );

  $effect(() => {
    if (commandRegistry.isPaletteOpen && !previouslyOpen) {
      returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      query = '';
      activeIndex = 0;
      requestAnimationFrame(() => input?.focus());
    }
    if (!commandRegistry.isPaletteOpen && previouslyOpen) {
      const target = returnFocusTo;
      returnFocusTo = null;
      requestAnimationFrame(() => {
        if (target?.isConnected && document.activeElement === document.body) target.focus();
      });
    }
    previouslyOpen = commandRegistry.isPaletteOpen;
  });

  $effect(() => {
    if (activeIndex >= filtered.length) activeIndex = Math.max(filtered.length - 1, 0);
  });

  const execute = (command: WorkspaceCommand): void => {
    if (command.isEnabled?.() === false) return;
    if (!executeWorkspaceCommand(command.id)) return;
    closeCommandPalette();
    notify(`已执行：${command.label}`);
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeCommandPalette();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = filtered.length > 0 ? (activeIndex + 1) % filtered.length : 0;
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = filtered.length > 0 ? (activeIndex - 1 + filtered.length) % filtered.length : 0;
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const command = filtered[activeIndex];
      if (command) execute(command);
    }
  };
</script>

{#if commandRegistry.isPaletteOpen}
  <div
    class="absolute inset-0 z-[100] flex items-end justify-center bg-black/30 p-0 backdrop-blur-[2px] sm:fixed sm:items-start sm:p-6 sm:pt-[max(8vh,1rem)]"
    style="bottom: var(--mobile-keyboard-height, 0px);"
    role="presentation"
    data-testid="command-palette-overlay"
    onclick={(event) => event.target === event.currentTarget && closeCommandPalette()}>
    <div
      class="flex max-h-[min(78vh,680px)] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-border-dark bg-card shadow-2xl max-sm:h-[min(82dvh,var(--mobile-visual-height,82dvh))] max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      tabindex="-1"
      onkeydown={handleKeydown}>
      <header class="flex items-center gap-2 border-b p-3">
        <Search class="size-5 text-muted-foreground" />
        <Input
          bind:ref={input}
          bind:value={query}
          class="h-10 flex-1 border-0 px-1 text-base shadow-none focus-visible:ring-0"
          placeholder="搜索命令，例如：对齐、图层、保存"
          aria-label="搜索命令" />
        <kbd class="hidden rounded border bg-muted px-2 py-1 text-xs sm:block">Esc</kbd>
        <Button
          size="icon"
          variant="ghost"
          title="关闭命令面板"
          aria-label="关闭命令面板"
          onclick={closeCommandPalette}><X class="size-4" /></Button>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto p-2" data-testid="command-list">
        {#if filtered.length === 0}
          <div class="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Command class="size-7" />
            <span>没有匹配的命令</span>
          </div>
        {:else}
          {#each filtered as command, index (command.id)}
            {@const disabled = command.isEnabled?.() === false}
            <button
              type="button"
              class={[
                'flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                index === activeIndex && 'bg-primary',
                disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-muted'
              ]}
              {disabled}
              title={disabled ? command.disabledReason?.() : undefined}
              onmouseenter={() => (activeIndex = index)}
              onclick={() => execute(command)}>
              <span class="w-10 shrink-0 text-xs text-muted-foreground">{command.category}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{command.label}</span>
                {#if disabled && command.disabledReason?.()}
                  <span class="block truncate text-xs text-muted-foreground">
                    {command.disabledReason?.()}
                  </span>
                {/if}
              </span>
              {#if command.shortcut}
                <kbd class="rounded border bg-background px-2 py-1 text-xs whitespace-nowrap">
                  {command.shortcut}
                </kbd>
              {:else if index === activeIndex && !disabled}
                <Check class="size-4 text-accent" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
