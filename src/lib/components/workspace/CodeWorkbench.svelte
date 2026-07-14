<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { getDiagramKeyword } from '$lib/util/diagramBranch';
  import { parse } from '$lib/util/mermaid';
  import { notify } from '$lib/util/notify';
  import { updateCodeInteraction, validatedState } from '$lib/util/state.svelte';
  import { closeWorkspacePanel } from '$lib/util/workspacePanels.svelte';
  import { Check, RotateCcw, X } from 'lucide-svelte';

  const initialCode = validatedState.current.code;
  let draft = $state(initialCode);
  let lastValid = $state(initialCode);
  let syncedCode = initialCode;
  let errorMessage = $state('');
  let applying = $state(false);

  $effect(() => {
    const currentCode = validatedState.current.code;
    if (currentCode === syncedCode) return;
    const draftWasClean = draft === lastValid;
    syncedCode = currentCode;
    lastValid = currentCode;
    if (draftWasClean) {
      draft = currentCode;
      errorMessage = '';
    }
  });

  const formatError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/^Error:\s*/i, '').trim() || '代码格式不正确，请检查后重试。';
  };

  const applyDraft = async (): Promise<void> => {
    if (applying) return;
    applying = true;
    errorMessage = '';
    try {
      await parse(draft);
      updateCodeInteraction(draft, { start: true, updateDiagram: true });
      lastValid = draft;
      syncedCode = draft;
      notify('代码修改已应用到图表。');
    } catch (error) {
      errorMessage = formatError(error);
    } finally {
      applying = false;
    }
  };

  const restoreLastValid = (): void => {
    draft = lastValid;
    errorMessage = '';
  };
</script>

<section class="flex h-full min-h-0 flex-col" data-testid="code-workbench">
  <header class="flex items-start justify-between gap-3 border-b border-border-dark p-3">
    <div class="min-w-0">
      <h2 class="text-sm font-semibold text-text">代码工作台</h2>
      <p class="mt-1 text-xs text-text-muted">
        当前格式：{getDiagramKeyword(lastValid) || '图表代码'}。校验通过后才会修改画布。
      </p>
    </div>
    <Button size="icon" variant="ghost" aria-label="关闭代码工作台" onclick={closeWorkspacePanel}>
      <X class="size-4" />
    </Button>
  </header>

  <div class="flex min-h-0 flex-1 flex-col gap-2 p-3">
    <label class="text-xs font-medium text-text" for="diagram-code-draft">图表代码</label>
    <textarea
      id="diagram-code-draft"
      class="min-h-0 flex-1 resize-none rounded-sm border border-border-dark bg-background p-3 font-mono text-[13px] leading-5 text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      bind:value={draft}
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      aria-describedby={errorMessage ? 'diagram-code-error' : undefined}></textarea>
    {#if errorMessage}
      <div
        id="diagram-code-error"
        class="max-h-28 overflow-auto rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-xs whitespace-pre-wrap text-destructive"
        role="alert">
        {errorMessage}
      </div>
    {/if}
  </div>

  <footer
    class="grid grid-cols-3 gap-2 border-t border-border-dark p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
    <Button variant="outline" onclick={restoreLastValid} title="恢复打开面板时的有效代码">
      <RotateCcw class="size-4" />
      恢复有效版
    </Button>
    <Button variant="ghost" onclick={closeWorkspacePanel}>
      <X class="size-4" />
      取消
    </Button>
    <Button disabled={applying || draft === lastValid} onclick={applyDraft}>
      <Check class="size-4" />
      {applying ? '校验中' : '应用修改'}
    </Button>
  </footer>
</section>
