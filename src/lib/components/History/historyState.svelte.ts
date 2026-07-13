import type { HistoryEntry, HistoryType, Optional, State } from '$lib/types';
import { diagramStateKey } from '$lib/util/diagramStateKey';
import { persisted, readJSON, type Persisted } from '$lib/util/persist.svelte';
import { inputState, normalizeState } from '$lib/util/state.svelte';
import { logEvent } from '$lib/util/stats';
import { generateSlug } from 'random-word-slugs';
import { v4 as uuidV4 } from 'uuid';

const MAX_AUTO_HISTORY_LENGTH = 30;
const AUTO_SAVE_INTERVAL = 60_000;
const LEGACY_ENTRY_NAME = '历史记录';
type LoaderHistoryEntry = Extract<HistoryEntry, { type: 'loader' }>;

const normalizeStoredEntry = (
  entry: unknown,
  fallbackType?: 'auto' | 'manual'
): HistoryEntry | null => {
  if (!entry || typeof entry !== 'object') return null;
  const candidate = entry as Partial<HistoryEntry>;
  const state = candidate.state as Partial<State> | undefined;
  const type =
    candidate.type === 'auto' || candidate.type === 'manual' ? candidate.type : fallbackType;
  if (!type || !Number.isFinite(candidate.time) || typeof state?.code !== 'string') {
    return null;
  }
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : uuidV4(),
    name:
      typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name
        : LEGACY_ENTRY_NAME,
    state: normalizeState(state),
    time: candidate.time as number,
    type
  };
};

const readStoredEntries = (key: string, type: 'auto' | 'manual'): HistoryEntry[] => {
  const value = readJSON<unknown>(key, []);
  return Array.isArray(value)
    ? value
        .map((entry) => normalizeStoredEntry(entry, type))
        .filter((entry): entry is HistoryEntry => entry !== null)
    : [];
};

const auto = persisted<HistoryEntry[]>(
  'autoHistoryStore',
  readStoredEntries('autoHistoryStore', 'auto')
);
const manual = persisted<HistoryEntry[]>(
  'manualHistoryStore',
  readStoredEntries('manualHistoryStore', 'manual')
);
const mode = persisted<HistoryType>('autoHistoryMode', 'manual');
let loader = $state<HistoryEntry[]>([]);

// Loader entries are in-memory, so a persisted 'loader' mode is empty after reload.
if (!['auto', 'manual'].includes(mode.value)) {
  mode.value = 'manual';
}

// The persisted slot backing a mode; loader is in-memory and has no slot.
const slotFor = (m: HistoryType): Persisted<HistoryEntry[]> | null => {
  switch (m) {
    case 'auto': {
      return auto;
    }
    case 'manual': {
      return manual;
    }
    default: {
      return null;
    }
  }
};

export const historyState = {
  get entries(): HistoryEntry[] {
    return slotFor(mode.value)?.value ?? loader;
  },
  get loaderEntries(): HistoryEntry[] {
    return loader;
  },
  get mode(): HistoryType {
    return mode.value;
  }
};

export const setMode = (next: HistoryType): void => {
  mode.value = next;
};

// Pan, zoom and transient render fields do not define a history revision.
export const stateKey = diagramStateKey;

const createEntry = (state: State, type: 'auto' | 'manual'): HistoryEntry => ({
  id: uuidV4(),
  name: generateSlug(2),
  state: structuredClone(state),
  time: Date.now(),
  type
});

// Returns true if added, false if it duplicated the most recent entry.
const addEntry = (
  slot: Persisted<HistoryEntry[]>,
  state: State,
  type: 'auto' | 'manual',
  maxLength?: number
): boolean => {
  const entries = slot.value;
  if (entries.length > 0 && stateKey(entries[0].state) === stateKey(state)) {
    return false;
  }
  const trimmed =
    maxLength && entries.length >= maxLength ? entries.slice(0, maxLength - 1) : entries;
  slot.value = [createEntry(state, type), ...trimmed];
  logEvent('history', { action: 'save', type });
  return true;
};

export const addManualEntry = (state: State): boolean => addEntry(manual, state, 'manual');

export const addAutoEntry = (state: State): boolean =>
  addEntry(auto, state, 'auto', MAX_AUTO_HISTORY_LENGTH);

// Replaces the in-memory revisions (e.g. when a gist is loaded), assigning ids.
export const setLoaderEntries = (entries: Optional<LoaderHistoryEntry, 'id'>[]): void => {
  loader = entries.map((entry) => ({ ...entry, id: entry.id || uuidV4() }));
};

export const removeEntry = (id: string): void => {
  const slot = slotFor(mode.value);
  if (!slot) {
    return;
  }
  slot.value = slot.value.filter((entry) => entry.id !== id);
  logEvent('history', { action: 'clear', type: 'single' });
};

export const clearActive = (): void => {
  const slot = slotFor(mode.value);
  if (!slot) {
    return;
  }
  slot.value = [];
  logEvent('history', { action: 'clear', type: 'all' });
};

const isRestorableEntry = (entry: unknown): entry is HistoryEntry => {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<HistoryEntry>;
  const state = candidate.state as Partial<State> | undefined;
  return (
    (candidate.type === 'auto' || candidate.type === 'manual') &&
    Number.isFinite(candidate.time) &&
    Boolean(state && typeof state.code === 'string')
  );
};

export interface RestoreResult {
  restored: number;
  invalid: number;
  duplicates: number;
}

// Routes each uploaded entry to the store matching its own type, skipping ids
// that already exist.
export const restoreEntries = (data: HistoryEntry[]): RestoreResult => {
  const valid = data
    .filter((entry) => isRestorableEntry(entry))
    .map((entry) => normalizeStoredEntry(entry))
    .filter((entry): entry is HistoryEntry => entry !== null);
  const invalid = data.length - valid.length;
  let restored = 0;

  const slots: [HistoryType, Persisted<HistoryEntry[]>][] = [
    ['auto', auto],
    ['manual', manual]
  ];
  for (const [type, slot] of slots) {
    const incoming = valid.filter((entry) => entry.type === type);
    if (incoming.length === 0) {
      continue;
    }
    const seenIDs = Object.fromEntries(slot.value.map(({ id }) => [id, true])) as Record<
      string,
      true
    >;
    const fresh = incoming.filter(({ id }) => {
      if (seenIDs[id]) return false;
      seenIDs[id] = true;
      return true;
    });
    restored += fresh.length;
    slot.value = [...slot.value, ...fresh].sort((a, b) => b.time - a.time);
  }

  const duplicates = valid.length - restored;
  logEvent('history', { action: 'restore', duplicates, invalid, success: restored });
  return { restored, invalid, duplicates };
};

// One-time migration: re-reads localStorage so entries written by an older
// version get normalized, then persists and updates the reactive state.
export const injectHistoryIDs = (): void => {
  auto.value = readStoredEntries('autoHistoryStore', 'auto');
  manual.value = readStoredEntries('manualHistoryStore', 'manual');
};

let autoSaveTimer: ReturnType<typeof setInterval> | undefined;

// Idempotent; returns the stop function for use as a lifecycle cleanup.
export const startAutoSave = (): (() => void) => {
  if (autoSaveTimer === undefined) {
    autoSaveTimer = setInterval(
      () => addAutoEntry($state.snapshot(inputState)),
      AUTO_SAVE_INTERVAL
    );
  }
  return stopAutoSave;
};

export const stopAutoSave = (): void => {
  if (autoSaveTimer !== undefined) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = undefined;
  }
};
