<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import MobileDiagramPicker from '$lib/components/workspace/MobileDiagramPicker.svelte';
  import { addFocusedDiagramBranch } from '$lib/util/branchActions';
  import { finishConnectionCreation } from '$lib/util/connectionEditor.svelte';
  import { getDiagramKeyword, type DiagramBranchRequest } from '$lib/util/diagramBranch';
  import { closeGlobalSearch, openGlobalSearch } from '$lib/util/globalSearch.svelte';
  import {
    closeMobileWorkspaceSheet,
    mobileWorkspace,
    openMobileWorkspaceSheet,
    setMobileToolMode
  } from '$lib/util/mobileWorkspace.svelte';
  import { notify } from '$lib/util/notify';
  import type { PanZoomState } from '$lib/util/panZoom';
  import {
    addArchitectureGroup,
    canRedoEdit,
    redoLastEdit,
    resetToDefaultGraph,
    setSnapToGrid,
    validatedState
  } from '$lib/util/state.svelte';
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
    selectAllVisualElements,
    setSelectedLocked
  } from '$lib/util/visualOperations';
  import { openWorkspacePanel } from '$lib/util/workspacePanels.svelte';
  import { openVisualElementPicker } from '$lib/util/visualElementPicker.svelte';
  import {
    AlignCenterHorizontal,
    AlignCenterVertical,
    AlignEndHorizontal,
    AlignEndVertical,
    AlignHorizontalDistributeCenter,
    AlignStartHorizontal,
    AlignStartVertical,
    AlignVerticalDistributeCenter,
    BoxSelect,
    Code2,
    ChartNoAxesCombined,
    Focus,
    Grid3X3,
    History as HistoryIcon,
    Layers,
    Lock,
    LockOpen,
    Palette,
    RefreshCcw,
    Redo2,
    Search,
    Shapes,
    SquareDashed,
    Trash2
  } from 'lucide-svelte';
  import MobileSheet from './MobileSheet.svelte';

  let { onOpenHistory, panZoomState }: { onOpenHistory?: () => void; panZoomState: PanZoomState } =
    $props();

  const currentLocked = $derived(
    visualSelection.count > 0 &&
      visualSelection.ids.every((id) => validatedState.current.visualLayers?.[id]?.locked)
  );
  const current = $derived(visualSelection.current);
  const diagramKeyword = $derived(getDiagramKeyword(validatedState.current.code));
  const specialActions = $derived.by(() => {
    const actions: {
      label: string;
      mode: NonNullable<DiagramBranchRequest['mode']>;
    }[] = [];
    if (diagramKeyword === 'kanban') {
      actions.push(
        { label: '新增看板列', mode: 'column' },
        { label: '新增卡片', mode: 'card' },
        { label: '新增检查项', mode: 'checklist' }
      );
    } else if (diagramKeyword === 'gantt') {
      actions.push(
        { label: '新增 section', mode: 'section' },
        { label: '新增任务', mode: 'branch' }
      );
    } else if (diagramKeyword === 'packet') {
      actions.push(
        { label: '前方插入', mode: 'before' },
        { label: '后方插入', mode: 'after' },
        { label: '拆分字段', mode: 'split' }
      );
    } else if (diagramKeyword === 'gitgraph') {
      actions.push(
        { label: '新增 Git 分支', mode: 'branch' },
        { label: '新增提交', mode: 'commit' }
      );
    }
    return actions;
  });

  const close = (): void => closeMobileWorkspaceSheet();

  const openPanel = (panel: 'code' | 'layers' | 'search'): void => {
    close();
    if (panel === 'search') openGlobalSearch();
    else closeGlobalSearch();
    openWorkspacePanel(panel);
  };

  const toggleMulti = (): void => {
    finishConnectionCreation();
    const enabled = mobileWorkspace.mode !== 'multi';
    setSelectionMode(enabled);
    setMobileToolMode(enabled ? 'multi' : 'select');
  };

  const resetDiagram = (): void => {
    clearVisualSelection();
    resetToDefaultGraph();
    notify('已恢复当前图表的初始状态，可用撤回恢复。');
    close();
  };

  const runAlignment = (command: Parameters<typeof alignSelected>[0]): void => {
    if (alignSelected(command)) close();
  };

  const addSpecialItem = (mode: NonNullable<DiagramBranchRequest['mode']>): void => {
    if (!current) {
      notify('请先选择要扩展的元素。');
      return;
    }
    if (!addFocusedDiagramBranch({ label: current.label, mode, sourceId: current.sourceId })) {
      notify('当前选择不支持这项图表操作。');
      return;
    }
    close();
  };
</script>

