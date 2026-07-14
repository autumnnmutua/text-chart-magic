<script lang="ts">
  import CodeWorkbench from '$lib/components/workspace/CodeWorkbench.svelte';
  import GlobalSearchPanel from '$lib/components/workspace/GlobalSearchPanel.svelte';
  import LayersPanel from '$lib/components/workspace/LayersPanel.svelte';
  import MobileSheet from '$lib/components/workspace/MobileSheet.svelte';
  import { closeGlobalSearch } from '$lib/util/globalSearch.svelte';
  import { closeWorkspacePanel, workspacePanels } from '$lib/util/workspacePanels.svelte';

  let { isMobile = false }: { isMobile?: boolean } = $props();

  const panelTitle = $derived(
    workspacePanels.active === 'search'
      ? '全局搜索与替换'
      : workspacePanels.active === 'code'
        ? '代码工作台'
        : '图层与大纲'
  );

  const close = (): void => {
    if (workspacePanels.active === 'search') closeGlobalSearch();
    closeWorkspacePanel();
  };
</script>

{#if workspacePanels.active}
  {#snippet panelContent()}
    {#if workspacePanels.active === 'search'}
      <GlobalSearchPanel embedded={isMobile} />
    {:else if workspacePanels.active === 'code'}
      <CodeWorkbench embedded={isMobile} />
    {:else}
      <LayersPanel embedded={isMobile} />
    {/if}
  {/snippet}
  {#if isMobile}
    <MobileSheet title={panelTitle} ariaLabel={`手机${panelTitle}面板`} onClose={close}>
      {@render panelContent()}
    </MobileSheet>
  {:else}
    <aside
      class="absolute top-14 right-2 bottom-14 z-40 w-[min(380px,calc(100%-1rem))] overflow-hidden rounded-md border border-border-dark bg-card shadow-xl"
      aria-label={workspacePanels.active === 'search'
        ? '全局搜索面板'
        : workspacePanels.active === 'code'
          ? '代码工作台'
          : '图层与大纲面板'}>
      {@render panelContent()}
    </aside>
  {/if}
{/if}
