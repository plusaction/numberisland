/**
 * Game store (zustand vanilla, shared by React UI and the game core). Holds screen + profile state only;
 * persistence is wired in infra by subscribing to `profile`.
 */
import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import { allows } from '../../domain/fsm';
import type { Profile } from '../../domain/profile';
import type { ApplyOutcome } from '../../domain/progression/progression';
import type { RoundResult, StageId } from '../../domain/stage/types';
import { SCREENS, type Screen } from '../machines';

export type { Screen } from '../machines';

export interface GameState {
  screen: Screen;
  profile: Profile | null;
  selected: StageId;
  /** Map picked on the island card per stage (unset = the newest open map). */
  mapPick: Partial<Record<StageId, number>>;
  lastResult: RoundResult | null;
  lastOutcome: ApplyOutcome | null;
  storageWarning: boolean;
  /** Incremented to restart the same stage ("다시 하기"). */
  runId: number;
}

export interface GameActions {
  go(screen: Screen): void;
  setProfile(p: Profile): void;
  select(stage: StageId): void;
  pickMap(stage: StageId, map: number): void;
  finishRound(result: RoundResult, outcome: ApplyOutcome): void;
  restart(): void;
  setStorageWarning(on: boolean): void;
}

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore() {
  return createStore<GameState & GameActions>()(
    subscribeWithSelector((set) => ({
      screen: 'boot',
      profile: null,
      selected: 'fishing',
      mapPick: {},
      lastResult: null,
      lastOutcome: null,
      storageWarning: false,
      runId: 0,
      // screens follow the SCREENS machine: a move it does not list is refused (and reported), never applied
      go: (screen) =>
        set((s) => {
          if (s.screen === screen) return s;
          if (allows(SCREENS, s.screen, screen)) return { screen };
          console.warn(`[screens] refused ${s.screen} → ${screen}`);
          return s;
        }),
      setProfile: (profile) => set({ profile }),
      select: (selected) => set({ selected }),
      pickMap: (stage, map) => set((s) => ({ mapPick: { ...s.mapPick, [stage]: map } })),
      finishRound: (lastResult, lastOutcome) =>
        set((s) =>
          // only a running stage can hand over a result (a late timer after "나가기" changes nothing)
          s.screen === 'stage'
            ? { lastResult, lastOutcome, profile: lastOutcome.profile, screen: 'result' }
            : s,
        ),
      restart: () =>
        set((s) => (allows(SCREENS, s.screen, 'stage') ? { runId: s.runId + 1, screen: 'stage' } : s)),
      setStorageWarning: (storageWarning) => set({ storageWarning }),
    })),
  );
}

/** The map a stage starts on: the one picked on the card if it is open, else the newest open map. */
export function currentMap(s: Pick<GameState, 'mapPick' | 'profile'>, stage: StageId): number {
  const open = Math.max(1, s.profile?.maps?.[stage] ?? 1);
  const pick = s.mapPick[stage];
  return pick !== undefined && pick >= 0 && pick < open ? pick : open - 1;
}
