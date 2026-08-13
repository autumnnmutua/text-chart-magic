<script lang="ts">
  import CommandPalette from '$lib/components/workspace/CommandPalette.svelte';
  import ArchitectureGroupToolbar from '$lib/components/workspace/ArchitectureGroupToolbar.svelte';
  import DiagramNotice from '$lib/components/workspace/DiagramNotice.svelte';
  import MobileEditToolbar from '$lib/components/workspace/MobileEditToolbar.svelte';
  import MobileMorePanel from '$lib/components/workspace/MobileMorePanel.svelte';
  import MobileSheet from '$lib/components/workspace/MobileSheet.svelte';
  import WorkspacePanelHost from '$lib/components/workspace/WorkspacePanelHost.svelte';
  import VisualElementPicker from '$lib/components/workspace/VisualElementPicker.svelte';
  import ColorPickerPanel from '$lib/components/ColorPickerPanel.svelte';
  import {
    cancelConnectionCreation,
    connectionEditor,
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
  import {
    closeMobileWorkspaceSheet,
    mobileWorkspace,
    observeMobileViewport,
    setMobileToolMode,
    setMobileWorkspaceEnabled
  } from '$lib/util/mobileWorkspace.svelte';
  import type { PanZoomState } from '$lib/util/panZoom';
  import {
    canRedoEdit,
    canUndoEdit,
    redoLastEdit,
    resetToDefaultGraph,
    addArchitectureGroup,
    persistenceState,
    setSnapToGrid,
    undoLastEdit,
    validatedState
  } from '$lib/util/state.svelte';
  import { visualDocument } from '$lib/util/visualDocument.svelte';
  import { getDiagramKeyword } from '$lib/util/diagramBranch';
  import {
    clearVisualSelection,
    closeVisualColorPanel,
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
  import { saveCurrentWorkspaceWithFeedback } from '$lib/util/workspaceSave.svelte';
  import { onMount } from 'svelte';

  let {
    isMobile = false,
    onOpenHistory,
    panZoomState
  }: { isMobile?: boolean; onOpenHistory?: () => void; panZoomState: PanZoomState } = $props();

  const shortcutModifier = (): string =>
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

  const saveCurrent = (): void => {
    void saveCurrentWorkspaceWithFeedback();
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

  const openDiagrams = (): void => {
    closeGlobalSearch();
    openWorkspacePanel('diagrams');
  };

  const resetDiagram = (): void => {
    clearVisualSelection();
    resetToDefaultGraph();
  };

  const escapeWorkspace = (): void => {
    if (cancelConnectionCreation()) return;
    if (mobileWorkspace.sheet) {
      closeMobileWorkspaceSheet();
      return;
    }
    if (visualSelection.isColorPanelOpen) {
      closeVisualColorPanel();
      return;
    }
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
        category: '视图',
        id: 'diagrams',
        label: '打开图表库',
        run: openDiagrams
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
        label: '保存本机版本',
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
        if (typing || event.defaultPrevented) return;
        escapeWorkspace();
        return;
      }
      if (typing) {
        if (modifierPressed && key === 's') {
          event.preventDefault();
          saveCurrent();
        }
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

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!persistenceState.hasWriteFailure) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      unregister();
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  $effect(() => {
    setMobileWorkspaceEnabled(isMobile);
  });

  $effect(() => {
    if (!isMobile) return;
    return observeMobileViewport();
  });

  $effect(() => {
    if (isMobile && mobileWorkspace.mode === 'connection' && !connectionEditor.isCreating) {
      setMobileToolMode('select');
    }
  });

  $effect(() => {
    if (globalSearch.isOpen) {
      refreshGlobalSearch(
        validatedState.current.code,
        validatedState.current.visualConnections,
        validatedState.current.visualElements
      );
    }
  });
</script>

<CommandPalette />
<DiagramNotice />
<ArchitectureGroupToolbar />
<WorkspacePanelHost {isMobile} />
<VisualElementPicker />
{#if isMobile}
  <MobileEditToolbar />
  <MobileMorePanel {onOpenHistory} {panZoomState} />
  {#if visualSelection.isColorPanelOpen}
    <MobileSheet title="调色" ariaLabel="手机调色面板" onClose={closeVisualColorPanel}>
      <div class="h-full overflow-y-auto"><ColorPickerPanel /></div>
    </MobileSheet>
  {/if}
{/if}
