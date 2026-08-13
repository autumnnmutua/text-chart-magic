<script lang="ts">
  import Card from '$lib/components/Card/Card.svelte';
  import type { HistoryEntry, HistoryType, State, Tab } from '$lib/types';
  import {
    MAX_DOCUMENT_FILE_BYTES,
    MAX_HISTORY_FILE_BYTES,
    MAX_HISTORY_IMPORT_ENTRIES
  } from '$lib/util/documentSchema';
  import { createDocumentBackup, parseDocumentBackup } from '$lib/util/documentFile';
  import { parse } from '$lib/util/mermaid';
  import { notify, prompt } from '$lib/util/notify';
  import { serializeState } from '$lib/util/serde';
  import { inputState, replaceInputState, sanitizeConfig } from '$lib/util/state.svelte';
  import { saveCurrentWorkspaceWithFeedback } from '$lib/util/workspaceSave.svelte';
  import { clearVisualSelection } from '$lib/util/visualSelection.svelte';
  import { logEvent } from '$lib/util/stats';
  import dayjs from 'dayjs';
  import 'dayjs/locale/zh-cn';
  import dayjsRelativeTime from 'dayjs/plugin/relativeTime';
  import BookmarkIcon from '~icons/material-symbols/bookmark-outline-rounded';
  import TrashAltIcon from '~icons/material-symbols/delete-outline-rounded';
  import DownloadIcon from '~icons/material-symbols/download-rounded';
  import SaveIcon from '~icons/material-symbols/save-outline-rounded';
  import UndoIcon from '~icons/material-symbols/settings-backup-restore-rounded';
  import UploadIcon from '~icons/material-symbols/upload-rounded';
  import HistoryIcon from '~icons/mdi/clock-outline';
  import GitAltIcon from '~icons/mdi/git';
  import OpenInNewIcon from '~icons/material-symbols/open-in-new-rounded';
  import { FileDown, FileUp } from 'lucide-svelte';
  import { Button } from '../ui/button';
  import { Separator } from '../ui/separator';
  import {
    clearActive,
    historyState,
    removeEntry,
    restoreEntries,
    setMode
  } from './historyState.svelte';

  dayjs.extend(dayjsRelativeTime);
  dayjs.locale('zh-cn');

  const baseTabs: Tab[] = [
    { id: 'manual', title: '本机版本', icon: BookmarkIcon },
    { id: 'auto', title: '时间线', icon: HistoryIcon }
  ];
  const loaderTab: Tab = { id: 'loader', title: '修订记录', icon: GitAltIcon };

  const tabs = $derived(
    historyState.loaderEntries.length > 0 ? [loaderTab, ...baseTabs] : baseTabs
  );

  // Surface revisions once when they first appear; the user can switch away after.
  let revisionsShown = false;
  $effect(() => {
    if (historyState.loaderEntries.length > 0 && !revisionsShown) {
      revisionsShown = true;
      setMode('loader');
    }
  });

  const emptyMessage = $derived(
    historyState.mode === 'auto'
      ? '还没有时间线快照。\n编辑器会每分钟自动保存一次。'
      : '还没有本机版本。\n点击保存按钮即可在当前浏览器中保留图表，之后可以随时恢复。'
  );

  const tabSelectHandler = (tab: Tab) => {
    setMode(tab.id as HistoryType);
  };

  const downloadHistory = () => {
    const data = historyState.entries;
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mermaid-history-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logEvent('history', { action: 'download' });
  };

  const downloadDocument = (): void => {
    try {
      const blob = new Blob([createDocumentBackup($state.snapshot(inputState))], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `text-chart-magic-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`;
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      notify('已导出当前作品的完整本机备份。');
    } catch (error) {
      console.error('Document backup export failed.', error);
      notify('作品备份导出失败，请减少内容后重试。');
    }
  };

  const uploadDocument = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async ({ target }: Event) => {
      const file = (target as HTMLInputElement)?.files?.[0];
      if (!file) return;
      try {
        if (file.size > MAX_DOCUMENT_FILE_BYTES) {
          throw new Error('作品文件超过 4 MB。');
        }
        const next = parseDocumentBackup(await file.text());
        await parse(next.code);
        next.mermaid = sanitizeConfig(next.mermaid);
        JSON.parse(next.mermaid);
        clearVisualSelection();
        replaceInputState({ ...next, updateDiagram: true });
        notify('完整作品已导入，可用撤回恢复导入前的状态。');
      } catch (error) {
        console.error('Document backup import failed.', error);
        notify(error instanceof Error ? `导入失败：${error.message}` : '作品导入失败。');
      }
    });
    input.click();
  };

  const uploadHistory = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.addEventListener('change', async ({ target }: Event) => {
      const file = (target as HTMLInputElement)?.files?.[0];
      if (!file) {
        return;
      }
      try {
        if (file.size > MAX_HISTORY_FILE_BYTES) {
          throw new Error('history file is too large');
        }
        const data: unknown = JSON.parse(await file.text());
        if (!Array.isArray(data)) throw new Error('history must be an array');
        if (data.length > MAX_HISTORY_IMPORT_ENTRIES) {
          throw new Error('history has too many entries');
        }
        const { restored, invalid, duplicates, failed } = restoreEntries(data as HistoryEntry[]);
        notify(
          `已恢复 ${restored} 条，跳过 ${duplicates} 条重复记录，发现 ${invalid} 条无效记录${
            failed > 0 ? `，另有 ${failed} 条因浏览器存储不可用而未写入` : ''
          }。`
        );
      } catch {
        notify('导入失败：请选择由本编辑器导出的有效历史记录文件。');
      }
    });
    input.click();
  };

  const saveHistory = (): void => {
    void saveCurrentWorkspaceWithFeedback();
  };

  const clearAll = () => {
    if (prompt('确定清空当前列表里的所有记录吗？')) {
      if (!clearActive()) notify('清空失败：浏览器存储不可用，记录仍然保留。');
    }
  };

  const removeHistoryEntry = (id: string): void => {
    if (!prompt('确定删除这个本机版本吗？此操作不会修改当前画布。')) return;
    if (!removeEntry(id)) notify('删除失败：浏览器存储不可用，记录仍然保留。');
  };

  const restoreHistoryItem = (state: State): void => {
    clearVisualSelection();
    replaceInputState({ ...state, updateDiagram: true });
  };

  // Absolute editor URL for an entry, so the link can be opened in a new tab or copied.
  const entryUrl = (state: State): string | undefined => {
    try {
      return `${window.location.origin}${window.location.pathname}#${serializeState(state)}`;
    } catch {
      return undefined;
    }
  };

  // Serialize each entry's URL once per change rather than per row on every render.
  const entriesWithUrl = $derived(
    historyState.entries.map((entry) => ({ ...entry, openUrl: entryUrl(entry.state) }))
  );
