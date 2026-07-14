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
  import {
    ArrowUpRight,
    BoxSelect,
    Code2,
    Command,
    Layers,
    ListChecks,
    Search
  } from 'lucide-svelte';

  const openSearch = (): void => {
    openGlobalSearch();
    openWorkspacePanel('search');
  };

  const toggleLayers = (): void => {
    closeGlobalSearch();
    toggleWorkspacePanel('layers');
  };
</script>

<div class="pointer-events-auto absolute top-2 left-2 z-20" data-testid="workspace-quick-toolbar">
  <FloatingToolbar>
    <Button
      size="icon"
      variant="ghost"
      title="查看和编辑代码"
      aria-label="查看和编辑代码"
      onclick={() => openWorkspacePanel('code')}>
      <Code2 class="size-4" />
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
