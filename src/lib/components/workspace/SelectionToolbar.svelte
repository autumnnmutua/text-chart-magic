<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { notify } from '$lib/util/notify';
  import { validatedState } from '$lib/util/state.svelte';
  import {
    clearVisualSelection,
    openVisualColorPanel,
    setSelectionMode,
    visualSelection
  } from '$lib/util/visualSelection.svelte';
  import {
    alignSelected,
    canAlignSelection,
    deleteSelectedElements,
    setSelectedLocked,
    type AlignmentCommand
  } from '$lib/util/visualOperations';
  import {
    AlignCenterHorizontal,
    AlignCenterVertical,
    AlignEndHorizontal,
    AlignEndVertical,
    AlignHorizontalSpaceBetween,
    AlignStartHorizontal,
    AlignStartVertical,
    AlignVerticalSpaceBetween,
    Lock,
    LockOpen,
    Palette,
    Scan,
    Trash2,
    X
  } from 'lucide-svelte';

  let alignOpen = $state(false);
  const canAlign = $derived(canAlignSelection(2));
  const canDistribute = $derived(canAlignSelection(3));
  const allLocked = $derived(
    visualSelection.count > 0 &&
      visualSelection.ids.every((id) => validatedState.current.visualLayers?.[id]?.locked)
  );

  const align = (command: AlignmentCommand): void => {
    if (alignSelected(command)) notify('已完成批量对齐，可撤回恢复。');
  };

  $effect(() => {
    if (!canAlign) alignOpen = false;
  });
</script>

{#if visualSelection.count > 0 || visualSelection.isSelectionMode}
  <div
    class="pointer-events-auto absolute bottom-2 left-1/2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-col-reverse items-center gap-1"
    data-testid="selection-toolbar">
    <div
      class="flex h-11 items-center gap-1 overflow-x-auto rounded-md border border-border-dark bg-card px-2 shadow-lg">
      <Button
        size="sm"
        variant={visualSelection.isSelectionMode ? 'accent' : 'ghost'}
        title="框选模式"
        aria-label="框选模式"
        onclick={() => setSelectionMode(!visualSelection.isSelectionMode)}>
        <Scan class="size-4" />
        <span class="hidden lg:inline">框选</span>
      </Button>
      {#if visualSelection.count > 0}
        <span class="min-w-14 text-center text-xs font-medium whitespace-nowrap">
          已选 {visualSelection.count} 项
        </span>
        <Button
          size="icon"
          variant="ghost"
          title="批量对齐"
          aria-label="批量对齐"
          disabled={!canAlign}
          onclick={() => (alignOpen = !alignOpen)}>
          <AlignCenterHorizontal class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="修改所选颜色"
          aria-label="修改所选颜色"
          disabled={allLocked}
          onclick={openVisualColorPanel}>
          <Palette class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title={allLocked ? '解锁所选元素' : '锁定所选元素'}
          aria-label={allLocked ? '解锁所选元素' : '锁定所选元素'}
          onclick={() => setSelectedLocked(!allLocked)}>
          {#if allLocked}<LockOpen class="size-4" />{:else}<Lock class="size-4" />{/if}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          class="hover:text-destructive"
          title="批量删除"
          aria-label="移除所选元素"
          disabled={allLocked}
          onclick={deleteSelectedElements}>
          <Trash2 class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="取消选择"
          aria-label="取消选择"
          onclick={clearVisualSelection}>
          <X class="size-4" />
        </Button>
      {/if}
    </div>

    {#if alignOpen && visualSelection.count > 1}
      <div
        class="grid grid-cols-4 gap-1 rounded-md border border-border-dark bg-card p-2 shadow-lg"
        aria-label="批量对齐选项">
        <Button size="icon" variant="ghost" title="左对齐" onclick={() => align('left')}>
          <AlignStartVertical class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="水平居中"
          onclick={() => align('center-horizontal')}>
          <AlignCenterVertical class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" title="右对齐" onclick={() => align('right')}>
          <AlignEndVertical class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="水平等间距"
          disabled={!canDistribute}
          onclick={() => align('distribute-horizontal')}>
          <AlignHorizontalSpaceBetween class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" title="顶部对齐" onclick={() => align('top')}>
          <AlignStartHorizontal class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="垂直居中"
          onclick={() => align('center-vertical')}>
          <AlignCenterHorizontal class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" title="底部对齐" onclick={() => align('bottom')}>
          <AlignEndHorizontal class="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="垂直等间距"
          disabled={!canDistribute}
          onclick={() => align('distribute-vertical')}>
          <AlignVerticalSpaceBetween class="size-4" />
        </Button>
      </div>
    {/if}
  </div>
{/if}
