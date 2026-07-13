<script lang="ts">
  import Actions from '$/components/Actions.svelte';
  import Card from '$/components/Card/Card.svelte';
  import ColorPickerPanel from '$/components/ColorPickerPanel.svelte';
  import Editor from '$/components/Editor.svelte';
  import History from '$/components/History/History.svelte';
  import { startAutoSave } from '$/components/History/historyState.svelte';
  import Navbar from '$/components/Navbar.svelte';
  import PanZoomToolbar from '$/components/PanZoomToolbar.svelte';
  import Preset from '$/components/Preset.svelte';
  import SyncRoughToolbar from '$/components/SyncRoughToolbar.svelte';
  import * as Resizable from '$/components/ui/resizable';
  import { Button } from '$/components/ui/button';
  import { Switch } from '$/components/ui/switch';
  import { Toggle } from '$/components/ui/toggle';
  import VersionSecurityToolbar from '$/components/VersionSecurityToolbar.svelte';
  import View from '$/components/View.svelte';
  import SelectionToolbar from '$lib/components/workspace/SelectionToolbar.svelte';
  import WorkspaceController from '$lib/components/workspace/WorkspaceController.svelte';
  import WorkspaceQuickToolbar from '$lib/components/workspace/WorkspaceQuickToolbar.svelte';
  import type { EditorMode, Tab } from '$/types';
  import { PanZoomState } from '$/util/panZoom';
  import { validatedState, updateCodeStore } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import { initHandler } from '$/util/util';
  import { visualSelection } from '$lib/util/visualSelection.svelte';
  import { onMount } from 'svelte';
  import { X } from 'lucide-svelte';
  import CodeIcon from '~icons/custom/code';
  import HistoryIcon from '~icons/material-symbols/history';
  import GearIcon from '~icons/material-symbols/settings-outline-rounded';

  const panZoomState = new PanZoomState();

  const tabSelectHandler = (tab: Tab) => {
    const editorMode: EditorMode = tab.id === 'code' ? 'code' : 'config';
    updateCodeStore({ editorMode });
  };

  const editorTabs: Tab[] = [
    {
      icon: CodeIcon,
      id: 'code',
      title: '代码'
    },
    {
      icon: GearIcon,
      id: 'config',
      title: '配置'
    }
  ];

  let width = $state(0);
  let isTouchDevice = $state(false);
  let isMobile = $derived(width < 768 || (isTouchDevice && width < 1024));
  let isViewMode = $state(true);

  onMount(() => {
    isTouchDevice = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    void initHandler();
    const handleAppInstalled = () => {
      logEvent('pwaInstalled', { isMobile });
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  });

  // Record the Timeline for the whole session, not just while the panel is open.
  onMount(() => startAutoSave());

  let isHistoryOpen = $state(false);

  let editorPane: Resizable.Pane | undefined;
  $effect(() => {
    if (isMobile) {
      editorPane?.resize(50);
    }
  });
</script>

<div class="flex h-full flex-col overflow-hidden">
  {#snippet mobileToggle()}
    <div class="flex items-center gap-2">
      编辑 <Switch
        id="editorMode"
        class="data-[state=checked]:bg-accent"
        bind:checked={isViewMode}
        onclick={() => {
          logEvent('mobileViewToggle');
        }} /> 预览
    </div>
  {/snippet}

  <Navbar mobileToggle={isMobile ? mobileToggle : undefined}>
    <Toggle bind:pressed={isHistoryOpen} size="sm" title="历史" aria-label="历史">
      <HistoryIcon />
    </Toggle>
  </Navbar>

  <div class="flex flex-1 flex-col overflow-hidden" bind:clientWidth={width}>
    <div
      class={[
        'size-full',
        isMobile && ['w-[200%] duration-300', isViewMode && '-translate-x-1/2']
      ]}>
      <Resizable.PaneGroup
        direction="horizontal"
        autoSaveId="liveEditor"
        class="gap-4 p-2 pt-0 sm:gap-0 sm:p-6 sm:pt-0">
        <Resizable.Pane bind:this={editorPane} defaultSize={30} minSize={15}>
          <div class="flex h-full flex-col gap-4 sm:gap-6">
            {#if visualSelection.isColorPanelOpen && !isMobile}
              <ColorPickerPanel />
            {:else}
              <Card
                onselect={tabSelectHandler}
                isOpen
                tabs={editorTabs}
                activeTabID={validatedState.current.editorMode}
                isClosable={false}>
                <Editor {isMobile} />
              </Card>
            {/if}

            <div class="group flex flex-wrap justify-between gap-4 sm:gap-6">
              <Preset />
              <Actions />
            </div>
          </div>
        </Resizable.Pane>
        <Resizable.Handle class="mr-1 hidden opacity-0 sm:block" />
        <Resizable.Pane minSize={15} class="relative flex h-full flex-1 flex-col overflow-hidden">
          <View {panZoomState} shouldShowGrid={validatedState.current.grid} />
          {#if !isMobile}
            <WorkspaceQuickToolbar />
            <SelectionToolbar />
          {/if}
          <WorkspaceController
            {isMobile}
            {panZoomState}
            onOpenHistory={() => (isHistoryOpen = true)} />
          <div class="absolute top-0 right-0"><PanZoomToolbar {panZoomState} /></div>
          {#if !isMobile}
            <div class="absolute right-0 bottom-0"><VersionSecurityToolbar /></div>
            <div class="absolute bottom-0 left-5"><SyncRoughToolbar /></div>
          {/if}
        </Resizable.Pane>
        {#if isHistoryOpen && !isMobile}
          <Resizable.Handle class="ml-1 hidden opacity-0 sm:block" />
          <Resizable.Pane minSize={15} defaultSize={30} class="hidden h-full grow flex-col sm:flex">
            <History />
          </Resizable.Pane>
        {/if}
      </Resizable.PaneGroup>
    </div>
  </div>
  {#if isMobile && isHistoryOpen}
    <aside
      class="fixed inset-x-0 bottom-0 z-[80] flex h-[min(82dvh,760px)] flex-col rounded-t-md border border-border-dark bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl"
      aria-label="手机历史记录">
      <header class="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <span class="text-sm font-semibold">保存与恢复</span>
        <Button
          size="icon"
          variant="ghost"
          title="关闭历史记录"
          aria-label="关闭历史记录"
          onclick={() => (isHistoryOpen = false)}><X class="size-4" /></Button>
      </header>
      <div class="min-h-0 flex-1 overflow-hidden p-2">
        <History />
      </div>
    </aside>
  {/if}
</div>