{#if mobileWorkspace.sheet}
  <MobileSheet
    initiallyExpanded={false}
    title={mobileWorkspace.sheet === 'align'
      ? '批量对齐'
      : mobileWorkspace.sheet === 'diagrams'
        ? '其他图表'
        : '更多工具'}
    ariaLabel={mobileWorkspace.sheet === 'align'
      ? '手机批量对齐面板'
      : mobileWorkspace.sheet === 'diagrams'
        ? '手机其他图表面板'
        : '手机更多工具面板'}
    onClose={close}>
    {#if mobileWorkspace.sheet === 'align'}
      <div class="grid max-h-[min(64dvh,520px)] grid-cols-3 gap-2 overflow-y-auto p-3">
        <Button
          class="h-12"
          variant="outline"
          disabled={!canAlignSelection(2)}
          onclick={() => runAlignment('left')}>
          <AlignStartVertical class="size-4" />左对齐
        </Button>
        <Button
          class="h-12"
          variant="outline"
          disabled={!canAlignSelection(2)}
          onclick={() => runAlignment('center-horizontal')}>
          <AlignCenterVertical class="size-4" />水平居中
        </Button>
        <Button
          class="h-12"
          variant="outline"
          disabled={!canAlignSelection(2)}
          onclick={() => runAlignment('right')}>
          <AlignEndVertical class="size-4" />右对齐
        </Button>
        <Button
          class="h-12"
          variant="outline"
          disabled={!canAlignSelection(2)}
          onclick={() => runAlignment('top')}>
          <AlignStartHorizontal class="size-4" />顶部
        </Button>
        <Button
          class="h-12"
          variant="outline"
          disabled={!canAlignSelection(2)}
          onclick={() => runAlignment('center-vertical')}>
          <AlignCenterHorizontal class="size-4" />垂直居中
        </Button>
        <Button
          class="h-12"
          variant="outline"
          disabled={!canAlignSelection(2)}
          onclick={() => runAlignment('bottom')}>
          <AlignEndHorizontal class="size-4" />底部
        </Button>
        <Button
          class="col-span-3 h-12"
          variant="outline"
          disabled={!canAlignSelection(3)}
          onclick={() => runAlignment('distribute-horizontal')}>
          <AlignHorizontalDistributeCenter class="size-4" />水平等间距
        </Button>
        <Button
          class="col-span-3 h-12"
          variant="outline"
          disabled={!canAlignSelection(3)}
          onclick={() => runAlignment('distribute-vertical')}>
          <AlignVerticalDistributeCenter class="size-4" />垂直等间距
        </Button>
      </div>
    {:else if mobileWorkspace.sheet === 'diagrams'}
      <MobileDiagramPicker onSelect={close} />
    {:else}
      <div class="max-h-[min(72dvh,620px)] overflow-y-auto p-3">
        <div class="grid grid-cols-3 gap-2">
          <Button
            class="h-14 flex-col gap-1"
            variant={mobileWorkspace.mode === 'multi' ? 'accent' : 'outline'}
            onclick={toggleMulti}>
            <BoxSelect class="size-5" />多选
          </Button>
          <Button class="h-14 flex-col gap-1" variant="outline" onclick={selectAllVisualElements}>
            <Focus class="size-5" />全选
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            disabled={visualSelection.count < 2}
            onclick={() => openMobileWorkspaceSheet('align')}>
            <AlignCenterHorizontal class="size-5" />对齐
          </Button>
          <Button class="h-14 flex-col gap-1" variant="outline" onclick={() => openPanel('search')}>
            <Search class="size-5" />搜索
          </Button>
          <Button class="h-14 flex-col gap-1" variant="outline" onclick={() => openPanel('layers')}>
            <Layers class="size-5" />图层
          </Button>
          <Button class="h-14 flex-col gap-1" variant="outline" onclick={() => openPanel('code')}>
            <Code2 class="size-5" />代码
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            disabled={visualSelection.count === 0}
            onclick={() => {
              openVisualColorPanel();
              close();
            }}>
            <Palette class="size-5" />批量调色
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            disabled={visualSelection.count === 0}
            onclick={() => setSelectedLocked(!currentLocked)}>
            {#if currentLocked}<LockOpen class="size-5" />解锁{:else}<Lock
                class="size-5" />锁定{/if}
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            onclick={() => {
              close();
              openVisualElementPicker();
            }}>
            <Shapes class="size-5" />图形图标
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            onclick={() => openMobileWorkspaceSheet('diagrams')}>
            <ChartNoAxesCombined class="size-5" />其他图表
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            disabled={!canRedoEdit.current}
            onclick={() => redoLastEdit()}>
            <Redo2 class="size-5" />重做
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            onclick={() => {
              close();
              onOpenHistory?.();
            }}>
            <HistoryIcon class="size-5" />历史
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant={validatedState.current.snapToGrid ? 'accent' : 'outline'}
            onclick={() => setSnapToGrid(!validatedState.current.snapToGrid)}>
            <Grid3X3 class="size-5" />网格吸附
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            onclick={() => {
              panZoomState.reset();
              close();
            }}>
            <RefreshCcw class="size-5" />重置视图
          </Button>
          <Button
            class="h-14 flex-col gap-1"
            variant="outline"
            disabled={diagramKeyword !== 'architecture-beta'}
            onclick={() => {
              addArchitectureGroup();
              close();
            }}>
            <SquareDashed class="size-5" />虚线分组
          </Button>
          <Button
            class="h-14 flex-col gap-1 hover:text-destructive"
            variant="outline"
            disabled={visualSelection.count === 0}
            onclick={() => {
              deleteSelectedElements();
              close();
            }}>
            <Trash2 class="size-5" />批量删除
          </Button>
        </div>
        {#if specialActions.length > 0}
          <div class="mt-3 border-t pt-3">
            <div class="mb-2 text-xs font-medium text-muted-foreground">当前图表专用操作</div>
            <div class="grid grid-cols-2 gap-2">
              {#each specialActions as action (action.mode)}
                <Button
                  class="h-11"
                  variant="secondary"
                  disabled={!current}
                  onclick={() => addSpecialItem(action.mode)}>{action.label}</Button>
              {/each}
            </div>
          </div>
        {/if}
        <div class="mt-3 border-t pt-3">
          <Button class="h-11 w-full" variant="ghost" onclick={resetDiagram}>
            <RefreshCcw class="size-4" />恢复当前图表初始状态
          </Button>
        </div>
      </div>
    {/if}
  </MobileSheet>
{/if}
