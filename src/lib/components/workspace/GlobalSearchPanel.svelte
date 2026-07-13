<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import {
    closeGlobalSearch,
    globalSearch,
    moveGlobalSearchResult,
    replaceAllSearchResults,
    replaceCurrentSearchResult,
    selectGlobalSearchResult,
    setGlobalReplacement,
    setGlobalSearchCaseSensitive,
    setGlobalSearchQuery,
    setGlobalSearchWholeWord
  } from '$lib/util/globalSearch.svelte';
  import { notify, prompt } from '$lib/util/notify';
  import { closeWorkspacePanel } from '$lib/util/workspacePanels.svelte';
  import { ChevronDown, ChevronUp, Replace, ReplaceAll, Search, X } from 'lucide-svelte';

  let queryInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (globalSearch.isOpen) requestAnimationFrame(() => queryInput?.focus());
  });

  const close = (): void => {
    closeGlobalSearch();
    closeWorkspacePanel();
  };

  const replaceCurrent = (): void => {
    if (!globalSearch.current) {
      notify('当前没有可替换的匹配项。');
      return;
    }
    replaceCurrentSearchResult();
  };

  const replaceAll = (): void => {
    const count = globalSearch.results.length;
    if (count === 0) {
      notify('当前没有可替换的匹配项。');
      return;
    }
    if (prompt(`预计替换 ${count} 处用户文本。结构 ID、坐标和配置不会被修改，确定继续吗？`)) {
      replaceAllSearchResults();
    }
  };
</script>

<div class="flex h-full min-h-0 flex-col" data-testid="global-search-panel">
  <header class="flex items-center gap-2 border-b p-3">
    <Search class="size-5 text-accent" />
    <div class="min-w-0 flex-1">
      <h2 class="text-sm font-semibold">全局搜索与替换</h2>
      <p class="text-xs text-muted-foreground">仅搜索当前作品中的可编辑用户文本</p>
    </div>
    <Button size="icon" variant="ghost" title="关闭搜索" aria-label="关闭搜索" onclick={close}>
      <X class="size-4" />
    </Button>
  </header>

  <div class="flex flex-col gap-3 p-3">
    <div class="flex items-center gap-2">
      <Input
        bind:ref={queryInput}
        value={globalSearch.query}
        class="min-w-0 flex-1"
        placeholder="输入中文、英文或特殊字符"
        aria-label="搜索图表文字"
        oninput={(event) => setGlobalSearchQuery(event.currentTarget.value)} />
      <span class="min-w-14 text-right text-xs text-muted-foreground" aria-live="polite">
        {globalSearch.results.length > 0
          ? `${globalSearch.currentIndex + 1}/${globalSearch.results.length}`
          : '0 项'}
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <label class="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={globalSearch.caseSensitive}
          onchange={(event) => setGlobalSearchCaseSensitive(event.currentTarget.checked)} />
        区分大小写
      </label>
      <label class="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={globalSearch.wholeWord}
          onchange={(event) => setGlobalSearchWholeWord(event.currentTarget.checked)} />
        全词匹配
      </label>
      <div class="ml-auto flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          title="上一个匹配项"
          aria-label="上一个匹配项"
          disabled={globalSearch.results.length === 0}
          onclick={() => moveGlobalSearchResult(-1)}><ChevronUp class="size-4" /></Button>
        <Button
          size="icon"
          variant="ghost"
          title="下一个匹配项"
          aria-label="下一个匹配项"
          disabled={globalSearch.results.length === 0}
          onclick={() => moveGlobalSearchResult(1)}><ChevronDown class="size-4" /></Button>
      </div>
    </div>

    <div class="rounded-md border bg-muted/40 p-2 text-xs">
      {#if globalSearch.current}
        <span class="mr-2 rounded bg-primary px-1.5 py-0.5">{globalSearch.current.kind}</span>
        <span class="wrap-break-word">{globalSearch.current.containerText}</span>
      {:else}
        <span class="text-muted-foreground">
          {globalSearch.query ? '没有找到匹配内容' : '输入文字后会显示全部匹配结果'}
        </span>
      {/if}
    </div>

    <Input
      value={globalSearch.replacement}
      placeholder="替换为（可留空以删除文字）"
      aria-label="替换文字"
      oninput={(event) => setGlobalReplacement(event.currentTarget.value)} />

    <div class="grid grid-cols-2 gap-2">
      <Button variant="outline" disabled={!globalSearch.current} onclick={replaceCurrent}>
        <Replace class="size-4" />
        替换当前
      </Button>
      <Button disabled={globalSearch.results.length === 0} onclick={replaceAll}>
        <ReplaceAll class="size-4" />
        全部替换
      </Button>
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto border-t p-2">
    {#each globalSearch.results as result, index (result.id)}
      <button
        type="button"
        class={[
          'mb-1 flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs',
          index === globalSearch.currentIndex ? 'bg-primary' : 'hover:bg-muted'
        ]}
        onclick={() => selectGlobalSearchResult(index)}>
        <span class="mt-0.5 min-w-6 text-muted-foreground">{index + 1}</span>
        <span class="wrap-break-word">{result.containerText}</span>
      </button>
    {/each}
  </div>
</div>
