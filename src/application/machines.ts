/**
 * The app's two top-level machines, explicit (see `domain/fsm.ts`).
 *
 * SCREENS — which screen may follow which. `store.go()` refuses anything else, so a late timer or a double
 * tap can no longer drop the child on the wrong screen.
 *
 * SESSION — one sitting inside a stage: the wordless tutorial, playing, reading a hint, and the two ways
 * out. It replaces the loose `tutorial` / `hintOpen` / `locked` / `paused` booleans: input lock, simulation
 * pause and which overlays show are all derived from the one state.
 */
import { defineMachine } from '../domain/fsm';

export type Screen = 'boot' | 'welcome' | 'placement' | 'hub' | 'intro' | 'stage' | 'result';
export type ScreenEvent =
  | 'profile.none'
  | 'profile.new'
  | 'profile.placed'
  | 'placement.done'
  | 'stage.pick'
  | 'stage.start'
  | 'back'
  | 'round.finish'
  | 'again';

export const SCREENS = defineMachine<Screen, ScreenEvent>({
  name: 'screens',
  initial: 'boot',
  states: {
    boot: { 'profile.none': 'welcome', 'profile.new': 'placement', 'profile.placed': 'hub' },
    welcome: { 'profile.new': 'placement' },
    placement: { 'placement.done': 'hub' },
    hub: { 'stage.pick': 'intro' },
    intro: { back: 'hub', 'stage.start': 'stage' },
    stage: { back: 'hub', 'round.finish': 'result', again: 'stage' },
    result: { back: 'hub', again: 'stage' },
  },
});

export type SessionState = 'tutorial' | 'playing' | 'hint' | 'finished';
export type SessionEvent =
  | 'start'
  | 'start.tutorial'
  | 'tutorial.done'
  | 'hint.open'
  | 'hint.close'
  | 'round.done';

/** A new run of the stage may begin from anywhere ("다시 하기", a first visit with the tutorial). */
const START = { start: 'playing', 'start.tutorial': 'tutorial' } as const;

export const SESSION = defineMachine<SessionState, SessionEvent>({
  name: 'stage session',
  initial: 'playing',
  states: {
    // the ghost hand shows the first puzzle: the child's input waits, no hints yet
    tutorial: { ...START, 'tutorial.done': 'playing', 'round.done': 'finished' },
    playing: { ...START, 'hint.open': 'hint', 'round.done': 'finished' },
    // the hint panel is up (a right answer or "알았어!" closes it)
    hint: { ...START, 'hint.close': 'playing', 'round.done': 'finished' },
    finished: { ...START },
  },
});

/** What each session state means for the stage (one place instead of scattered flags). */
export function sessionFlags(state: SessionState, realtime: boolean) {
  return {
    /** The runtime ignores the child's actions (the tutorial hand is demonstrating). */
    inputLocked: state === 'tutorial' || state === 'finished',
    /** Real-time stages hold the simulation while a hint is being read. */
    simPaused: realtime && state === 'hint',
    hintPanel: state === 'hint',
    tutorial: state === 'tutorial',
  };
}
