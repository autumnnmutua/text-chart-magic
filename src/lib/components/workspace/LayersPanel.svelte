<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { notify } from '$lib/util/notify';
  import {
    replaceDiagramText,
    updateVisualConnection,
    updateVisualLayer,
    validatedState
  } from '$lib/util/state.svelte';
  import {
    requestVisualFocus,
    visualDocument,
    type VisualDocumentItem
  } from '$lib/util/visualDocument.svelte';
  import { buildVisualOutline } from '$lib/util/visualOutline';
  import { clearVisualSelection, visualSelection } from '$lib/util/visualSelection.svelte';
  import { deleteSelectedElements, selectVisualDocumentItem } from '$lib/util/visualOperations';
  import { findVisualTextRange } from '$lib/util/visualTextEdit';
  import { closeWorkspacePanel } from '$lib/util/workspacePanels.svelte';
  import {
    Box,
    ChevronDown,
    ChevronRight,
    Eye,
    EyeOff,
    FileText,
    Layers,
    Link,
    Lock,
    LockOpen,
    Pencil,
    Search,
    Trash2,
    X
  } from 'lucide-svelte';

  let { embedded = false }: { embedded?: boolean } = $props();

  let filter = $state('');
  let collapsedIds = $state<string[]>([]);
  let editingId = $state('');
  let draft = $state('');

  const normalizedFilter = $derived(filter.trim().toLocaleLowerCase());
  const filteredItems = $derived(
    normalizedFilter
      ? visualDocument.current.filter(({ id, label, kind }) =>
          `${label} ${id} ${kind}`.toLocaleLowerCase().includes(normalizedFilter)
        )
      : visualDocument.current
  );
  const outline = $derived(buildVisualOutline(filteredItems, collapsedIds));

  const layerOf = (id: string) => validatedState.current.visualLayers?.[id] ?? {};

  const toggleCollapsed = (id: string): void => {
    collapsedIds = collapsedIds.includes(id)
      ? collapsedIds.filter((candidate) => candidate !== id)
      : [...collapsedIds, id];
  };

  const selectItem = (item: VisualDocumentItem): void => {
    selectVisualDocumentItem(item.id);
    requestVisualFocus({ visualId: item.id });
  };

  const beginRename = (item: VisualDocumentItem): void => {
    if (layerOf(item.id).locked) {
      notify('请先解锁该元素再重命名。');
      return;
    }
    if (item.kind === 'edge' && item.label === '连线') {
      notify('这条连线没有可编辑文字。');
      return;
    }
    editingId = item.id;
    draft = item.label;
  };

  const finishRename = (item: VisualDocumentItem): void => {
    if (editingId !== item.id) return;
    const nextText = draft.trim();
    if (!nextText || nextText === item.label) {
      editingId = '';
      return;
    }
    editingId = '';
    const connection = validatedState.current.visualConnections?.[item.id];
    if (connection) {
      if (!updateVisualConnection({ ...connection, label: nextText.slice(0, 240) })) return;
      notify('箭头文字已更新，可撤回恢复。');
      return;
    }
    const range = findVisualTextRange(validatedState.current.code, {
      occurrence: item.occurrence,
      sourceId: item.sourceId,
      text: item.label
    });
    if (!range || !replaceDiagramText(range, item.label, nextText)) {
      notify('该复合元素需要在画布中双击具体文字后编辑。');
      return;
    }
    notify('名称已更新，可撤回恢复。');
  };

  const removeItem = (item: VisualDocumentItem): void => {
    selectVisualDocumentItem(item.id);
    if (deleteSelectedElements() === 0) notify('该元素由图表语义固定，无法单独删除。');
  };

  const close = (): void => {
    editingId = '';
    closeWorkspacePanel();
  };
</script>

