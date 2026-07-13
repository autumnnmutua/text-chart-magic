<script lang="ts">
  import FloatingToolbar from '$/components/FloatingToolbar.svelte';
  import { Button } from '$/components/ui/button';
  import { Separator } from '$/components/ui/separator';
  import type { PanZoomState } from '$/util/panZoom';
  import {
    canRedoEdit,
    canUndoEdit,
    redoLastEdit,
    setSnapToGrid,
    undoLastEdit,
    validatedState
  } from '$/util/state.svelte';
  import { Magnet } from 'lucide-svelte';
  import ArrowsToCircleIcon from '~icons/material-symbols/screenshot-frame-2';
  import RedoIcon from '~icons/material-symbols/redo-rounded';
  import UndoIcon from '~icons/material-symbols/undo-rounded';
  import MagnifyingGlassPlusIcon from '~icons/material-symbols/zoom-in';
  import MagnifyingGlassMinusIcon from '~icons/material-symbols/zoom-out';

  let { panZoomState }: { panZoomState: PanZoomState } = $props();
</script>

<FloatingToolbar>
  <Button
    variant="ghost"
    size="sm"
    title="撤回上一步"
    disabled={!canUndoEdit.current}
    onclick={() => undoLastEdit()}>
    <UndoIcon />
    撤回
  </Button>
  <Button
    variant="ghost"
    size="sm"
    title="恢复下一步"
    disabled={!canRedoEdit.current}
    onclick={() => redoLastEdit()}>
    <RedoIcon />
    恢复
  </Button>
  <Separator orientation="vertical" />
  <Button
    variant={validatedState.current.snapToGrid ? 'accent' : 'ghost'}
    size="icon"
    title={validatedState.current.snapToGrid ? '关闭网格吸附' : '开启网格吸附'}
    aria-label={validatedState.current.snapToGrid ? '关闭网格吸附' : '开启网格吸附'}
    onclick={() => setSnapToGrid(!validatedState.current.snapToGrid)}>
    <Magnet class="size-4" />
  </Button>
  <Separator orientation="vertical" />
  <Button variant="ghost" size="icon" title="重置视图" onclick={() => panZoomState.reset()}>
    <ArrowsToCircleIcon />
  </Button>
  <Separator orientation="vertical" />
  <Button
    variant="ghost"
    size="icon"
    title="缩小"
    class="hidden sm:block"
    onclick={() => panZoomState.zoomOut()}>
    <MagnifyingGlassMinusIcon />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    title="放大"
    class="hidden sm:block"
    onclick={() => panZoomState.zoomIn()}>
    <MagnifyingGlassPlusIcon />
  </Button>
</FloatingToolbar>
