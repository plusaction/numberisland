/**
 * ③ 숫자 낚시 — pure rules (P5/P6). Target panel: sum T / difference T / □ + k = T.
 * Tap two fish (or one for □) → reel in when right, splash back when wrong. Odd fish = free coins.
 */
import { BALANCE } from '../../domain/balance';
import { levelSpec } from '../../domain/curriculum/curriculum';
import type { Op, Question, SkillId } from '../../domain/edu/types';
import type { Rng } from '../../domain/rng/rng';
import type { InputFrame, RoundResult, StageRules } from '../../domain/stage/types';
import {
  advancePuzzle,
  bandOf,
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

export const FISHING_SKILLS: readonly SkillId[] = [
  'ADD_NOCARRY',
  'ADD_CARRY',
  'SUB_NOBORROW',
  'SUB_BORROW',
  'MISSING_TERM',
];

export type FishMode = 'sum' | 'diff' | 'missing';

export interface Fish {
  id: number;
  value: number;
  /** Swim parameters (view only, deterministic). */
  lane: number;
  phase: number;
  speed: number;
  caught: boolean;
}

export interface FishPuzzle {
  mode: FishMode;
  target: number;
  /** For 'missing': the shown number and operator (□ op k = target, or k op □ = target). */
  known?: number;
  op?: Op;
  /** 0: □ first, 1: □ second */
  blank?: 0 | 1;
  fish: Fish[];
}

export interface OddFish {
  id: number;
  kind: 0 | 1 | 2; // boot, duck, key
  born: number;
  life: number;
  lane: number;
}

export type FishingPhase = 'play' | 'reel' | 'bounce' | 'done';

export interface FishingState {
  core: RoundCore;
  puzzle: FishPuzzle | null;
  picked: number[];
  phase: FishingPhase;
  phaseLeft: number;
  odd: OddFish | null;
  nextOdd: number;
  oddCaught: number;
  /** Last wrong pick (for the feedback overlay): picked value(s) → what they make vs the target. */
  lastWrong: { value: number; made: number; tag?: string } | null;
  /** Fish ids reeled in this puzzle (signature moment). */
  reeled: number[];
}

export type FishingAction = { t: 'tap'; id: number } | { t: 'hint' } | { t: 'odd' } | { t: 'retry' };

export const REEL_TICKS = 70;
export const BOUNCE_TICKS = 40;

/** Every selection that solves the puzzle (sorted id lists). */
export function solveFishing(p: FishPuzzle): number[][] {
  const out: number[][] = [];
  const live = p.fish.filter((f) => !f.caught);
  if (p.mode === 'missing') {
    for (const f of live) if (missingOk(p, f.value)) out.push([f.id]);
    return out;
  }
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i] as Fish;
      const b = live[j] as Fish;
      if (pairOk(p, a.value, b.value)) out.push([a.id, b.id]);
    }
  }
  return out;
}

function pairOk(p: FishPuzzle, a: number, b: number): boolean {
  return p.mode === 'sum' ? a + b === p.target : Math.abs(a - b) === p.target;
}

function missingOk(p: FishPuzzle, x: number): boolean {
  const k = p.known ?? 0;
  if (p.op === '+') return x + k === p.target;
  return p.blank === 0 ? x - k === p.target : k - x === p.target;
}

/** Build a puzzle from an education question; distractors come from its misconception choices. */
export function puzzleFromQuestion(q: Question, rng: Rng): FishPuzzle {
  const band = bandOf(q.level);
  const count = band === 'A' ? 6 : band === 'B' ? 7 : 8;
  const [a = 0, b = 0] = q.operands;
  const op = (q.ops[0] ?? '+') as Op;
  let mode: FishMode;
  let target: number;
  const correct: number[] = [];
  const extra: Partial<FishPuzzle> = {};
  if (q.form === 'MISSING' && q.missingIndex !== undefined && q.missingIndex >= 0) {
    mode = 'missing';
    target = q.result;
    extra.known = q.missingIndex === 0 ? b : a;
    extra.op = op;
    extra.blank = q.missingIndex === 0 ? 0 : 1;
    correct.push(q.answer);
  } else {
    mode = op === '+' ? 'sum' : 'diff';
    target = q.answer;
    correct.push(a, b);
  }
  // correct values may repeat (4 − 4): keep them as separate fish; distractors are unique and different
  const values: number[] = correct.slice();
  const used = new Set<number>(correct);
  const cands: number[] = [];
  for (const c of q.choices) if (c.value !== q.answer) cands.push(c.value);
  for (const base of correct) for (const d of [1, -1, 10, -10, 2, 100, -100]) cands.push(base + d);
  // pieces never exceed the level's number ceiling (curriculum range)
  const max = Math.min(levelSpec(q.level).max, Math.max(...correct, target) * 2 + 10);
  const push = (v: number) => {
    if (values.length < count && Number.isInteger(v) && v >= 0 && v <= max && !used.has(v)) {
      used.add(v);
      values.push(v);
    }
  };
  for (const v of rng.shuffle(cands)) push(v);
  for (let i = 0; values.length < count && i < 200; i++) push(rng.int(0, Math.max(10, max)));
  const fish: Fish[] = rng.shuffle(values).map((value, id) => ({
    id,
    value,
    lane: id,
    phase: rng.float() * Math.PI * 2,
    speed: 0.25 + rng.float() * 0.2,
    caught: false,
  }));
  return { mode, target, fish, ...extra };
}

/** Fishing needs real parts: no 0 operands and no 0 target. */
export function preferFishing(q: Question): boolean {
  return q.answer > 0 && q.result > 0 && q.operands.every((v) => v > 0);
}

