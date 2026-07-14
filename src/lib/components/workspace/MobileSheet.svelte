<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { mobileWorkspace } from '$lib/util/mobileWorkspace.svelte';
  import { X } from 'lucide-svelte';
  import { onMount, type Snippet } from 'svelte';

  let {
    ariaLabel,
    children,
    initiallyExpanded = true,
    onClose,
    title
  }: {
    ariaLabel: string;
    children: Snippet;
    initiallyExpanded?: boolean;
    onClose: () => void;
    title: string;
  } = $props();

  let expanded = $state(true);
  let initialized = false;
  let sheet: HTMLElement;
  let sheetHeight = $state(0);
  let drag:
    | { currentHeight: number; pointerId: number; startHeight: number; startY: number }
    | undefined;
  let suppressToggleUntil = 0;

  const heightStops = (): { collapsed: number; expanded: number } => {
    const viewportHeight = mobileWorkspace.visualHeight || window.innerHeight;
    const maximum = Math.max(260, viewportHeight - 8);
    const expandedHeight = Math.min(maximum, viewportHeight * 0.82);
    return {
      collapsed: Math.min(expandedHeight, Math.max(260, viewportHeight * 0.58)),
      expanded: expandedHeight
    };
  };

  const snapSheet = (nextExpanded: boolean): void => {
    expanded = nextExpanded;
    const stops = heightStops();
    sheetHeight = nextExpanded ? stops.expanded : stops.collapsed;
  };

  function updateSheetDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const stops = heightStops();
    const nextHeight = Math.min(
      stops.expanded,
      Math.max(stops.collapsed, drag.startHeight + drag.startY - event.clientY)
    );
    if (Math.abs(nextHeight - drag.startHeight) > 4) suppressToggleUntil = performance.now() + 350;
    drag = { ...drag, currentHeight: nextHeight };
    sheetHeight = nextHeight;
  }

  function removeDragListeners(): void {
    window.removeEventListener('pointermove', updateSheetDrag, true);
    window.removeEventListener('pointerup', finishSheetDrag, true);
    window.removeEventListener('pointercancel', finishSheetDrag, true);
  }

  function finishSheetDrag(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const currentHeight = drag.currentHeight;
    drag = undefined;
    removeDragListeners();
    const stops = heightStops();
    snapSheet(currentHeight >= (stops.collapsed + stops.expanded) / 2);
  }

  const startSheetDrag = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    const startHeight = sheet.getBoundingClientRect().height;
    drag = {
      currentHeight: startHeight,
      pointerId: event.pointerId,
      startHeight,
      startY: event.clientY
    };
    window.addEventListener('pointermove', updateSheetDrag, { capture: true, passive: false });
    window.addEventListener('pointerup', finishSheetDrag, true);
    window.addEventListener('pointercancel', finishSheetDrag, true);
  };

  $effect(() => {
    if (!initialized) {
      expanded = initiallyExpanded;
      initialized = true;
    }
    if (!drag && typeof window !== 'undefined') snapSheet(expanded);
  });

  beforeNavigate(({ cancel, type }) => {
    if (type !== 'popstate') return;
    cancel();
    onClose();
  });

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', handleKeydown, { capture: true });
    return () => {
      removeDragListeners();
      window.removeEventListener('keydown', handleKeydown, { capture: true });
    };
  });
</script>

<div
  class="absolute inset-0 z-[60] bg-black/25 backdrop-blur-[1px]"
  data-testid="mobile-sheet-backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.currentTarget === event.target) onClose();
  }}>
  <div
    bind:this={sheet}
    class="absolute inset-x-0 bottom-0 flex min-h-44 flex-col overflow-hidden rounded-t-md border border-border-dark bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl"
    style:height={sheetHeight > 0 ? `${sheetHeight}px` : initiallyExpanded ? '82dvh' : '58dvh'}
    style="bottom: var(--mobile-keyboard-height, 0px); padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right);"
    aria-label={ariaLabel}
    aria-modal="true"
    role="dialog">
    <button
      type="button"
      class="mx-auto flex h-8 w-20 shrink-0 touch-none items-center justify-center"
      aria-label="调整面板高度"
      onpointerdown={startSheetDrag}
      onclick={() => {
        if (performance.now() < suppressToggleUntil) return;
        snapSheet(!expanded);
      }}>
      <span class="h-1 w-10 rounded-full bg-muted-foreground/35"></span>
    </button>
    <header class="flex min-h-11 shrink-0 items-center justify-between border-b px-3">
      <h2 class="text-sm font-semibold">{title}</h2>
      <Button
        size="icon"
        variant="ghost"
        class="size-11"
        aria-label={`关闭${title}`}
        onclick={onClose}>
        <X class="size-5" />
      </Button>
    </header>
    <div class="min-h-0 flex-1 overflow-hidden">
      {@render children()}
    </div>
  </div>
</div>
