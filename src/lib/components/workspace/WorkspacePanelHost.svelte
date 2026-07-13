<script lang="ts">
  import GlobalSearchPanel from '$lib/components/workspace/GlobalSearchPanel.svelte';
  import LayersPanel from '$lib/components/workspace/LayersPanel.svelte';
  import { workspacePanels } from '$lib/util/workspacePanels.svelte';

  let { isMobile = false }: { isMobile?: boolean } = $props();
</script>

{#if workspacePanels.active}
  <aside
    class={[
      'overflow-hidden border border-border-dark bg-card shadow-xl',
      isMobile
        ? 'fixed inset-x-0 bottom-0 z-[60] h-[min(76dvh,680px)] rounded-t-md pb-[env(safe-area-inset-bottom)]'
        : 'absolute top-14 right-2 bottom-14 z-40 w-[min(380px,calc(100%-1rem))] rounded-md'
    ]}
    aria-label={workspacePanels.active === 'search' ? '全局搜索面板' : '图层与大纲面板'}>
    {#if workspacePanels.active === 'search'}
      <GlobalSearchPanel />
    {:else}
      <LayersPanel />
    {/if}
  </aside>
{/if}