<div class="flex h-full min-h-0 flex-col" data-testid="layers-panel">
  {#if !embedded}
    <header class="flex items-center gap-2 border-b p-3">
      <Layers class="size-5 text-accent" />
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-semibold">图层与大纲</h2>
        <p class="text-xs text-muted-foreground">{visualDocument.current.length} 个可管理元素</p>
      </div>
      <Button size="icon" variant="ghost" title="关闭图层" aria-label="关闭图层" onclick={close}>
        <X class="size-4" />
      </Button>
    </header>
  {/if}

  <div class="border-b p-2">
    <div class="relative">
      <Search class="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <Input
        bind:value={filter}
        class="pl-8"
        placeholder="筛选名称、类型或 ID"
        aria-label="筛选图层" />
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#if outline.length === 0}
      <div class="flex h-28 items-center justify-center text-sm text-muted-foreground">
        {filter ? '没有匹配的元素' : '当前图表尚无可管理元素'}
      </div>
    {/if}
    {#each outline as entry (entry.item.id)}
      {@const item = entry.item}
      {@const layer = layerOf(item.id)}
      {@const selected = visualSelection.ids.includes(item.id)}
      <div
        class={[
          'group mb-1 flex min-h-10 items-center gap-1 rounded-md pr-1 text-sm',
          selected ? 'bg-primary ring-1 ring-accent/50' : 'hover:bg-muted',
          layer.hidden && 'opacity-55'
        ]}
        style={`padding-left: ${Math.min(entry.depth, 6) * 14 + 4}px`}>
        {#if entry.hasChildren}
          <Button
            size="icon"
            variant="ghost"
            class="size-7"
            title={collapsedIds.includes(item.id) ? '展开' : '折叠'}
            aria-label={collapsedIds.includes(item.id) ? '展开' : '折叠'}
            onclick={() => toggleCollapsed(item.id)}>
            {#if collapsedIds.includes(item.id)}
              <ChevronRight class="size-3.5" />
            {:else}
              <ChevronDown class="size-3.5" />
            {/if}
          </Button>
        {:else}
          <span class="block size-7 shrink-0"></span>
        {/if}

        <div class="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
          {#if item.kind === 'edge'}
            <Link class="size-4 shrink-0" />
          {:else if item.kind === 'text'}
            <FileText class="size-4 shrink-0" />
          {:else}
            <Box class="size-4 shrink-0" />
          {/if}
          {#if editingId === item.id}
            <Input
              bind:value={draft}
              class="h-8 min-w-0"
              aria-label="重命名元素"
              onkeydown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') finishRename(item);
                if (event.key === 'Escape') editingId = '';
              }}
              onblur={() => finishRename(item)} />
          {:else}
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left"
              title={item.label}
              onclick={() => selectItem(item)}>{item.label}</button>
          {/if}
        </div>

        <div
          class="hidden shrink-0 items-center group-hover:flex group-focus-within:flex max-sm:flex">
          <Button
            size="icon"
            variant="ghost"
            class="size-7 max-sm:size-11"
            title="重命名"
            aria-label="重命名"
            onclick={() => beginRename(item)}><Pencil class="size-3.5" /></Button>
          {#if item.canHide}
            <Button
              size="icon"
              variant="ghost"
              class="size-7 max-sm:size-11"
              title={layer.hidden ? '显示' : '隐藏'}
              aria-label={layer.hidden ? '显示' : '隐藏'}
              onclick={() => updateVisualLayer([item.id], { hidden: !layer.hidden })}>
              {#if layer.hidden}<EyeOff class="size-3.5" />{:else}<Eye class="size-3.5" />{/if}
            </Button>
          {/if}
          <Button
            size="icon"
            variant="ghost"
            class="size-7 max-sm:size-11"
            title={layer.locked ? '解锁' : '锁定'}
            aria-label={layer.locked ? '解锁' : '锁定'}
            onclick={() => updateVisualLayer([item.id], { locked: !layer.locked })}>
            {#if layer.locked}<Lock class="size-3.5" />{:else}<LockOpen class="size-3.5" />{/if}
          </Button>
          {#if item.canDelete}
            <Button
              size="icon"
              variant="ghost"
              class="size-7 hover:text-destructive max-sm:size-11"
              title="删除"
              aria-label="删除"
              disabled={layer.locked}
              onclick={() => removeItem(item)}><Trash2 class="size-3.5" /></Button>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <footer
    class="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
    <span>画布与大纲双向同步</span>
    {#if visualSelection.count > 0}
      <button type="button" class="text-accent hover:underline" onclick={clearVisualSelection}>
        取消选择
      </button>
    {/if}
  </footer>
</div>
