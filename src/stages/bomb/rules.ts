/**
 * ① 폭탄 해체반 — pure rules. Bomb shows N; cut wires so that:
 * SUM2 two wires sum to N · DIFF2 two wires differ by N · SUM3 three wires sum to N ·
 * PLACE one wire per place-value group (백·십·일 …) builds N. No timer (the fuse is decoration).
 */
import { digitAt, digitCount } from '../../domain/edu/arith';
import type { Question, SkillId } from '../../domain/edu/types';
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
  lastWrong: { value: number; tag?: string } | null;
}

export type BombAction = { t: 'cut'; id: number } | { t: 'hint' };

export const DEFUSE_TICKS = 80;
export const PUFF_TICKS = 60;

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

export function preferBomb(q: Question): boolean {
  if (q.answer <= 0 || q.operands.some((v) => v <= 0)) return false;
  if (q.skill === 'THREE_TERM') return q.ops.every((o) => o === '+');
  if (q.skill === 'PLACE_VALUE') return q.target === undefined;
  return q.form === 'EXPR' && q.operands.length === 2;
}

export function puzzleFromQuestion(q: Question, rng: Rng): BombPuzzle {
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
  const max = Math.max(...correct) + 20;
  const want = Math.max(count, correct.length + 2);
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
  let core = nextStageQuestion(s.core, BOMB_SKILLS, preferBomb);
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  const r = withRng(core, (rng) => puzzleFromQuestion(q, rng));
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
          const tag = q?.misconceptionMap[given];
          s = {
            ...s,
            core: recordAttempt(s.core, false, given, tag),
            phase: 'puff',
            phaseLeft: PUFF_TICKS,
            lastWrong: tag ? { value: given, tag } : { value: given },
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
