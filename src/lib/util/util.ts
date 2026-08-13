import { loadDataFromUrl } from './fileLoaders/loader';
import { MAX_REMOTE_RESPONSE_BYTES, REMOTE_FETCH_TIMEOUT_MS } from './documentSchema';
import { initLoading } from './loading.svelte';
import { applyMigrations } from './migrations.svelte';
import { notify } from './notify';
import {
  initURLSubscription,
  loadState,
  updateCodeStore,
  verifyState,
  waitForStateValidation
} from './state.svelte';
import { getAnalyticsSafeUrl, initAnalytics, plausible } from './stats';

export const loadStateFromHash = (hash: string): void => {
  loadState(hash.replace(/^#/, ''));
  syncDiagram();
};

export const loadStateFromCurrentURL = (): void => loadStateFromHash(window.location.hash);

const syncDiagram = (): void => {
  updateCodeStore({
    updateDiagram: true
  });
};

let initialization: Promise<void> | undefined;

const initialize = async (): Promise<void> => {
  applyMigrations();
  loadStateFromCurrentURL();
  await initLoading(
    '正在读取图表…',
    loadDataFromUrl().catch((error) => {
      console.error('Remote diagram loading failed.', error);
      notify('远程图表加载失败，当前本机作品没有被替换。');
    })
  );
  await waitForStateValidation();
  initURLSubscription();
  await initAnalytics();
  plausible?.trackPageview({
    url: getAnalyticsSafeUrl()
  });
  verifyState();
};

export const initHandler = (): Promise<void> => {
  initialization ??= initialize();
  return initialization;
};

const readLimitedResponse = async (response: Response): Promise<string> => {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REMOTE_RESPONSE_BYTES) {
    throw new Error('远程内容超过 2 MB');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_REMOTE_RESPONSE_BYTES) {
      throw new Error('远程内容超过 2 MB');
    }
    return new TextDecoder().decode(buffer);
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_REMOTE_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('远程内容超过 2 MB');
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join('');
};

const fetchLimitedText = async (url: string): Promise<string> => {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REMOTE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`请求失败：${response.status} ${response.statusText}`);
    }
    return await readLimitedResponse(response);
  } catch (error) {
    if (timedOut) throw new Error('远程请求超时，请稍后重试。', { cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchJSON = async <T>(url: string): Promise<T> =>
  JSON.parse(await fetchLimitedText(url)) as T;

export const fetchText = (url: string): Promise<string> => fetchLimitedText(url);
