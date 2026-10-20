/**
 * Local persistence (P7): IndexedDB via `idb`, memory fallback with a parent-facing warning.
 * Writes are debounced (500 ms) and flushed on pagehide/visibilitychange (SPEC §8.3).
 */
import { type IDBPDatabase, openDB } from 'idb';
import { MAX_PROFILES, type Profile } from '../../domain/profile';
import { parseProfile } from './schema';

const DB_NAME = 'numberisland';
const DB_VERSION = 1;

export interface LogEntry {
  at: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface Store {
  readonly persistent: boolean;
  listProfiles(): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | null>;
  putProfile(p: Profile): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
  log(entry: LogEntry): Promise<void>;
  logs(): Promise<LogEntry[]>;
}

const LOG_LIMIT = 200;

export async function openStore(factory?: IDBFactory): Promise<Store> {
  try {
    const db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('profiles')) d.createObjectStore('profiles', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('logs')) d.createObjectStore('logs', { autoIncrement: true });
      },
      ...(factory ? {} : {}),
    });
    try {
      await navigator.storage?.persist?.();
    } catch {
      // best effort
    }
    return idbStore(db);
  } catch (err) {
    console.warn('[storage] IndexedDB unavailable, using memory', err, factory ? '' : '');
    return memoryStore();
  }
}

function idbStore(db: IDBPDatabase): Store {
  const store: Store = {
    persistent: true,
    async listProfiles() {
      const all = (await db.getAll('profiles')) as unknown[];
      const out: Profile[] = [];
      for (const raw of all) {
        try {
          const { profile, repaired } = parseProfile(raw);
          if (repaired.length)
            await store.log({
              at: new Date().toISOString(),
              level: 'warn',
              message: `repaired ${profile.id}: ${repaired.join(', ')}`,
            });
          out.push(profile);
        } catch (err) {
          await store.log({
            at: new Date().toISOString(),
            level: 'error',
            message: `unreadable profile: ${String(err)}`,
          });
        }
      }
      return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async getProfile(id) {
      const raw = (await db.get('profiles', id)) as unknown;
      return raw ? parseProfile(raw).profile : null;
    },
    async putProfile(p) {
      const count = await db.count('profiles');
      const exists = (await db.getKey('profiles', p.id)) !== undefined;
      if (!exists && count >= MAX_PROFILES) throw new Error('max profiles');
      await db.put('profiles', structuredClone(p));
    },
    async deleteProfile(id) {
      await db.delete('profiles', id);
    },
    async getMeta<T>(key: string) {
      return (await db.get('meta', key)) as T | undefined;
    },
    async setMeta<T>(key: string, value: T) {
      await db.put('meta', value, key);
    },
    async log(entry) {
      await db.add('logs', entry);
      const n = await db.count('logs');
      if (n > LOG_LIMIT) {
        const tx = db.transaction('logs', 'readwrite');
        let cursor = await tx.store.openCursor();
        let extra = n - LOG_LIMIT;
        while (cursor && extra > 0) {
          await cursor.delete();
          extra--;
          cursor = await cursor.continue();
        }
        await tx.done;
      }
    },
    async logs() {
      return (await db.getAll('logs')) as LogEntry[];
    },
  };
  return store;
}

export function memoryStore(): Store {
  const profiles = new Map<string, Profile>();
  const meta = new Map<string, unknown>();
  const logs: LogEntry[] = [];
  return {
    persistent: false,
    async listProfiles() {
      return [...profiles.values()].map((p) => structuredClone(p));
    },
    async getProfile(id) {
      const p = profiles.get(id);
      return p ? structuredClone(p) : null;
    },
    async putProfile(p) {
      if (!profiles.has(p.id) && profiles.size >= MAX_PROFILES) throw new Error('max profiles');
      profiles.set(p.id, structuredClone(p));
    },
    async deleteProfile(id) {
      profiles.delete(id);
    },
    async getMeta<T>(key: string) {
      return meta.get(key) as T | undefined;
    },
    async setMeta<T>(key: string, value: T) {
      meta.set(key, value);
    },
    async log(entry) {
      logs.push(entry);
      if (logs.length > LOG_LIMIT) logs.shift();
    },
    async logs() {
      return logs.slice();
    },
  };
}

/** Debounced writer with immediate flush on pagehide / hidden tab. */
export function createSaver(store: Store, delayMs = 500) {
  let pending: Profile | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const p = pending;
    pending = null;
    if (p) await store.putProfile(p);
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => void flush());
    document.addEventListener('visibilitychange', onHide);
  }
  return {
    save(p: Profile) {
      pending = p;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delayMs);
    },
    flush,
  };
}

/** gzip JSON export/import (SPEC §8.3). */
export async function exportProfiles(profiles: Profile[]): Promise<Blob> {
  const json = JSON.stringify({ app: 'numberisland', exportedAt: new Date().toISOString(), profiles });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function importProfiles(blob: Blob): Promise<Profile[]> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  const data = JSON.parse(text) as { app?: string; profiles?: unknown[] };
  if (data.app !== 'numberisland' || !Array.isArray(data.profiles))
    throw new Error('not a numberisland backup');
  return data.profiles.map((p) => parseProfile(p).profile);
}
