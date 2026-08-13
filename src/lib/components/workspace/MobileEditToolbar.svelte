<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { addFocusedDiagramBranch } from '$lib/util/branchActions';
  import {
    connectionEditor,
    finishConnectionCreation,
    startConnectionCreation
  } from '$lib/util/connectionEditor.svelte';
  import { getDiagramKeyword } from '$lib/util/diagramBranch';
  import {
    mobileWorkspace,
    openMobileWorkspaceSheet,
    setMobileToolMode,
    type MobileToolMode
  } from '$lib/util/mobileWorkspace.svelte';
  import { notify } from '$lib/util/notify';
  import { canUndoEdit, undoLastEdit, validatedState } from '$lib/util/state.svelte';
  import {
    saveCurrentWorkspaceWithFeedback,
    workspaceSaveState
  } from '$lib/util/workspaceSave.svelte';
  import { requestVisualEdit } from '$lib/util/visualDocument.svelte';
  import {
    openVisualColorPanel,
    setSelectionMode,
    visualSelection
  } from '$lib/util/visualSelection.svelte';
  import {
    canAlignSelection,
    deleteSelectedElements,
    selectAllVisualElements,
    setSelectedLocked
  } from '$lib/util/visualOperations';
  import { addVisualElementBranch } from '$lib/util/visualElementActions';
  import {
    AlignCenterHorizontal,
    ArrowUpRight,
    Check,
    Focus,
    GitBranchPlus,
    Hand,
    LoaderCircle,
    Lock,
    LockOpen,
    MoreHorizontal,
    MousePointer2,
    Palette,
    Pencil,
    Save,
    Trash2,
    Undo2
  } from 'lucide-svelte';

  const current = $derived(visualSelection.current);
  const canColor = $derived(
    visualSelection.ids.some((id) => !validatedState.current.visualLayers?.[id]?.locked)
  );
  const currentLocked = $derived(
    visualSelection.count > 0 &&
      visualSelection.ids.every((id) => validatedState.current.visualLayers?.[id]?.locked)
  );

  const switchMode = (next: MobileToolMode): void => {
    if (next === 'connection') {
      setSelectionMode(false);
      setMobileToolMode('connection');
      startConnectionCreation();
      return;
    }
    finishConnectionCreation();
    setSelectionMode(next === 'multi');
    setMobileToolMode(next);
  };

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
    if (validatedState.current.visualElements?.[current.id]) {
      if (!addVisualElementBranch(current.id)) notify('当前元素暂时无法添加分支。');
      return;
    }
    if (
      !addFocusedDiagramBranch({
        label: current.label,
        mode: getDiagramKeyword(validatedState.current.code) === 'kanban' ? 'card' : 'branch',
        sourceId: current.sourceId
      })
    ) {
      notify('当前元素不支持添加分支。');
    }
  };

  const toggleConnectionMode = (): void => {
    if (connectionEditor.isCreating) switchMode('select');
    else switchMode('connection');
  };
</script>

