/**
 * ⑤ 이상한 자물쇠 방탈출 — pure rules (P5).
 *
 * A round is a short trip through toy rooms; the last one is the treasure room with a two-step "boss" lock.
 * Three clear steps per room (grade 1): ① tap the "?" things to find the hidden numbers (the rest are funny
 * empties) — each number flies into a sentence like `3 + ? = □`; ② think; ③ pick the lock's number from
 * three big keys, which appear once every clue is found. A wrong key only rattles the lock and dims that key
 * — nothing is lost (P2). Finding just the clue things is always enough. Each room starts with a short
 * 'enter' cut (the camera swoops in, the friend says where we are) during which input waits.
 */
import { BALANCE } from '../../domain/balance';
import { levelSpec } from '../../domain/curriculum/curriculum';
import { DEFAULT_SETTINGS, isAllowed } from '../../domain/edu/adaptive';
import { generateQuestion } from '../../domain/edu/generate';
import type { Op, Question, SkillId } from '../../domain/edu/types';
import type { Rng } from '../../domain/rng/rng';
import type { InputFrame, RoundResult, StageRules } from '../../domain/stage/types';
import { answerOptions } from '../_shared/options';
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

/** Things per room; ids 0..THINGS-1. The lock's number keys are KEY(0..KEYS-1). */
export const THINGS = 5;
export const KEYS = 3;
export const KEY = (i: number) => 100 + i;
export const OPEN_TICKS = 130;
export const JAM_TICKS = 50;
/** Room-entry cut (camera swoop + room name + narration); input waits, nothing is timed. */
export const ENTER_TICKS = 95;

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
  /** The lock's three number keys (the code + two misconception-flavoured neighbours), in key order. */
  options: number[];
}

export type EscapePhase = 'enter' | 'play' | 'open' | 'jam' | 'done';

export interface EscapeState {
  core: RoundCore;
  room: Room | null;
  /** Thing ids tapped so far in this room (clues and empties). */
  found: number[];
  /** Keys already tried in this room (dimmed). */
  tried: number[];
  phase: EscapePhase;
  phaseLeft: number;
  lastWrong: { value: number; made: number; tag?: string } | null;
  rescued: boolean;
}

export type EscapeAction =
  | { t: 'tap'; id: number }
  /** Press lock key `id` (KEY(i)); only once every clue is found. */
  | { t: 'pick'; id: number }
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
  // three keys: the code and two near misses (the question's misconception choices first)
  const options = answerOptions(q, s.code, rng, KEYS);
  return { theme, boss, ...s, things, options };
}

/** Every clue thing has been opened (the lock keys show). */
export const allFound = (room: Room, found: readonly number[]) =>
  room.things.every((t) => t.clue === null || found.includes(t.id));

/** Clue numbers of the sentence in order (null = not found yet). */
export function shownNumbers(room: Room, found: readonly number[]): (number | null)[] {
  return room.nums.map((n, i) =>
    i !== room.hole && room.things.some((t) => t.pos === i && found.includes(t.id)) ? n : null,
  );
}

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
  // the round walks through different rooms each time (seeded), the treasure room is always last
  const turn = (s.core.rng[0] >>> 0) % 4;
  const theme: RoomTheme = last ? 'treasure' : (ROOM_THEMES[(s.core.index + turn) % 4] as RoomTheme);
  const r = withRng(core, (rng) => roomFromQuestion(q, theme, last, rng));
  core = r.core;
  return {
    ...s,
    core,
    room: r.value,
    found: [],
    tried: [],
    phase: 'enter',
    phaseLeft: ENTER_TICKS,
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
    tried: [],
    phase: 'play',
    phaseLeft: 0,
    lastWrong: null,
    rescued: false,
  });
}

/** Actions that open the current room: open the clue things, then press the right key. */
export function solveEscape(s: EscapeState): EscapeAction[] {
  const room = s.room;
  if (!room) return [];
  const acts: EscapeAction[] = room.things
    .filter((t) => t.clue !== null && !s.found.includes(t.id))
    .map((t) => ({ t: 'tap', id: t.id }));
  acts.push({ t: 'pick', id: KEY(room.options.indexOf(room.code)) });
  return acts;
}

export function stepEscape(state: EscapeState, input: InputFrame<EscapeAction>): EscapeState {
  if (state.phase === 'done') return state;
  let s: EscapeState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  for (const a of input.actions) {
    const room = s.room;
    // a hint may be asked for while the room is still swooping in; everything else waits for 'play'
    if (a.t === 'hint' && room && (s.phase === 'play' || s.phase === 'enter'))
      s = { ...s, core: takeHint(s.core) };
    if (!room || s.phase !== 'play') continue;
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
    if (a.t === 'pick' && allFound(room, s.found)) {
      const given = room.options[a.id - KEY(0)];
      if (given === undefined) continue;
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
          tried: s.tried.includes(given) ? s.tried : [...s.tried, given],
          lastWrong: tag ? { value: given, made: given, tag } : { value: given, made: given },
        };
      }
    }
  }
  if (s.phase === 'enter' || s.phase === 'open' || s.phase === 'jam') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    if (s.phase === 'jam' || s.phase === 'enter') return { ...s, phase: 'play', phaseLeft: 0 };
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
