<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { parseArchitectureGroups } from '$lib/util/architectureGroups';
  import { updateArchitectureGroup, validatedState } from '$lib/util/state.svelte';
  import { visualSelection } from '$lib/util/visualSelection.svelte';
  import { deleteSelectedElements } from '$lib/util/visualOperations';
  import { Trash2 } from 'lucide-svelte';

  const group = $derived(
    parseArchitectureGroups(validatedState.current.code).find(
      ({ id }) => id === visualSelection.current?.id
    )
  );
  let syncedId = '';
  let label = $state('');
  let width = $state(320);
  let height = $state(180);

  $effect(() => {
    if (!group || group.id === syncedId) return;
    syncedId = group.id;
    label = group.label;
    width = Math.round(group.width);
    height = Math.round(group.height);
  });

  const applyFields = (): void => {
    if (!group) return;
    const nextLabel = label.trim().slice(0, 80) || group.label;
    const nextWidth = Math.max(Number(width) || group.width, 160);
    const nextHeight = Math.max(Number(height) || group.height, 96);
    label = nextLabel;
    width = Math.round(nextWidth);
    height = Math.round(nextHeight);
    updateArchitectureGroup({
      ...group,
      auto: false,
      height: nextHeight,
      label: nextLabel,
      width: nextWidth
    });
  };
</script>

{#if group}
  <div
    class="pointer-events-auto absolute top-2 left-1/2 z-40 flex max-w-[calc(100%-7rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-sm border border-border-dark bg-card p-1 shadow-xl"
    data-testid="architecture-group-toolbar">
    <input
      class="h-11 min-w-24 flex-1 rounded-sm border border-border-dark bg-background px-2 text-sm text-text outline-none focus:border-primary sm:h-8"
      aria-label="虚线框标题"
      bind:value={label}
      onblur={applyFields}
      onkeydown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyFields();
          event.currentTarget.blur();
        }
      }} />
    <label class="flex items-center gap-1 text-xs text-text-muted">
      宽
      <input
        class="h-11 w-16 rounded-sm border border-border-dark bg-background px-2 text-text sm:h-8"
        type="number"
        min="160"
        step="10"
        bind:value={width}
        onblur={applyFields} />
    </label>
    <label class="flex items-center gap-1 text-xs text-text-muted">
      高
      <input
        class="h-11 w-16 rounded-sm border border-border-dark bg-background px-2 text-text sm:h-8"
        type="number"
        min="96"
        step="10"
        bind:value={height}
        onblur={applyFields} />
    </label>
    <Button
      class="h-11 px-2 text-xs sm:h-8"
      variant={group.moveMembers ? 'accent' : 'outline'}
      title={group.moveMembers ? '移动分组时带动内部模块' : '移动时仅移动边框'}
      onclick={() => updateArchitectureGroup({ ...group, moveMembers: !group.moveMembers })}>
      {group.moveMembers ? '带动内部' : '仅移边框'}
    </Button>
    <Button
      size="icon"
      variant="ghost"
      class="size-11 hover:text-destructive sm:size-8"
      aria-label="删除虚线分组框"
      title="只删除分组框，保留内部模块"
      onclick={deleteSelectedElements}>
      <Trash2 class="size-4" />
    </Button>
  </div>
{/if}
