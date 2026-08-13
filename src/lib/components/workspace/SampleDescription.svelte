<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { notify } from '$lib/util/notify';
  import { updateSampleDescription, validatedState } from '$lib/util/state.svelte';
  import { Check, Pencil, Trash2, X } from 'lucide-svelte';

  let { isMobile = false }: { isMobile?: boolean } = $props();
  let editing = $state(false);
  let draft = $state('');
  const description = $derived(validatedState.current.sampleDescription ?? '');

  $effect(() => {
    if (!editing) draft = description;
  });

  const startEditing = (): void => {
    draft = description;
    editing = true;
  };

  const save = (): void => {
    if (!draft.trim()) {
      notify('说明不能为空；如不需要，请使用删除说明。');
      return;
    }
    updateSampleDescription(draft);
    editing = false;
  };

  const remove = (): void => {
    if (updateSampleDescription(undefined)) notify('示例说明已删除，可用撤回恢复。');
    editing = false;
  };
</script>

{#if description}
  <section
    class={[
      'pointer-events-auto absolute right-2 left-2 z-20 mx-auto max-w-3xl rounded-md border border-orange-300/70 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm',
      isMobile
        ? 'bottom-[calc(7.25rem+env(safe-area-inset-bottom))] max-h-[28dvh]'
        : 'bottom-14 max-h-32'
    ]}
    data-testid="sample-description"
    aria-label="示例说明">
    <div class="mb-1 flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-foreground">示例说明</h2>
      <div class="flex shrink-0 items-center gap-1">
        {#if editing}
          <Button
            size="icon"
            variant="ghost"
            class="size-8"
            title="取消编辑"
            onclick={() => (editing = false)}>
            <X class="size-4" />
          </Button>
          <Button size="icon" class="size-8" title="保存说明" onclick={save}>
            <Check class="size-4" />
          </Button>
        {:else}
          <Button
            size="icon"
            variant="ghost"
            class="size-8"
            title="编辑示例说明"
            onclick={startEditing}>
            <Pencil class="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            class="size-8 hover:text-destructive"
            title="删除示例说明"
            onclick={remove}>
            <Trash2 class="size-4" />
          </Button>
        {/if}
      </div>
    </div>
    {#if editing}
      <textarea
        bind:value={draft}
        class="min-h-24 w-full resize-y rounded-sm border border-input bg-background p-2 text-base leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        maxlength="4000"
        aria-label="编辑示例说明"
        onkeydown={(event) => {
          if (event.isComposing) return;
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            save();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            editing = false;
          }
        }}></textarea>
    {:else}
      <p class="max-h-24 overflow-y-auto text-sm leading-6 text-muted-foreground">{description}</p>
    {/if}
  </section>
{/if}
