<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import {
    connectionEditor,
    finishConnectionCreation,
    startConnectionCreation
  } from '$lib/util/connectionEditor.svelte';
  import { closeCommandPalette, openCommandPalette } from '$lib/util/commandRegistry.svelte';
  import { closeGlobalSearch, openGlobalSearch } from '$lib/util/globalSearch.svelte';
  import { notify } from '$lib/util/notify';
  import { addDiagramBranch, validatedState } from '$lib/util/state.svelte';
  import { requestVisualEdit } from '$lib/util/visualDocument.svelte';
  import {
    openVisualColorPanel,
    setSelectionMode,
    visualSelection
  } from '$lib/util/visualSelection.svelte';
  import { deleteSelectedElements } from '$lib/util/visualOperations';
  import { openWorkspacePanel } from '$lib/util/workspacePanels.svelte';
  import {
    ArrowUpRight,
    Command,
    GitBranchPlus,
    History as HistoryIcon,
    Layers,
    ListChecks,
    Palette,
    Pencil,
    Search,
    Trash2
  } from 'lucide-svelte';

  let { onOpenHistory }: { onOpenHistory?: () => void } = $props();

  const current = $derived(visualSelection.current);
  const canColor = $derived(
    visualSelection.ids.some((id) => !validatedState.current.visualLayers?.[id]?.locked)
  );

  const editText = (): void => {
    if (!current) return;
    if (validatedState.current.visualConnections?.[current.id]) {
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="connection-toolbar"] input[aria-label="箭头文字"]'
        );
        input?.focus();
        input?.select();
      });
      return;
    }
    requestVisualEdit(current.id);
  };

  const addBranch = (): void => {
    if (!current || current.kind === 'edge') return;
    if (!addDiagramBranch({ label: current.label, sourceId: current.sourceId })) {
      notify('当前元素不支持添加分支。');
    }
  };

  const openSearch = (): void => {
    openGlobalSearch();
    openWorkspacePanel('search');
  };

  const openLayers = (): void => {
    closeGlobalSearch();
    openWorkspacePanel('layers');
  };
</script>

<div
  class="pointer-events-auto absolute inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-50 flex flex-col gap-1"
  data-testid="mobile-edit-toolbar">
  {#if current}
    <div
      class="flex items-center justify-center gap-1 rounded-md border border-border-dark bg-card p-1 shadow-lg">
      <Button class="h-11 flex-1 px-2" variant="ghost" onclick={editText}>
        <Pencil class="size-4" />
        文字
      </Button>
      <Button
        class="h-11 flex-1 px-2"
        variant="ghost"
        disabled={current.kind === 'edge'}
        onclick={addBranch}>
        <GitBranchPlus class="size-4" />
        分支
      </Button>
      <Button
        class="h-11 flex-1 px-2"
        variant="ghost"
        disabled={!canColor}
        onclick={openVisualColorPanel}>
        <Palette class="size-4" />
        调色
      </Button>
      <Button
        class="h-11 flex-1 px-2 hover:text-destructive"
        variant="ghost"
        onclick={deleteSelectedElements}>
        <Trash2 class="size-4" />
        删除
      </Button>
    </div>
  {/if}
  <nav
    class="grid grid-cols-6 gap-1 rounded-md border border-border-dark bg-card p-1 shadow-xl"
    aria-label="手机编辑工具">
    <Button
      class="h-12 flex-col gap-0 px-1 text-[11px]"
      variant={visualSelection.isSelectionMode ? 'accent' : 'ghost'}
      aria-pressed={visualSelection.isSelectionMode}
      onclick={() => setSelectionMode(!visualSelection.isSelectionMode)}>
      <ListChecks class="size-4" />
      多选
    </Button>
    <Button class="h-12 flex-col gap-0 px-1 text-[11px]" variant="ghost" onclick={openSearch}>
      <Search class="size-4" />
      搜索
    </Button>
    <Button class="h-12 flex-col gap-0 px-1 text-[11px]" variant="ghost" onclick={openLayers}>
      <Layers class="size-4" />
      图层
    </Button>
    <Button
      class="h-12 flex-col gap-0 px-1 text-[11px]"
      variant={connectionEditor.isCreating ? 'accent' : 'ghost'}
      aria-pressed={connectionEditor.isCreating}
      onclick={() =>
        connectionEditor.isCreating ? finishConnectionCreation() : startConnectionCreation()}>
      <ArrowUpRight class="size-4" />
      箭头
    </Button>
    <Button
      class="h-12 flex-col gap-0 px-1 text-[11px]"
      variant="ghost"
      onclick={() => {
        closeCommandPalette();
        openCommandPalette();
      }}>
      <Command class="size-4" />
      命令
    </Button>
    <Button
      class="h-12 flex-col gap-0 px-1 text-[11px]"
      variant="ghost"
      onclick={() => onOpenHistory?.()}>
      <HistoryIcon class="size-4" />
      历史
    </Button>
  </nav>
</div>
