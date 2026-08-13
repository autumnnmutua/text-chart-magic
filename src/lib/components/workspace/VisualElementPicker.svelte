<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { notify } from '$lib/util/notify';
  import { addVisualElementFromSelection } from '$lib/util/visualElementActions';
  import {
    closeVisualElementPicker,
    visualElementPicker
  } from '$lib/util/visualElementPicker.svelte';
  import { visualShapeOptions } from '$lib/util/visualElements';
  import { Box, Cloud, Database, FileText, Server, UserRound, X } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let adding = $state(false);

  const waitForCanvas = async (timeout = 5000): Promise<boolean> => {
    const deadline = performance.now() + timeout;
    while (visualElementPicker.isOpen && performance.now() < deadline) {
      if (document.querySelector('#view svg')) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  };

  const add = async (option: (typeof visualShapeOptions)[number]): Promise<void> => {
    if (adding) return;
    adding = true;
    try {
      if (!(await waitForCanvas()) || !addVisualElementFromSelection(option)) {
        notify('画布尚未准备好，请稍后再试。');
        return;
      }
      closeVisualElementPicker();
    } finally {
      adding = false;
    }
  };

  onMount(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && visualElementPicker.isOpen) closeVisualElementPicker();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  });
</script>

{#if visualElementPicker.isOpen}
  <div
    class="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-4"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) closeVisualElementPicker();
    }}>
    <div
      class="max-h-[min(78dvh,620px)] w-full overflow-y-auto rounded-t-lg border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-xl sm:rounded-lg"
      role="dialog"
      aria-modal="true"
      aria-label="选择图形或图标"
      data-testid="visual-element-picker">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">添加图形或图标</h2>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            选中模块后添加会自动创建分支关系；未选中时作为独立元素加入画布。
          </p>
        </div>
        <Button size="icon" variant="ghost" title="关闭" onclick={closeVisualElementPicker}>
          <X class="size-5" />
        </Button>
      </div>

      <h3 class="mb-2 text-xs font-semibold text-muted-foreground">基础形状</h3>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {#each visualShapeOptions.filter(({ kind }) => kind === 'shape') as option (option.shape)}
          <Button
            class="h-20 flex-col gap-2 whitespace-normal px-2 text-xs"
            disabled={adding}
            variant="outline"
            title={`添加${option.label}`}
            onclick={() => add(option)}>
            <span
              class:rounded-full={option.shape === 'circle' || option.shape === 'ellipse'}
              class:rounded-md={option.shape === 'rounded'}
              class:rotate-45={option.shape === 'diamond'}
              class="block h-7 w-9 border-2 border-orange-500 bg-orange-100"></span>
            <span>{option.label}</span>
          </Button>
        {/each}
      </div>

      <h3 class="mt-4 mb-2 text-xs font-semibold text-muted-foreground">角色与对象图标</h3>
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {#each visualShapeOptions.filter(({ kind }) => kind === 'icon') as option (option.label)}
          <Button
            class="h-20 flex-col gap-2 whitespace-normal px-2 text-xs"
            disabled={adding}
            variant="outline"
            title={`添加${option.label}`}
            onclick={() => add(option)}>
            {#if option.shape === 'person'}
              <UserRound class="size-7 text-orange-600" />
            {:else if option.shape === 'server'}
              <Server class="size-7 text-orange-600" />
            {:else if option.shape === 'cylinder'}
              <Database class="size-7 text-orange-600" />
            {:else if option.shape === 'document'}
              <FileText class="size-7 text-orange-600" />
            {:else if option.shape === 'cloud'}
              <Cloud class="size-7 text-orange-600" />
            {:else}
              <Box class="size-7 text-orange-600" />
            {/if}
            <span>{option.label}</span>
          </Button>
        {/each}
      </div>
    </div>
  </div>
{/if}
