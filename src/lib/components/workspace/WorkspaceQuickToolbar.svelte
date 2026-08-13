<script lang="ts">
  import FloatingToolbar from '$lib/components/FloatingToolbar.svelte';
  import { Button } from '$lib/components/ui/button';
  import {
    connectionEditor,
    finishConnectionCreation,
    startConnectionCreation
  } from '$lib/util/connectionEditor.svelte';
  import { openCommandPalette } from '$lib/util/commandRegistry.svelte';
  import { getDiagramKeyword } from '$lib/util/diagramBranch';
  import { closeGlobalSearch, openGlobalSearch } from '$lib/util/globalSearch.svelte';
  import { setSelectionMode, visualSelection } from '$lib/util/visualSelection.svelte';
  import { addArchitectureGroup, validatedState } from '$lib/util/state.svelte';
  import { openWorkspacePanel, toggleWorkspacePanel } from '$lib/util/workspacePanels.svelte';
  import { openVisualElementPicker } from '$lib/util/visualElementPicker.svelte';
  import {
    saveCurrentWorkspaceWithFeedback,
    workspaceSaveState
  } from '$lib/util/workspaceSave.svelte';
  import {
    ArrowUpRight,
    BoxSelect,
    ChartNoAxesCombined,
    Check,
    Code2,
    Command,
    Layers,
    ListChecks,
    LoaderCircle,
    Save,
    Search,
    Shapes
  } from 'lucide-svelte';

  const openSearch = (): void => {
    openGlobalSearch();
    openWorkspacePanel('search');
  };

  const toggleLayers = (): void => {
    closeGlobalSearch();
    toggleWorkspacePanel('layers');
  };

  const openCode = (): void => {
    closeGlobalSearch();
    openWorkspacePanel('code');
  };

  const openDiagrams = (): void => {
    closeGlobalSearch();
    openWorkspacePanel('diagrams');
  };
</script>

<div class="pointer-events-auto absolute top-2 left-2 z-50" data-testid="workspace-quick-toolbar">
  <FloatingToolbar>
    <Button
      size="icon"
      variant="ghost"
      title="查看和编辑代码"
      aria-label="查看和编辑代码"
      onclick={openCode}>
      <Code2 class="size-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      title="打开图表库"
      aria-label="打开图表库"
      onclick={openDiagrams}>
      <ChartNoAxesCombined class="size-4" />
    </Button>
    <Button
      size="icon"
      variant={workspaceSaveState.hasUnsavedChanges ? 'ghost' : 'accent'}
      title={workspaceSaveState.hasUnsavedChanges ? '保存本机版本' : '当前版本已保存到本机'}
      aria-label={workspaceSaveState.hasUnsavedChanges ? '保存本机版本' : '本机版本已保存'}
      disabled={workspaceSaveState.isSaving}
      onclick={saveCurrentWorkspaceWithFeedback}>
      {#if workspaceSaveState.isSaving}
        <LoaderCircle class="size-4 animate-spin" />
      {:else if workspaceSaveState.hasUnsavedChanges}
        <Save class="size-4" />
      {:else}
        <Check class="size-4" />
      {/if}
    </Button>
    {#if getDiagramKeyword(validatedState.current.code) === 'architecture-beta'}
      <Button
        size="icon"
        variant="ghost"
        title="添加虚线分组框"
        aria-label="添加虚线分组框"
        onclick={addArchitectureGroup}>
        <BoxSelect class="size-4" />
      </Button>
    {/if}
    <Button
      size="icon"
      variant="ghost"
      title="添加图形或图标"
      aria-label="添加图形或图标"
      onclick={openVisualElementPicker}>
      <Shapes class="size-4" />
    </Button>
    <Button size="icon" variant="ghost" title="全局搜索" aria-label="全局搜索" onclick={openSearch}>
      <Search class="size-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      title="图层与大纲"
      aria-label="图层与大纲"
      onclick={toggleLayers}>
      <Layers class="size-4" />
    </Button>
    <Button
      size="icon"
      variant={visualSelection.isSelectionMode ? 'accent' : 'ghost'}
      title="框选模式"
      aria-label="框选模式"
      aria-pressed={visualSelection.isSelectionMode}
      onclick={() => setSelectionMode(!visualSelection.isSelectionMode)}>
      <ListChecks class="size-4" />
    </Button>
    <Button
      size="icon"
      variant={connectionEditor.isCreating ? 'accent' : 'ghost'}
      title="添加自主箭头"
      aria-label="添加自主箭头"
      aria-pressed={connectionEditor.isCreating}
      onclick={() =>
        connectionEditor.isCreating ? finishConnectionCreation() : startConnectionCreation()}>
      <ArrowUpRight class="size-4" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      title="命令与快捷键"
      aria-label="命令与快捷键"
      onclick={openCommandPalette}>
      <Command class="size-4" />
    </Button>
  </FloatingToolbar>
</div>
