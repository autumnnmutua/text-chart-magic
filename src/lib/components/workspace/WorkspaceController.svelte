<script lang="ts">
  import { addManualEntry } from '$lib/components/History/historyState.svelte';
  import CommandPalette from '$lib/components/workspace/CommandPalette.svelte';
  import ArchitectureGroupToolbar from '$lib/components/workspace/ArchitectureGroupToolbar.svelte';
  import DiagramNotice from '$lib/components/workspace/DiagramNotice.svelte';
  import MobileEditToolbar from '$lib/components/workspace/MobileEditToolbar.svelte';
  import WorkspacePanelHost from '$lib/components/workspace/WorkspacePanelHost.svelte';
  import ColorPickerPanel from '$lib/components/ColorPickerPanel.svelte';
  import {
    cancelConnectionCreation,
    startConnectionCreation
  } from '$lib/util/connectionEditor.svelte';
  import {
    closeCommandPalette,
    commandRegistry,
    openCommandPalette,
    registerWorkspaceCommands
  } from '$lib/util/commandRegistry.svelte';
  import {
    closeGlobalSearch,
    globalSearch,
    openGlobalSearch,
    refreshGlobalSearch
  } from '$lib/util/globalSearch.svelte';
  import { notify } from '$lib/util/notify';
  import type { PanZoomState } from '$lib/util/panZoom';
  import {
    canRedoEdit,
    canUndoEdit,
    inputState,
    redoLastEdit,
    resetToDefaultGraph,
    addArchitectureGroup,
    setSnapToGrid,
    undoLastEdit,
    validatedState
  } from '$lib/util/state.svelte';
  import { visualDocument } from '$lib/util/visualDocument.svelte';
  import { getDiagramKeyword } from '$lib/util/diagramBranch';
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
    moveSelectedLayer,
    nudgeSelected,
    selectAllVisualElements,
    setSelectedHidden,
    setSelectedLocked
  } from '$lib/util/visualOperations';
  import {
    closeWorkspacePanel,
    openWorkspacePanel,
    workspacePanels
  } from '$lib/util/workspacePanels.svelte';
  import { onMount } from 'svelte';

  let {
    isMobile = false,
    onOpenHistory,
    panZoomState
  }: { isMobile?: boolean; onOpenHistory?: () => void; panZoomState: PanZoomState } = $props();

  const shortcutModifier = (): string =>
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  const saveCurrent = (): void => {
    if (addManualEntry($state.snapshot(inputState))) notify('已保存当前图表版本。');
    else notify('当前图表已经保存过了。');
  };

  const openSearch = (): void => {
    openGlobalSearch();
    openWorkspacePanel('search');
  };

  const openLayers = (): void => {
    closeGlobalSearch();
    openWorkspacePanel('layers');
  };

  const openCode = (): void => {
    closeGlobalSearch();
    openWorkspacePanel('code');
  };

  const resetDiagram = (): void => {
    clearVisualSelection();
    resetToDefaultGraph();
  };

  const escapeWorkspace = (): void => {
    if (cancelConnectionCreation()) return;
    if (commandRegistry.isPaletteOpen) {
      closeCommandPalette();
      return;
    }
    if (workspacePanels.active) {
      closeWorkspacePanel();
      closeGlobalSearch();
      return;
    }
    setSelectionMode(false);
    clearVisualSelection();
  };

  const isTextInput = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    Boolean(
      target.closest(
        'input, textarea, select, [contenteditable="true"], .monaco-editor, [role="textbox"]'
      )
    );

  onMount(() => {
    const modifier = shortcutModifier();
    const unregister = registerWorkspaceCommands('workspace', [
      {
        category: '编辑',
        disabledReason: () => '请先切换到架构图。',
        id: 'architecture-group',
        isEnabled: () => getDiagramKeyword(validatedState.current.code) === 'architecture-beta',
        label: '添加虚线分组框',
        run: () => addArchitectureGroup()
      },
      {
        category: '编辑',
        id: 'code',
        label: '查看和编辑图表代码',
        run: openCode
      },
      {
        category: '编辑',
        id: 'undo',
        isEnabled: () => canUndoEdit.current,
        label: '撤回上一步',
        run: () => undoLastEdit(),
        shortcut: `${modifier}+Z`
      },
      {
        category: '编辑',
        id: 'redo',
        isEnabled: () => canRedoEdit.current,
        label: '恢复下一步',
        run: () => redoLastEdit(),
        shortcut: `${modifier}+Shift+Z`
      },
      {
        category: '编辑',
        id: 'save',
        label: '保存当前版本',
        run: saveCurrent,
        shortcut: `${modifier}+S`
      },
      {
        category: '编辑',
        id: 'select-all',
        isEnabled: () => visualDocument.current.length > 0,
        label: '全选可管理元素',
        run: selectAllVisualElements,
        shortcut: `${modifier}+A`
      },
      {
        category: '编辑',
        disabledReason: () => '当前图表语法无法安全复制父子关系，请使用添加分支。',
        id: 'copy',
        isEnabled: () => false,
        label: '复制所选元素',
        run: () => undefined,
        shortcut: `${modifier}+C`
      },
      {
        category: '编辑',
        disabledReason: () => '为避免生成重复 ID，粘贴将在统一节点模型完成后开放。',
        id: 'paste',
        isEnabled: () => false,
        label: '粘贴元素',
        run: () => undefined,
        shortcut: `${modifier}+V`
      },
      {
        category: '编辑',
        id: 'add-connection',
        label: '添加自主箭头',
        run: startConnectionCreation
      },
      {
        category: '编辑',
        id: 'delete',
        isEnabled: () => visualSelection.count > 0,
        label: '删除所选元素',
        run: deleteSelectedElements,
        shortcut: 'Delete'
      },
      {
        category: '编辑',
        id: 'color',
        isEnabled: () =>
          visualSelection.ids.some((id) => !validatedState.current.visualLayers?.[id]?.locked),
        label: '调色所选元素',
        run: openVisualColorPanel
      },
      {
        category: '编辑',
        id: 'lock',
        isEnabled: () => visualSelection.count > 0,
        label: '锁定所选元素',
        run: () => setSelectedLocked(true)
      },
      {
        category: '编辑',
        id: 'unlock',
        isEnabled: () => visualSelection.count > 0,
        label: '解锁所选元素',
        run: () => setSelectedLocked(false)
      },
      {
        category: '对齐',
        disabledReason: () => '请选择同一种自由布局中的至少两个未锁定模块。',
        id: 'align-left',
        isEnabled: () => canAlignSelection(2),
        label: '左对齐',
        run: () => alignSelected('left')
      },
      {
        category: '对齐',
        disabledReason: () => '请选择同一种自由布局中的至少两个未锁定模块。',
        id: 'align-center-horizontal',
        isEnabled: () => canAlignSelection(2),
        label: '水平居中对齐',
        run: () => alignSelected('center-horizontal')
      },
      {
        category: '对齐',
        disabledReason: () => '请选择同一种自由布局中的至少两个未锁定模块。',
        id: 'align-right',
        isEnabled: () => canAlignSelection(2),
        label: '右对齐',
        run: () => alignSelected('right')
      },
      {
        category: '对齐',
        disabledReason: () => '请选择同一种自由布局中的至少两个未锁定模块。',
        id: 'align-top',
        isEnabled: () => canAlignSelection(2),
        label: '顶部对齐',
        run: () => alignSelected('top')
      },
      {
        category: '对齐',
        disabledReason: () => '请选择同一种自由布局中的至少两个未锁定模块。',
        id: 'align-center-vertical',
        isEnabled: () => canAlignSelection(2),
        label: '垂直居中对齐',
        run: () => alignSelected('center-vertical')
      },
      {
        category: '对齐',
        disabledReason: () => '请选择同一种自由布局中的至少两个未锁定模块。',
        id: 'align-bottom',
        isEnabled: () => canAlignSelection(2),
        label: '底部对齐',
        run: () => alignSelected('bottom')
      },
      {
        category: '对齐',
        disabledReason: () => '水平等间距至少需要三个同类自由布局模块。',
        id: 'distribute-horizontal',
        isEnabled: () => canAlignSelection(3),
        label: '水平等间距',
        run: () => alignSelected('distribute-horizontal')
      },
      {
        category: '对齐',
        disabledReason: () => '垂直等间距至少需要三个同类自由布局模块。',
        id: 'distribute-vertical',
        isEnabled: () => canAlignSelection(3),
        label: '垂直等间距',
        run: () => alignSelected('distribute-vertical')
      },
      {
        category: '搜索',
        id: 'search',
        label: '全局搜索与替换',
        run: openSearch,
        shortcut: `${modifier}+F`
      },
      {
        category: '图层',
        id: 'layers',
        label: '打开图层与大纲',
        run: openLayers
      },
      {
        category: '图层',
        id: 'hide',
        isEnabled: () => visualSelection.count > 0,
        label: '隐藏所选元素',
        run: () => setSelectedHidden(true)
      },
      {
        category: '图层',
        id: 'forward',
        isEnabled: () => visualSelection.count > 0,
        label: '所选元素上移一层',
        run: () => moveSelectedLayer(1)
      },
      {
        category: '图层',
        id: 'backward',
        isEnabled: () => visualSelection.count > 0,
        label: '所选元素下移一层',
        run: () => moveSelectedLayer(-1)
      },
      {
        category: '视图',
        id: 'selection-mode',
        label: '切换框选模式',
        run: () => setSelectionMode(!visualSelection.isSelectionMode)
      },
      {
        category: '视图',
        id: 'snap-grid',
        label: '切换网格吸附',
        run: () => setSnapToGrid(!validatedState.current.snapToGrid)
      },
      {
        category: '视图',
        id: 'reset-view',
        label: '重置画布视图',
        run: () => panZoomState.reset()
      },
      {
        category: '编辑',
        id: 'reset-diagram',
        label: '重置为初始图表',
        run: resetDiagram
      }
    ]);

    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.isComposing) return;
      const modifierPressed = event.ctrlKey || event.metaKey;
      const key = event.key.toLocaleLowerCase();
      const typing = isTextInput(event.target);

      if (key === 'escape') {
        escapeWorkspace();
        return;
      }
      if (modifierPressed && key === 'k') {
        event.preventDefault();
        if (commandRegistry.isPaletteOpen) closeCommandPalette();
        else openCommandPalette();
        return;
      }
      if (modifierPressed && key === 's') {
        event.preventDefault();
        saveCurrent();
        return;
      }
      if (modifierPressed && key === 'f') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (typing) return;

      let handled = false;
      if (modifierPressed && key === 'z' && event.shiftKey) handled = redoLastEdit();
      else if (modifierPressed && key === 'z') handled = undoLastEdit();
      else if (modifierPressed && key === 'y') handled = redoLastEdit();
      else if (modifierPressed && key === 'a') {
        selectAllVisualElements();
        handled = true;
      } else if (key === 'delete' || key === 'backspace') {
        handled = deleteSelectedElements() > 0;
      } else if (key.startsWith('arrow') && visualSelection.count > 0) {
        const distance = event.shiftKey ? 10 : 1;
        const dx = key === 'arrowleft' ? -distance : key === 'arrowright' ? distance : 0;
        const dy = key === 'arrowup' ? -distance : key === 'arrowdown' ? distance : 0;
        handled = nudgeSelected(dx, dy);
      }
      if (handled) event.preventDefault();
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      unregister();
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  $effect(() => {
    if (globalSearch.isOpen) refreshGlobalSearch(validatedState.current.code);
  });
</script>

<CommandPalette />
<DiagramNotice />
<ArchitectureGroupToolbar />
<WorkspacePanelHost {isMobile} />
{#if isMobile}
  <MobileEditToolbar {onOpenHistory} />
  {#if visualSelection.isColorPanelOpen}
    <aside
      class="fixed inset-x-0 bottom-0 z-[70] max-h-[82dvh] overflow-y-auto rounded-t-md border border-border-dark bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl"
      aria-label="手机调色面板">
      <ColorPickerPanel />
    </aside>
  {/if}
{/if}
