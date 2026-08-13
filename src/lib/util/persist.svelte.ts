/**
 * Runes-based localStorage persistence, shared by the persisted state in
 * `state.svelte.ts`, `migrations.svelte.ts` and History.
 *
 * Values are stored as plain JSON. Reads of missing or corrupt values fall
 * back to the provided default, so values written by older versions of the
 * editor (which serialized plain objects to the same JSON shape) stay loadable.
 */

const getStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export const readJSON = <T>(key: string, fallback: T): T => {
  const storage = getStorage();
  if (!storage) {
    return fallback;
  }
  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    // A stored literal "null" means the value is absent: the pre-runes
    // persistence layer never wrote null and treated it as missing.
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

export const writeJSON = (key: string, value: unknown): boolean => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Keep the in-memory editor usable when storage is blocked or full.
    return false;
  }
};

export interface Persisted<T> {
  readonly lastWriteSucceeded: boolean;
  value: T;
}

// A localStorage-backed reactive value. Reads on init, writes on every set.
// Raw state: replace `value` wholesale to change it. With a deep proxy,
// in-place mutation would update the UI without ever being persisted.
export const persisted = <T>(key: string, initial: T): Persisted<T> => {
  let value = $state.raw<T>(readJSON(key, initial));
  let lastWriteSucceeded = true;
  return {
    get lastWriteSucceeded() {
      return lastWriteSucceeded;
    },
    get value() {
      return value;
    },
    set value(next: T) {
      value = next;
      lastWriteSucceeded = writeJSON(key, next);
    }
  };
};
