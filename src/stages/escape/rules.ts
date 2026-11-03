/**
 * ⑤ 이상한 자물쇠 방탈출 — pure rules (P5).
 *
 * A round is a short trip through toy rooms; the last one is the treasure room with a two-step "boss" lock.
 * In each room some things hide a number clue (the rest are funny empties). The clues fill a sentence like
 * `3 + ? = □`; the □ is the lock code, set with two number wheels and tried with "열어요!". A wrong code
 * only rattles the lock — nothing is lost, the wheels stay where they were (P2). Even if the child finds
 * just the clue things (never the empties), the room is always solvable.
 */
import { BALANCE } from '../../domain/balance';
import { levelSpec } from '../../domain/curriculum/curriculum';
import { DEFAULT_SETTINGS, isAllowed } from '../../domain/edu/adaptive';
import { generateQuestion } from '../../domain/edu/generate';
import type { Op, Question, SkillId } from '../../domain/edu/types';
import type { Rng } from '../../domain/rng/rng';
import type { InputFrame, RoundResult, StageRules } from '../../domain/stage/types';
import {
  advancePuzzle,
  initRound,
  nextStageQuestion,
  type RoundCore,
  type RoundOptions,
  recordAttempt,
  roundSummary,
  sameKindQuestion,
  takeHint,
  withRng,
} from '../_shared/round';

export const ESCAPE_SKILLS: readonly SkillId[] = [
  'ADD_NOCARRY',
  'ADD_CARRY',
  'SUB_NOBORROW',
  'SUB_BORROW',
  'MISSING_TERM',
  'COMPOSE_10',
  'THREE_TERM',
];

export const ROOM_THEMES = ['kitchen', 'study', 'attic', 'garden', 'treasure'] as const;
export type RoomTheme = (typeof ROOM_THEMES)[number];

/** Things per room; ids 0..THINGS-1. Dial controls and the handle use the ids below. */
export const THINGS = 5;
export const DIAL_UP = (wheel: number) => 100 + wheel * 2;
export const DIAL_DOWN = (wheel: number) => 101 + wheel * 2;
export const HANDLE = 110;
export const WHEELS = 2;
export const OPEN_TICKS = 100;
export const JAM_TICKS = 50;

export interface Thing {
  id: number;
  /** Which prop model of the room theme (0..5). */
  kind: number;
  /** The number it hides, or null for a funny empty. */
  clue: number | null;
  /** Which number of the sentence that is (index into `Room.nums`). */
  pos: number | null;
}

export interface Room {
  theme: RoomTheme;
  boss: boolean;
  /** The number sentence: nums[i] (op[i] between them) with nums[last] the result; `hole` = the code. */
  nums: number[];
  ops: Op[];
  hole: number;
  code: number;
  things: Thing[];
}

export type EscapePhase = 'play' | 'open' | 'jam' | 'done';

export interface EscapeState {
  core: RoundCore;
  room: Room | null;
  /** Thing ids tapped so far in this room (clues and empties). */
  found: number[];
  /** Wheel digits (tens, ones). */
  dial: number[];
  phase: EscapePhase;
  phaseLeft: number;
  lastWrong: { value: number; made: number; tag?: string } | null;
  rescued: boolean;
}

export type EscapeAction =
  | { t: 'tap'; id: number }
  | { t: 'dial'; wheel: number; dir: 1 | -1 }
  | { t: 'open' }
  | { t: 'hint' }
  | { t: 'retry' };

/** Questions that make a good lock: a sentence of 2–3 numbers + its result, every number 0..99. */
export function preferEscape(q: Question): boolean {
  if (q.form !== 'EXPR' && q.form !== 'MISSING') return false;
  if (q.operands.length < 2 || q.operands.length > 3) return false;
  const s = sentence(q);
  return s.nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 99) && s.code >= 0 && s.code <= 99;
}

/** The question as `nums` (operands then result) with the code's position. */
export function sentence(q: Question): { nums: number[]; ops: Op[]; hole: number; code: number } {
  const result = q.result;
  const nums = [...q.operands, q.form === 'MISSING' && q.missingIndex !== -1 ? result : q.answer];
  const hole =
    q.form === 'MISSING' && q.missingIndex !== undefined && q.missingIndex >= 0
      ? q.missingIndex
      : q.operands.length;
  nums[hole] = q.answer;
  return { nums, ops: q.ops.slice(), hole, code: q.answer };
}

export function roomFromQuestion(q: Question, theme: RoomTheme, boss: boolean, rng: Rng): Room {
  const s = sentence(q);
  const kinds = rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, THINGS);
  const slots = rng.shuffle([...Array(THINGS).keys()]);
  const things: Thing[] = kinds.map((kind, id) => ({ id, kind, clue: null, pos: null }));
  let k = 0;
  s.nums.forEach((v, i) => {
    if (i === s.hole) return;
    const t = things[slots[k++] as number];
    if (t) {
      t.clue = v;
      t.pos = i;
    }
  });
  return { theme, boss, ...s, things };
}

/** Clue numbers of the sentence in order (null = not found yet). */
export function shownNumbers(room: Room, found: readonly number[]): (number | null)[] {
  return room.nums.map((n, i) =>
    i !== room.hole && room.things.some((t) => t.pos === i && found.includes(t.id)) ? n : null,
  );
}

