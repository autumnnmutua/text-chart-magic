<script lang="ts">
  import FloatingToolbar from '$/components/FloatingToolbar.svelte';
  import { Button } from '$/components/ui/button';
  import { TID } from '$/constants';
  import { resetToDefaultGraph } from '$/util/state.svelte';
  import { clearVisualSelection } from '$lib/util/visualSelection.svelte';
  import { mode, setMode } from 'mode-watcher';
  import ResetIcon from '~icons/material-symbols/restart-alt-rounded';
  import ThemeIcon from './ThemeIcon.svelte';
</script>

<FloatingToolbar>
  <Button
    variant="ghost"
    size="sm"
    title="重置成最初的图"
    onclick={() => {
      clearVisualSelection();
      resetToDefaultGraph();
    }}>
    <ResetIcon />
    重置
  </Button>
  <Button
    variant="ghost"
    size="icon"
    data-testid={TID.themeToggleButton}
    title="切换到{mode.current === 'dark' ? '浅色' : '深色'}主题"
    class="[&_svg]:size-5"
    onclick={() => setMode(mode.current === 'dark' ? 'light' : 'dark')}>
    <ThemeIcon />
  </Button>
</FloatingToolbar>
