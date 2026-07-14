<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    deleteVisualConnections,
    updateVisualConnection,
    validatedState
  } from '$lib/util/state.svelte';
  import { reverseVisualConnection } from '$lib/util/visualConnections';
  import {
    clearVisualSelection,
    openVisualColorPanel,
    visualSelection
  } from '$lib/util/visualSelection.svelte';
  import { ArrowLeftRight, ArrowRight, Minus, Palette, Plus, Repeat2, Trash2 } from 'lucide-svelte';

  const connection = $derived(
    visualSelection.current
      ? validatedState.current.visualConnections?.[visualSelection.current.id]
      : undefined
  );
  let labelDraft = $state('');
  let activeId = '';
  let activeLabel = '';

  $effect(() => {
    if (!connection) {
      activeId = '';
      activeLabel = '';
      labelDraft = '';
      return;
    }
    if (connection.id === activeId && connection.label === activeLabel) return;
    activeId = connection.id;
    activeLabel = connection.label;
    labelDraft = connection.label;
  });

  const commitLabel = (): void => {
    if (!connection || labelDraft === connection.label) return;
    updateVisualConnection({ ...connection, label: labelDraft.trim().slice(0, 240) });
  };

  const remove = (): void => {
    if (!connection) return;
    if (deleteVisualConnections([connection.id]) > 0) clearVisualSelection();
  };
</script>

{#if connection}
  <div
    class="connection-toolbar pointer-events-auto absolute top-2 right-2 z-40 flex max-w-[min(92vw,680px)] flex-wrap items-center gap-1 rounded-md border border-border-dark bg-card p-1 shadow-xl max-sm:left-2 max-sm:max-w-none"
    data-testid="connection-toolbar">
    <input
      class="h-9 min-w-28 flex-1 rounded-sm border border-border bg-background px-2 text-sm outline-none focus:border-accent max-sm:h-11 max-sm:min-w-full max-sm:text-base"
      aria-label="箭头文字"
      bind:value={labelDraft}
      onblur={commitLabel}
      onkeydown={(event) => {
        if (event.isComposing) return;
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          labelDraft = connection.label;
          event.currentTarget.blur();
        }
      }} />
    <Button
      size="icon"
      variant={connection.direction === 'none' ? 'accent' : 'ghost'}
      title="普通连线"
      aria-label="普通连线"
      onclick={() => updateVisualConnection({ ...connection, direction: 'none' })}>
      <Minus class="size-4" />
    </Button>
    <Button
      size="icon"
      variant={connection.direction === 'forward' ? 'accent' : 'ghost'}
      title="单向箭头"
      aria-label="单向箭头"
      onclick={() => updateVisualConnection({ ...connection, direction: 'forward' })}>
      <ArrowRight class="size-4" />
    </Button>
    <Button
      size="icon"
      variant={connection.direction === 'both' ? 'accent' : 'ghost'}
      title="双向箭头"
      aria-label="双向箭头"
      onclick={() => updateVisualConnection({ ...connection, direction: 'both' })}>
      <ArrowLeftRight class="size-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      title="交换起点和终点"
      aria-label="交换起点和终点"
      onclick={() => updateVisualConnection(reverseVisualConnection(connection))}>
      <Repeat2 class="size-4" />
    </Button>
    <Button
      class="min-w-14 px-2"
      variant={connection.lineStyle === 'dashed' ? 'accent' : 'ghost'}
      title="切换实线或虚线"
      onclick={() =>
        updateVisualConnection({
          ...connection,
          lineStyle: connection.lineStyle === 'dashed' ? 'solid' : 'dashed'
        })}>
      {connection.lineStyle === 'dashed' ? '虚线' : '实线'}
    </Button>
    <Button
      size="icon"
      variant="ghost"
      title="减小线宽"
      aria-label="减小线宽"
      disabled={connection.strokeWidth <= 1}
      onclick={() =>
        updateVisualConnection({ ...connection, strokeWidth: connection.strokeWidth - 1 })}>
      <Minus class="size-4" />
    </Button>
    <span class="min-w-7 text-center text-xs tabular-nums">{connection.strokeWidth}px</span>
    <Button
      size="icon"
      variant="ghost"
      title="增大线宽"
      aria-label="增大线宽"
      disabled={connection.strokeWidth >= 8}
      onclick={() =>
        updateVisualConnection({ ...connection, strokeWidth: connection.strokeWidth + 1 })}>
      <Plus class="size-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      title="箭头调色"
      aria-label="箭头调色"
      onclick={openVisualColorPanel}>
      <Palette class="size-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      class="hover:text-destructive"
      title="删除箭头"
      aria-label="删除箭头"
      onclick={remove}>
      <Trash2 class="size-4" />
    </Button>
  </div>
{/if}

<style>
  @media (pointer: coarse) {
    .connection-toolbar :global(button) {
      min-width: 44px;
      min-height: 44px;
    }
  }
</style>
