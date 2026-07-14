<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { diagramNotice, dismissDiagramNotice } from '$lib/util/diagramNotice.svelte';
  import { X } from 'lucide-svelte';
</script>

{#if diagramNotice.message}
  <div
    class="pointer-events-none fixed top-[max(4rem,env(safe-area-inset-top))] left-1/2 z-[65] flex w-[min(680px,calc(100%-1rem))] -translate-x-1/2 items-start gap-2 rounded-sm border border-primary/35 bg-card px-3 py-2 text-sm leading-5 text-text shadow-xl"
    data-testid="diagram-operation-notice"
    role="status">
    <p class="min-w-0 flex-1">{diagramNotice.message}</p>
    <Button
      class="pointer-events-auto -mt-1 -mr-2 size-8 shrink-0"
      size="icon"
      variant="ghost"
      aria-label="关闭操作提示"
      onclick={dismissDiagramNotice}>
      <X class="size-4" />
    </Button>
  </div>
{/if}
