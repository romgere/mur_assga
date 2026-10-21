/**
 * Petit wrapper autour de localStorage : toute lecture/écriture est protégée
 * par try/catch, avec un repli en mémoire (navigation privée, stockage
 * bloqué ou plein). Les données restent alors valables pour la session.
 */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** false dès qu'une opération sur le stockage du navigateur a échoué. */
  readonly persistent: boolean;
}

function defaultBackend(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function createStorage(backend: Storage | null = defaultBackend()): KeyValueStorage {
  const memory = new Map<string, string>();
  let persistent = backend !== null;

  return {
    get(key) {
      if (persistent && backend) {
        try {
          const value = backend.getItem(key);
          if (value !== null) memory.set(key, value);
          return value ?? memory.get(key) ?? null;
        } catch {
          persistent = false;
        }
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
      if (persistent && backend) {
        try {
          backend.setItem(key, value);
        } catch {
          persistent = false;
        }
      }
    },
    remove(key) {
      memory.delete(key);
      if (persistent && backend) {
        try {
          backend.removeItem(key);
        } catch {
          persistent = false;
        }
      }
    },
    get persistent() {
      return persistent;
    },
  };
}

export const storage = createStorage();

export function readJson<T>(store: KeyValueStorage, key: string): T | null {
  const raw = store.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJson(store: KeyValueStorage, key: string, value: unknown): void {
  store.set(key, JSON.stringify(value));
}
