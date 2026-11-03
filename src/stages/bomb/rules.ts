/**
 * ① 폭탄 해체반 — pure rules. Bomb shows N; cut wires so that:
 * SUM2 two wires sum to N · DIFF2 two wires differ by N · SUM3 three wires sum to N ·
 * PLACE one wire per place-value group (백·십·일 …) builds N. No timer (the fuse is decoration).
 */
import { BALANCE } from '../../domain/balance';
import { levelSpec } from '../../domain/curriculum/curriculum';
import { digitAt, digitCount } from '../../domain/edu/arith';
import { generateQuestion } from '../../domain/edu/generate';
import type { LevelId, Question, SkillId } from '../../domain/edu/types';
import type { Rng } from '../../domain/rng/rng';
import type { InputFrame, StageRules } from '../../domain/stage/types';
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

export const BOMB_SKILLS: readonly SkillId[] = [
  'ADD_NOCARRY',
  'ADD_CARRY',
  'SUB_NOBORROW',
  'SUB_BORROW',
  'THREE_TERM',
  'PLACE_VALUE',
];

export type BombMode = 'SUM2' | 'DIFF2' | 'SUM3' | 'PLACE';

export interface Wire {
  id: number;
  value: number;
  color: number; // 0..5 palette slot
  pattern: number; // 0 solid, 1 stripes, 2 dots — shape cue besides colour
  /** PLACE mode: place index (0 = ones). */
  group?: number;
}

export interface BombPuzzle {
  mode: BombMode;
  target: number;
  wires: Wire[];
}

export type BombPhase = 'play' | 'defuse' | 'puff' | 'done';

export interface BombState {
  core: RoundCore;
  puzzle: BombPuzzle | null;
  cut: number[];
  phase: BombPhase;
  phaseLeft: number;
  lastWrong: { value: number; made: number; tag?: string } | null;
}

export type BombAction =
  | { t: 'cut'; id: number }
  | { t: 'hint' }
  | { t: 'retry' }
  /** Reconnect the last cut wire (a mis-cut); never costs anything (P2). */
  | { t: 'undo' };

export const DEFUSE_TICKS = 80;
/** Wrong-answer KABOOM is watched in full (~2.6 s) before the wires reconnect. */
export const PUFF_TICKS = 156;

export function needed(p: BombPuzzle): number {
  if (p.mode === 'SUM3') return 3;
  if (p.mode === 'PLACE') return new Set(p.wires.map((w) => w.group)).size;
  return 2;
}

export function selectionValue(p: BombPuzzle, ids: readonly number[]): number {
  const vals = ids.map((id) => p.wires.find((w) => w.id === id)?.value ?? 0);
  if (p.mode === 'DIFF2') return Math.abs((vals[0] ?? 0) - (vals[1] ?? 0));
  return vals.reduce((a, b) => a + b, 0);
}

export function selectionValid(p: BombPuzzle, ids: readonly number[]): boolean {
  if (ids.length !== needed(p)) return false;
  if (p.mode === 'PLACE') {
    const groups = ids.map((id) => p.wires.find((w) => w.id === id)?.group);
    if (new Set(groups).size !== groups.length) return false;
  }
  return selectionValue(p, ids) === p.target;
}

/** All correct cut sets (sorted id lists). */
export function solveBomb(p: BombPuzzle): number[][] {
  const ids = p.wires.map((w) => w.id);
  const k = needed(p);
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) {
      if (selectionValid(p, acc)) out.push(acc.slice());
      return;
    }
    for (let i = start; i < ids.length; i++) rec(i + 1, [...acc, ids[i] as number]);
  };
  rec(0, []);
  return out;
}

/**
 * Hub "쉽게" ladder for the bomb squad (D26): five fixed steps from one-digit + one-digit up, all inside the
 * grade-1 range. Steps go up one per cleared easy round (saved) and the child can also pick any step.
 */