const dialValue = (d: readonly number[]) => (d[0] ?? 0) * 10 + (d[1] ?? 0);

function bossQuestion(core: RoundCore, rng: Rng, avoid: readonly string[]): Question | null {
  const settings = { ...DEFAULT_SETTINGS, term: core.term };
  if (!isAllowed(levelSpec('A6'), settings)) return null;
  for (let i = 0; i < 120; i++) {
    const q = generateQuestion({ level: 'A6', skill: 'THREE_TERM', rng, avoid });
    if (q.form === 'EXPR' && q.operands.length === 3 && preferEscape(q)) return q;
  }
  return null;
}

function newRoom(s: EscapeState): EscapeState {
  const last = s.core.index + 1 >= s.core.puzzles;
  let core = nextStageQuestion(
    s.core,
    ESCAPE_SKILLS,
    preferEscape,
    last ? (rng, avoid) => bossQuestion(s.core, rng, avoid) : undefined,
  );
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  const theme: RoomTheme = last ? 'treasure' : (ROOM_THEMES[s.core.index % 4] as RoomTheme);
  const r = withRng(core, (rng) => roomFromQuestion(q, theme, last, rng));
  core = r.core;
  return {
    ...s,
    core,
    room: r.value,
    found: [],
    dial: Array(WHEELS).fill(0),
    phase: 'play',
    phaseLeft: 0,
    lastWrong: null,
  };
}

export function initEscape(
  seed: number | string,
  level: Parameters<typeof initRound>[2],
  opts: RoundOptions = {},
): EscapeState {
  return newRoom({
    core: initRound('escape', seed, level, { ...opts, puzzles: opts.puzzles ?? BALANCE.escape.rooms }),
    room: null,
    found: [],
    dial: Array(WHEELS).fill(0),
    phase: 'play',
    phaseLeft: 0,
    lastWrong: null,
    rescued: false,
  });
}

/** Actions that open the current room: find the clue things, turn the wheels, try the handle. */
export function solveEscape(s: EscapeState): EscapeAction[] {
  const room = s.room;
  if (!room) return [];
  const acts: EscapeAction[] = room.things
    .filter((t) => t.clue !== null && !s.found.includes(t.id))
    .map((t) => ({ t: 'tap', id: t.id }));
  const want = [Math.floor(room.code / 10), room.code % 10];
  want.forEach((digit, wheel) => {
    const diff = (digit - (s.dial[wheel] ?? 0) + 10) % 10;
    const dir: 1 | -1 = diff <= 5 ? 1 : -1;
    for (let k = 0; k < (diff <= 5 ? diff : 10 - diff); k++) acts.push({ t: 'dial', wheel, dir });
  });
  acts.push({ t: 'open' });
  return acts;
}

export function stepEscape(state: EscapeState, input: InputFrame<EscapeAction>): EscapeState {
  if (state.phase === 'done') return state;
  let s: EscapeState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  for (const a of input.actions) {
    const room = s.room;
    if (!room || s.phase !== 'play') continue;
    if (a.t === 'hint') s = { ...s, core: takeHint(s.core) };
    if (a.t === 'retry' && s.core.puzzleHints >= 4) {
      const core = sameKindQuestion(s.core, preferEscape);
      const q = core.asked?.question;
      if (q) {
        const r = withRng(core, (rng) => roomFromQuestion(q, room.theme, room.boss, rng));
        s = { ...s, core: r.core, room: r.value, found: [], lastWrong: null };
      }
    }
    if (a.t === 'tap' && room.things.some((t) => t.id === a.id) && !s.found.includes(a.id))
      s = { ...s, found: [...s.found, a.id] };
    if (a.t === 'dial' && a.wheel >= 0 && a.wheel < WHEELS) {
      const dial = s.dial.slice();
      dial[a.wheel] = ((dial[a.wheel] ?? 0) + a.dir + 10) % 10;
      s = { ...s, dial };
    }
    if (a.t === 'open') {
      const given = dialValue(s.dial);
      const q = s.core.asked?.question;
      if (given === room.code) {
        s = { ...s, core: recordAttempt(s.core, true, given), phase: 'open', phaseLeft: OPEN_TICKS };
      } else {
        const tag = q?.misconceptionMap[given];
        s = {
          ...s,
          core: recordAttempt(s.core, false, given, tag),
          phase: 'jam',
          phaseLeft: JAM_TICKS,
          lastWrong: tag ? { value: given, made: given, tag } : { value: given, made: given },
        };
      }
    }
  }
  if (s.phase === 'open' || s.phase === 'jam') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    if (s.phase === 'jam') return { ...s, phase: 'play', phaseLeft: 0 };
    const rescued = s.rescued || !!s.room?.boss;
    const core = advancePuzzle(s.core);
    if (core.done) return { ...s, core, phase: 'done', rescued };
    return newRoom({ ...s, core, rescued });
  }
  return s;
}

export const escapeRules: StageRules<EscapeState, EscapeAction> = {
  id: 'escape',
  init: (seed, level, opts) => initEscape(seed, level, opts),
  step: stepEscape,
  isDone: (s) => s.phase === 'done',
  summary: (s): RoundResult => {
    const r = roundSummary(s.core);
    return { ...r, highlights: s.rescued ? [...r.highlights, 'rescued'] : r.highlights };
  },
};