</script>

<Card onselect={tabSelectHandler} isOpen isClosable={false} {tabs} activeTabID={historyState.mode}>
  {#snippet actions()}
    <div class="flex items-center gap-2">
      <Button size="icon" variant="ghost" onclick={uploadDocument} title="导入完整作品"
        ><FileUp class="size-5" /></Button>
      <Button size="icon" variant="ghost" onclick={downloadDocument} title="导出当前作品备份"
        ><FileDown class="size-5" /></Button>
      <Separator orientation="vertical" />
      <Button
        size="icon"
        variant="ghost"
        id="uploadHistory"
        onclick={uploadHistory}
        title="导入版本列表"><UploadIcon /></Button>
      {#if historyState.entries.length > 0}
        <Button
          id="downloadHistory"
          size="icon"
          variant="ghost"
          onclick={downloadHistory}
          title="导出版本列表"><DownloadIcon /></Button>
      {/if}
      <Separator orientation="vertical" />
      <Button
        id="saveHistory"
        size="icon"
        variant="ghost"
        onclick={saveHistory}
        title="保存本机版本"><SaveIcon /></Button>
      {#if historyState.mode !== 'loader'}
        <Button
          id="clearHistory"
          size="icon"
          variant="ghost"
          class="hover:text-destructive"
          onclick={clearAll}
          disabled={historyState.entries.length === 0}
          title="清空当前列表"><TrashAltIcon /></Button>
      {/if}
    </div>
  {/snippet}
  <ul class="flex h-full min-w-fit flex-col gap-2 overflow-auto p-2" id="historyList">
    {#if entriesWithUrl.length > 0}
      {#each entriesWithUrl as { id, state, time, name, url, type, openUrl } (id)}
        <li class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              {#if url}
                <a
                  href={url}
                  target="_blank"
                  title="在新标签页打开修订版本"
                  class="text-blue-500 hover:underline">{name}</a>
              {:else}
                <span class="whitespace-nowrap">{name}</span>
              {/if}
              <span class="text-xs whitespace-nowrap text-primary-foreground/30">
                {new Date(time).toLocaleString()}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-sm whitespace-nowrap text-primary-foreground/50">
                {dayjs(time).fromNow()}
              </span>
              {#if openUrl}
                <Button
                  href={openUrl}
                  target="_blank"
                  rel="noopener"
                  size="icon"
                  variant="ghost"
                  title="在新标签页打开">
                  <OpenInNewIcon />
                </Button>
              {:else}
                <Button
                  disabled
                  size="icon"
                  variant="ghost"
                  title="这个版本较大，请导出作品备份后在其他设备打开">
                  <OpenInNewIcon />
                </Button>
              {/if}
              <Button
                size="icon"
                variant="ghost"
                title="恢复这个版本"
                onclick={() => restoreHistoryItem(state)}>
                <UndoIcon />
              </Button>
              {#if type !== 'loader'}
                <Button
                  size="icon"
                  variant="ghost"
                  class="hover:text-destructive"
                  title="删除这个版本"
                  onclick={() => removeHistoryEntry(id)}>
                  <TrashAltIcon />
                </Button>
              {/if}
            </div>
          </div>
          <Separator />
        </li>
      {/each}
    {:else}
      <div class="m-2 text-center whitespace-pre-line">{emptyMessage}</div>
    {/if}
  </ul>
</Card>