export const EASY_STEPS = BALANCE.bombEasySteps;
const ONE = (v: number) => v >= 1 && v <= 9;
const EASY_LADDER: readonly {
  level: LevelId;
  skill: SkillId;
  ok: (q: Question) => boolean;
}[] = [
  // ① one digit + one digit, up to 9
  { level: 'L0_1', skill: 'ADD_NOCARRY', ok: (q) => q.operands.every(ONE) && q.answer <= 9 },
  // ② two one-digit numbers that make 10
  { level: 'A2', skill: 'ADD_CARRY', ok: (q) => q.operands.every(ONE) && q.answer === 10 },
  // ③ one digit + one digit with a carry (11–18)
  { level: 'A2', skill: 'ADD_CARRY', ok: (q) => q.operands.every(ONE) && q.answer >= 11 && q.answer <= 18 },
  // ④ two digits + one digit, no carry
  {
    level: 'A3',
    skill: 'ADD_NOCARRY',
    ok: (q) => q.operands.some((v) => v >= 10) && q.operands.some(ONE) && q.answer <= 99,
  },
  // ⑤ three one-digit numbers added
  { level: 'A6', skill: 'THREE_TERM', ok: (q) => q.operands.length === 3 && q.operands.every(ONE) },
];

/** Wire value cap for an easy step: one-digit parts → one-digit wires (step ④ has a two-digit part). */
export const easyCap = (step: number) => (step > 0 && step !== 4 ? 9 : 0);

/** Does `q` belong to easy step `step`? */
export function easyStepOk(step: number, q: Question): boolean {
  const spec = EASY_LADDER[Math.min(EASY_STEPS, Math.max(1, step)) - 1];
  return !!spec && q.skill === spec.skill && q.form === 'EXPR' && q.ops.every((o) => o === '+') && spec.ok(q);
}

/** A question for easy step `step` (1–5), or null if none turned up (the caller falls back to adaptive). */
export function easyStepQuestion(step: number, rng: Rng, avoid: readonly string[] = []): Question | null {
  const spec = EASY_LADDER[Math.min(EASY_STEPS, Math.max(1, step)) - 1];
  if (!spec) return null;
  for (let i = 0; i < 300; i++) {
    const q = generateQuestion({
      level: spec.level,
      skill: spec.skill,
      rng,
      ...(i < 150 ? { avoid } : {}),
    });
    if (preferBomb(q) && easyStepOk(step, q)) return q;
  }
  return null;
}

export function preferBomb(q: Question): boolean {
  if (q.answer <= 0 || q.operands.some((v) => v <= 0)) return false;
  if (q.skill === 'THREE_TERM') return q.ops.every((o) => o === '+');
  if (q.skill === 'PLACE_VALUE') return q.target === undefined;
  return q.form === 'EXPR' && q.operands.length === 2;
}

/** `easy` (hub "쉽게"): only one extra wire besides the right ones. */
/** `cap`: largest wire value (easy steps with one-digit parts keep every wire one-digit). */
export function puzzleFromQuestion(q: Question, rng: Rng, easy = false, cap = 0): BombPuzzle {
  const band = bandOf(q.level);
  const deco = (i: number) => ({ color: i % 6, pattern: Math.floor(i / 2) % 3 });
  if (q.skill === 'PLACE_VALUE') {
    const n = q.answer;
    const places = digitCount(n);
    const wires: Wire[] = [];
    for (let p = places - 1; p >= 0; p--) {
      const d = digitAt(n, p);
      const other = new Set<number>([d]);
      while (other.size < 2) {
        const alt = rng.int(p === places - 1 ? 1 : 0, 9);
        other.add(alt);
      }
      for (const digit of rng.shuffle([...other]))
        wires.push({ id: wires.length, value: digit * 10 ** p, group: p, ...deco(wires.length) });
    }
    return { mode: 'PLACE', target: n, wires };
  }
  const count = band === 'A' ? 4 : 5;
  const ops = q.ops;
  const mode: BombMode = q.operands.length === 3 ? 'SUM3' : ops[0] === '-' ? 'DIFF2' : 'SUM2';
  const target = q.answer;
  const correct = q.operands.slice();
  // correct parts may repeat (40 + 40): keep both wires; distractors unique
  const values: number[] = correct.slice();
  const used = new Set(correct);
  // distractor wires: near the real parts (±1, ±10) and misconception-flavoured values
  const cands: number[] = [];
  for (const c of correct) for (const d of [1, -1, 10, -10, 2, -2, 100]) cands.push(c + d);
  for (const ch of q.choices) if (ch.value !== q.answer) cands.push(ch.value - (correct[1] ?? 0));
  const max = Math.min(cap || levelSpec(q.level).max, Math.max(...correct) + 20);
  const want = easy ? correct.length + 1 : Math.max(count, correct.length + 2);
  const push = (v: number) => {
    if (values.length < want && Number.isInteger(v) && v > 0 && v <= max && !used.has(v)) {
      used.add(v);
      values.push(v);
    }
  };
  for (const v of rng.shuffle(cands)) push(v);
  for (let i = 0; values.length < want && i < 200; i++) push(rng.int(1, max));
  const wires = rng.shuffle(values).map((value, id) => ({ id, value, ...deco(id) }));
  return { mode, target, wires };
}

