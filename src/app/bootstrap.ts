/** Boot: open storage, load or create the profile, wire debounced saving (SPEC §8.3). */
import { createGameStore, type GameStore } from '../application/stores/game';
import { defaultProfile, type Profile } from '../domain/profile';
import { createSaver, openStore, type Store } from '../infra/storage/store';

export interface App {
  store: GameStore;
  db: Store;
  flush(): Promise<void>;
}

export async function bootApp(): Promise<App> {
  const store = createGameStore();
  const db = await openStore();
  store.getState().setStorageWarning(!db.persistent);
  const saver = createSaver(db);
  const profiles = await db.listProfiles();
  const lastId = await db.getMeta<string>('lastProfile');
  const profile = profiles.find((p) => p.id === lastId) ?? profiles[0];
  if (profile) {
    store.getState().setProfile(profile);
    store.getState().go(profile.placementDone ? 'hub' : 'placement');
  } else {
    store.getState().go('welcome');
  }
  store.subscribe(
    (s) => s.profile,
    (p) => {
      if (p) saver.save(p);
    },
  );
  (globalThis as { __store?: GameStore }).__store = store;
  return { store, db, flush: () => saver.flush() };
}

export function newProfile(nickname: string): Profile {
  const id = `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return defaultProfile(id, nickname.slice(0, 12), new Date().toISOString());
}
