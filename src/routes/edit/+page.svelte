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
  import { Switch } from '$/components/ui/switch';
  import { Toggle } from '$/components/ui/toggle';
  import VersionSecurityToolbar from '$/components/VersionSecurityToolbar.svelte';
  import View from '$/components/View.svelte';
  import SelectionToolbar from '$lib/components/workspace/SelectionToolbar.svelte';
  import WorkspaceController from '$lib/components/workspace/WorkspaceController.svelte';
  import MobileSheet from '$lib/components/workspace/MobileSheet.svelte';
  import WorkspaceQuickToolbar from '$lib/components/workspace/WorkspaceQuickToolbar.svelte';
  import type { EditorMode, Tab } from '$/types';
  import { PanZoomState } from '$/util/panZoom';
  import { validatedState, updateCodeStore } from '$/util/state.svelte';
  import { logEvent } from '$/util/stats';
  import { initHandler } from '$/util/util';
  import { visualSelection } from '$lib/util/visualSelection.svelte';
  import { onMount } from 'svelte';
  import { PanelsTopLeft } from 'lucide-svelte';
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

<div
  class="relative flex h-full min-w-0 flex-col overflow-hidden pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
  {#snippet mobileToggle()}
    <div class="flex min-w-32 items-center justify-end gap-1 text-xs">
      <span class={isViewMode ? 'text-muted-foreground' : 'font-medium text-foreground'}>代码</span>
      <Switch
        id="editorMode"
        class="data-[state=checked]:bg-accent"
        bind:checked={isViewMode}
        onclick={() => {
          logEvent('mobileViewToggle');
        }} />
      <span class={isViewMode ? 'font-medium text-foreground' : 'text-muted-foreground'}>画布</span>
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
        isMobile && [
          'w-[200%] transition-transform duration-200 ease-out',
          isViewMode && '-translate-x-1/2'
        ]
      ]}>
      <Resizable.PaneGroup
        direction="horizontal"
        autoSaveId="liveEditor"
        class={isMobile ? 'gap-0 p-0' : 'gap-0 p-6 pt-0'}>
        <Resizable.Pane bind:this={editorPane} defaultSize={30} minSize={15}>
          {#if !isMobile || !isViewMode}
            <div
              class={[
                'flex h-full min-h-0 flex-col overflow-y-auto',
                isMobile ? 'gap-3 px-2 pb-[max(.75rem,env(safe-area-inset-bottom))]' : 'gap-6 pr-1'
              ]}>
              <div class={['flex shrink-0 flex-col', isMobile ? 'min-h-[56dvh]' : 'min-h-40']}>
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
              </div>

              <div class="group flex flex-wrap justify-between gap-4 sm:gap-6">
                <Preset />
                <Actions />
              </div>
            </div>
          {/if}
        </Resizable.Pane>
        <Resizable.Handle class="mr-1 hidden opacity-0 sm:block" />
        <Resizable.Pane
          minSize={15}
          class={[
            'relative flex h-full flex-1 flex-col overflow-hidden',
            isMobile && !isViewMode && 'invisible'
          ]}>
          <View {isMobile} {panZoomState} shouldShowGrid={validatedState.current.grid} />
          {#if !isMobile}
            <WorkspaceQuickToolbar />
            <SelectionToolbar />
          {/if}
          <WorkspaceController
            {isMobile}
            {panZoomState}
            onOpenHistory={() => (isHistoryOpen = true)} />
          {#if !isMobile}
            <div class="absolute top-0 right-0"><PanZoomToolbar {panZoomState} /></div>
          {/if}
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
    <MobileSheet title="历史记录" ariaLabel="手机历史记录" onClose={() => (isHistoryOpen = false)}>
      <div class="flex h-full min-h-0 flex-col p-2">
        <div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <PanelsTopLeft class="size-4" />保存、撤回和恢复使用同一份图表数据
        </div>
        <div class="min-h-0 flex-1 overflow-hidden"><History /></div>
      </div>
    </MobileSheet>
  {/if}
</div>
