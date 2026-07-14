import { loadDataFromUrl } from './fileLoaders/loader';
import { initLoading } from './loading.svelte';
import { applyMigrations } from './migrations.svelte';
import {
  initURLSubscription,
  loadState,
  updateCodeStore,
  verifyState,
  waitForStateValidation
} from './state.svelte';
import { getAnalyticsSafeUrl, initAnalytics, plausible } from './stats';

export const loadStateFromCurrentURL = (): void => {
  loadState(window.location.hash.slice(1));
  syncDiagram();
};

const syncDiagram = (): void => {
  updateCodeStore({
    updateDiagram: true
  });
};

let initialization: Promise<void> | undefined;

const initialize = async (): Promise<void> => {
  applyMigrations();
  loadStateFromCurrentURL();
  await initLoading('正在读取图表…', loadDataFromUrl().catch(console.error));
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