function newPuzzle(s: FishingState): FishingState {
  let core = nextStageQuestion(s.core, FISHING_SKILLS, preferFishing);
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  const r = withRng(core, (rng) => puzzleFromQuestion(q, rng));
  core = r.core;
  return {
    ...s,
    core,
    puzzle: r.value,
    picked: [],
    phase: 'play',
    phaseLeft: 0,
    lastWrong: null,
    reeled: [],
  };
}

/** New numbers, same kind of problem (after the hint-4 demo). */
function retryPuzzle(s: FishingState): FishingState {
  let core = sameKindQuestion(s.core, preferFishing);
  const q = core.asked?.question;
  if (!q) return s;
  const r = withRng(core, (rng) => puzzleFromQuestion(q, rng));
  core = r.core;
  return { ...s, core, puzzle: r.value, picked: [], lastWrong: null };
}

export function initFishing(
  seed: number | string,
  level: Parameters<typeof initRound>[2],
  opts: RoundOptions = {},
): FishingState {
  const core = initRound('fishing', seed, level, opts);
  const base: FishingState = {
    core,
    puzzle: null,
    picked: [],
    phase: 'play',
    phaseLeft: 0,
    odd: null,
    nextOdd: 60 * 8,
    oddCaught: 0,
    lastWrong: null,
    reeled: [],
  };
  return newPuzzle(base);
}

function evaluate(s: FishingState): FishingState {
  const p = s.puzzle;
  const q = s.core.asked?.question;
  if (!p || !q) return s;
  const need = p.mode === 'missing' ? 1 : 2;
  if (s.picked.length < need) return s;
  const vals = s.picked.map((id) => p.fish.find((f) => f.id === id)?.value ?? 0);
  const ok = p.mode === 'missing' ? missingOk(p, vals[0] ?? -1) : pairOk(p, vals[0] ?? 0, vals[1] ?? 0);
  // what the child effectively answered (for misconception feedback)
  const given =
    p.mode === 'missing'
      ? (vals[0] ?? 0)
      : p.mode === 'sum'
        ? (vals[0] ?? 0) + (vals[1] ?? 0)
        : Math.abs((vals[0] ?? 0) - (vals[1] ?? 0));
  // what the picks make on the target panel (□ mode: the equation's result)
  const k = p.known ?? 0;
  const x = vals[0] ?? 0;
  const made = p.mode === 'missing' ? (p.op === '+' ? x + k : p.blank === 0 ? x - k : k - x) : given;
  // misconception tags only describe the *answer slot* (□ mode); in pair mode the child chose fish, not a result
  const tag = p.mode === 'missing' ? q.misconceptionMap[given] : undefined;
  if (ok) {
    const core = recordAttempt(s.core, true, given);
    const fish = p.fish.map((f) => (s.picked.includes(f.id) ? { ...f, caught: true } : f));
    return {
      ...s,
      core,
      puzzle: { ...p, fish },
      phase: 'reel',
      phaseLeft: REEL_TICKS,
      reeled: s.picked,
      picked: [],
    };
  }
  const core = recordAttempt(s.core, false, given, tag);
  return {
    ...s,
    core,
    phase: 'bounce',
    phaseLeft: BOUNCE_TICKS,
    lastWrong: tag ? { value: given, made, tag } : { value: given, made },
  };
}

export function stepFishing(state: FishingState, input: InputFrame<FishingAction>): FishingState {
  if (state.phase === 'done') return state;
  let s: FishingState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  const tick = s.core.tick;
  for (const a of input.actions) {
    if (a.t === 'hint' && s.phase === 'play') s = { ...s, core: takeHint(s.core) };
    if (a.t === 'retry' && s.phase === 'play' && s.core.puzzleHints >= 4) s = retryPuzzle(s);
    if (a.t === 'odd' && s.odd) {
      s = {
        ...s,
        odd: null,
        oddCaught: s.oddCaught + 1,
        core: { ...s.core, coins: s.core.coins + BALANCE.coins.oddFishBonus },
      };
    }
    if (a.t === 'tap' && s.phase === 'play' && s.puzzle) {
      const f = s.puzzle.fish.find((x) => x.id === a.id && !x.caught);
      if (!f) continue;
      const picked = s.picked.includes(a.id) ? s.picked.filter((x) => x !== a.id) : [...s.picked, a.id];
      s = evaluate({ ...s, picked });
    }
  }
  // odd fish: appears on a seeded schedule, swims for 5 s (no math, a resting point)
  if (!s.odd && tick >= s.nextOdd) {
    const r = withRng(s.core, (rng) => ({
      kind: rng.int(0, 2) as 0 | 1 | 2,
      lane: rng.int(0, 5),
      gap: rng.int(60 * 9, 60 * 16),
    }));
    s = {
      ...s,
      core: r.core,
      odd: { id: tick, kind: r.value.kind, born: tick, life: 300, lane: r.value.lane },
      nextOdd: tick + r.value.gap,
    };
  }
  if (s.odd && tick - s.odd.born > s.odd.life) s = { ...s, odd: null };
  if (s.phase === 'reel' || s.phase === 'bounce') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    if (s.phase === 'bounce') return { ...s, phase: 'play', phaseLeft: 0, picked: [] };
    const core = advancePuzzle(s.core);
    if (core.done) return { ...s, core, phase: 'done', puzzle: s.puzzle };
    return newPuzzle({ ...s, core });
  }
  return s;
}

export const fishingRules: StageRules<FishingState, FishingAction> = {
  id: 'fishing',
  init: (seed, level, opts) => initFishing(seed, level, opts),
  step: stepFishing,
  isDone: (s) => s.phase === 'done',
  summary: (s): RoundResult => {
    const r = roundSummary(s.core);
    return { ...r, highlights: s.oddCaught ? [...r.highlights, 'oddFish'] : r.highlights };
  },
};