<div
  class={[
    'pointer-events-auto absolute right-[max(.5rem,env(safe-area-inset-right))] left-[max(.5rem,env(safe-area-inset-left))] z-50 flex flex-col gap-1 transition-[bottom] duration-150',
    mobileWorkspace.isKeyboardOpen
      ? 'bottom-[max(.25rem,env(safe-area-inset-bottom))]'
      : 'bottom-[max(.5rem,env(safe-area-inset-bottom))]'
  ]}
  data-testid="mobile-edit-toolbar">
  {#if mobileWorkspace.mode === 'multi' && !mobileWorkspace.isKeyboardOpen}
    <div
      class="grid grid-cols-5 items-center gap-1 rounded-md border border-border-dark bg-card p-1 shadow-lg">
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        onclick={selectAllVisualElements}>
        <Focus class="size-4" />全选
      </Button>
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        disabled={!canAlignSelection(2)}
        onclick={() => openMobileWorkspaceSheet('align')}>
        <AlignCenterHorizontal class="size-4" />对齐
      </Button>
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        disabled={!canColor}
        onclick={openVisualColorPanel}>
        <Palette class="size-4" />调色
      </Button>
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px] hover:text-destructive"
        variant="ghost"
        disabled={visualSelection.count === 0 || currentLocked}
        onclick={deleteSelectedElements}>
        <Trash2 class="size-4" />删除
      </Button>
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px]"
        variant="accent"
        onclick={() => switchMode('select')}>
        <Check class="size-4" />完成 {visualSelection.count}
      </Button>
    </div>
  {:else if current && !mobileWorkspace.isKeyboardOpen}
    <div
      class="grid grid-cols-5 items-center gap-1 rounded-md border border-border-dark bg-card p-1 shadow-lg"
      aria-label="所选元素操作">
      <Button class="h-11 flex-col gap-0 px-1 text-[11px]" variant="ghost" onclick={editText}>
        <Pencil class="size-4" />文字
      </Button>
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        disabled={current.kind === 'edge' || currentLocked}
        onclick={addBranch}>
        <GitBranchPlus class="size-4" />分支
      </Button>
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        disabled={!canColor}
        onclick={openVisualColorPanel}>
        <Palette class="size-4" />调色
      </Button>
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        onclick={() => setSelectedLocked(!currentLocked)}>
        {#if currentLocked}<LockOpen class="size-4" />解锁{:else}<Lock class="size-4" />锁定{/if}
      </Button>
      <Button
        class="h-11 flex-col gap-0 px-1 text-[11px] hover:text-destructive"
        variant="ghost"
        disabled={currentLocked}
        onclick={deleteSelectedElements}>
        <Trash2 class="size-4" />删除
      </Button>
    </div>
  {/if}
  {#if !mobileWorkspace.isKeyboardOpen}
    <nav
      class="grid grid-cols-7 gap-1 rounded-md border border-border-dark bg-card p-1 shadow-xl"
      aria-label="手机编辑工具">
      <Button
        class="h-12 flex-col gap-0 px-1 text-[11px]"
        variant={mobileWorkspace.mode === 'select' ? 'accent' : 'ghost'}
        aria-pressed={mobileWorkspace.mode === 'select'}
        onclick={() => switchMode('select')}>
        <MousePointer2 class="size-4" />选择
      </Button>
      <Button
        class="h-12 flex-col gap-0 px-1 text-[11px]"
        variant={mobileWorkspace.mode === 'pan' ? 'accent' : 'ghost'}
        aria-pressed={mobileWorkspace.mode === 'pan'}
        onclick={() => switchMode('pan')}>
        <Hand class="size-4" />画布
      </Button>
      <Button
        class="h-12 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        disabled={!current || current.kind === 'edge' || currentLocked}
        onclick={addBranch}>
        <GitBranchPlus class="size-4" />分支
      </Button>
      <Button
        class="h-12 flex-col gap-0 px-1 text-[11px]"
        variant={connectionEditor.isCreating ? 'accent' : 'ghost'}
        aria-pressed={connectionEditor.isCreating}
        onclick={toggleConnectionMode}>
        <ArrowUpRight class="size-4" />箭头
      </Button>
      <Button
        class="h-12 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        disabled={!canUndoEdit.current}
        onclick={() => undoLastEdit()}>
        <Undo2 class="size-4" />撤回
      </Button>
      <Button
        class="h-12 flex-col gap-0 px-1 text-[11px]"
        variant="ghost"
        aria-label="保存本机版本"
        disabled={workspaceSaveState.isSaving}
        onclick={saveCurrentWorkspaceWithFeedback}>
        {#if workspaceSaveState.isSaving}
          <LoaderCircle class="size-4 animate-spin" />保存中
        {:else if !workspaceSaveState.hasUnsavedChanges}
          <Check class="size-4" />已存本机
        {:else}
          <Save class="size-4" />存本机
        {/if}
      </Button>
      <Button
        class="h-12 flex-col gap-0 px-1 text-[11px]"
        variant={mobileWorkspace.sheet ? 'accent' : 'ghost'}
        aria-expanded={Boolean(mobileWorkspace.sheet)}
        onclick={() => openMobileWorkspaceSheet('more')}>
        <MoreHorizontal class="size-4" />更多
      </Button>
    </nav>
  {/if}
</div>
