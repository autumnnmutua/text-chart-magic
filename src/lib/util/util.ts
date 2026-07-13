import { loadDataFromUrl } from './fileLoaders/loader';
import { initLoading } from './loading.svelte';
import { applyMigrations } from './migrations.svelte';
import { initURLSubscription, loadState, updateCodeStore, verifyState } from './state.svelte';
import { getAnalyticsSafeUrl, initAnalytics, plausible } from './stats';

const loadStateFromURL = (): void => {
  loadState(window.location.hash.slice(1));
};

const syncDiagram = (): void => {
  updateCodeStore({
    updateDiagram: true
  });
};

export const initHandler = async (): Promise<void> => {
  applyMigrations();
  loadStateFromURL();
  await initLoading('正在读取图表…', loadDataFromUrl().catch(console.error));
  syncDiagram();
  initURLSubscription();
  await initAnalytics();
  plausible?.trackPageview({
    url: getAnalyticsSafeUrl()
  });
  verifyState();
};

export const fetchJSON = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败：${res.status} ${res.statusText}`);
  return res.json() as T;
};
export const fetchText = async (url: string): Promise<string> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`请求失败：${res.status} ${res.statusText}`);
  return res.text();
};
