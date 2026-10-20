/**
 * Game store (zustand vanilla, shared by React UI and the game core). Holds screen + profile state only;
 * persistence is wired in infra by subscribing to `profile`.
 */
import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import type { Profile } from '../../domain/profile';
import type { ApplyOutcome } from '../../domain/progression/progression';
import type { RoundResult, StageId } from '../../domain/stage/types';

export type Screen = 'boot' | 'welcome' | 'placement' | 'hub' | 'intro' | 'stage' | 'result';
export type DifficultyShift = -1 | 0 | 1;

export interface GameState {
  screen: Screen;
  profile: Profile | null;
  selected: StageId;
  shift: DifficultyShift;
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
  setShift(shift: DifficultyShift): void;
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
      shift: 0,
      lastResult: null,
      lastOutcome: null,
      storageWarning: false,
      runId: 0,
      go: (screen) => set({ screen }),
      setProfile: (profile) => set({ profile }),
      select: (selected) => set({ selected }),
      setShift: (shift) => set({ shift }),
      finishRound: (lastResult, lastOutcome) =>
        set({ lastResult, lastOutcome, profile: lastOutcome.profile, screen: 'result' }),
      restart: () => set((s) => ({ runId: s.runId + 1, screen: 'stage' })),
      setStorageWarning: (storageWarning) => set({ storageWarning }),
    })),
  );
}
