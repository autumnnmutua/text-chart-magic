import { notify } from './notify';
import { searchEditableSourceText, type DiagramSearchResult } from './searchModel';
import { replaceAllDiagramText, validatedState } from './state.svelte';
import { requestVisualFocus } from './visualDocument.svelte';

let open = $state(false);
let query = $state('');
let replacement = $state('');
let caseSensitive = $state(false);
let wholeWord = $state(false);
let results = $state<DiagramSearchResult[]>([]);
let currentIndex = $state(0);
let sourceFingerprint = '';

const focusCurrent = (): void => {
  const result = results[currentIndex];
  if (!result) return;
  requestVisualFocus({ occurrence: result.occurrence, text: result.containerText });
};

export const globalSearch = {
  get caseSensitive(): boolean {
    return caseSensitive;
  },
  get current(): DiagramSearchResult | undefined {
    return results[currentIndex];
  },
  get currentIndex(): number {
    return currentIndex;
  },
  get isOpen(): boolean {
    return open;
  },
  get query(): string {
    return query;
  },
  get replacement(): string {
    return replacement;
  },
  get results(): DiagramSearchResult[] {
    return results;
  },
  get wholeWord(): boolean {
    return wholeWord;
  }
};

export const refreshGlobalSearch = (code = validatedState.current.code): void => {
  const fingerprint = `${code}\u0000${query}\u0000${caseSensitive}\u0000${wholeWord}`;
  if (fingerprint === sourceFingerprint) return;
  sourceFingerprint = fingerprint;
  results = searchEditableSourceText(code, query, { caseSensitive, wholeWord });
  currentIndex = Math.min(currentIndex, Math.max(results.length - 1, 0));
  focusCurrent();
};

export const openGlobalSearch = (): void => {
  open = true;
  sourceFingerprint = '';
  refreshGlobalSearch();
};

export const closeGlobalSearch = (): void => {
  open = false;
  requestVisualFocus({});
};

export const setGlobalSearchQuery = (value: string): void => {
  query = value.slice(0, 500);
  currentIndex = 0;
  sourceFingerprint = '';
  refreshGlobalSearch();
};

export const setGlobalReplacement = (value: string): void => {
  replacement = value.slice(0, 5_000);
};

export const setGlobalSearchCaseSensitive = (value: boolean): void => {
  caseSensitive = value;
  currentIndex = 0;
  sourceFingerprint = '';
  refreshGlobalSearch();
};

export const setGlobalSearchWholeWord = (value: boolean): void => {
  wholeWord = value;
  currentIndex = 0;
  sourceFingerprint = '';
  refreshGlobalSearch();
};

export const moveGlobalSearchResult = (direction: -1 | 1): void => {
  if (results.length === 0) return;
  currentIndex = (currentIndex + direction + results.length) % results.length;
  focusCurrent();
};

export const replaceCurrentSearchResult = (): boolean => {
  const result = results[currentIndex];
  if (!result) return false;
  const replaced = replaceAllDiagramText([
    { currentText: result.text, nextText: replacement, range: result.range }
  ]);
  if (replaced > 0) {
    notify('已替换当前匹配项。');
    sourceFingerprint = '';
  }
  return replaced > 0;
};

export const replaceAllSearchResults = (): number => {
  const replaced = replaceAllDiagramText(
    results.map((result) => ({
      currentText: result.text,
      nextText: replacement,
      range: result.range
    }))
  );
  if (replaced > 0) {
    notify(`已一次替换 ${replaced} 处内容，可用撤回恢复。`);
    sourceFingerprint = '';
  }
  return replaced;
};