function newPuzzle(s: BombState): BombState {
  const step = s.core.easyStep;
  let core = nextStageQuestion(
    s.core,
    BOMB_SKILLS,
    preferBomb,
    step > 0 ? (rng, avoid) => easyStepQuestion(step, rng, avoid) : undefined,
  );
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  const r = withRng(core, (rng) => puzzleFromQuestion(q, rng, core.shift === -1, easyCap(core.easyStep)));
  core = r.core;
  return { ...s, core, puzzle: r.value, cut: [], phase: 'play', phaseLeft: 0, lastWrong: null };
}

export function initBomb(
  seed: number | string,
  level: Parameters<typeof initRound>[2],
  opts: RoundOptions = {},
): BombState {
  return newPuzzle({
    core: initRound('bomb', seed, level, opts),
    puzzle: null,
    cut: [],
    phase: 'play',
    phaseLeft: 0,
    lastWrong: null,
  });
}

export function stepBomb(state: BombState, input: InputFrame<BombAction>): BombState {
  if (state.phase === 'done') return state;
  let s: BombState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  for (const a of input.actions) {
    if (a.t === 'hint' && s.phase === 'play') s = { ...s, core: takeHint(s.core) };
    if (a.t === 'undo' && s.phase === 'play' && s.cut.length > 0) s = { ...s, cut: s.cut.slice(0, -1) };
    if (a.t === 'retry' && s.phase === 'play' && s.core.puzzleHints >= 4) {
      const step = s.core.easyStep;
      const core =
        step > 0
          ? sameKindQuestion(s.core, (q) => preferBomb(q) && easyStepOk(step, q), true)
          : sameKindQuestion(s.core, preferBomb);
      const q = core.asked?.question;
      if (q) {
        const r = withRng(core, (rng) =>
          puzzleFromQuestion(q, rng, core.shift === -1, easyCap(core.easyStep)),
        );
        s = { ...s, core: r.core, puzzle: r.value, cut: [], lastWrong: null };
      }
    }
    if (a.t === 'cut' && s.phase === 'play' && s.puzzle) {
      const p = s.puzzle;
      const wire = p.wires.find((w) => w.id === a.id);
      if (!wire) continue;
      let cut: number[];
      if (s.cut.includes(a.id))
        cut = s.cut.filter((x) => x !== a.id); // re-tap = reconnect (free undo)
      else if (p.mode === 'PLACE')
        cut = [...s.cut.filter((id) => p.wires.find((w) => w.id === id)?.group !== wire.group), a.id];
      else cut = [...s.cut, a.id];
      s = { ...s, cut };
      if (cut.length === needed(p)) {
        const given = selectionValue(p, cut);
        const q = s.core.asked?.question;
        if (selectionValid(p, cut)) {
          s = { ...s, core: recordAttempt(s.core, true, given), phase: 'defuse', phaseLeft: DEFUSE_TICKS };
        } else {
          // the child cut wires (chose parts), so result-misconception tags do not apply
          const tag = p.mode === 'PLACE' ? q?.misconceptionMap[given] : undefined;
          s = {
            ...s,
            core: recordAttempt(s.core, false, given, tag),
            phase: 'puff',
            phaseLeft: PUFF_TICKS,
            lastWrong: tag ? { value: given, made: given, tag } : { value: given, made: given },
          };
        }
      }
    }
  }
  if (s.phase === 'defuse' || s.phase === 'puff') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    if (s.phase === 'puff') return { ...s, phase: 'play', phaseLeft: 0, cut: [] };
    const core = advancePuzzle(s.core);
    if (core.done) return { ...s, core, phase: 'done' };
    return newPuzzle({ ...s, core });
  }
  return s;
}

export const bombRules: StageRules<BombState, BombAction> = {
  id: 'bomb',
  init: (seed, level, opts) => initBomb(seed, level, opts),
  step: stepBomb,
  isDone: (s) => s.phase === 'done',
  summary: (s) => roundSummary(s.core),
};
