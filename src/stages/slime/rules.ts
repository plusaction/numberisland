/**
 * ④ 슬라임 합체 — pure rules. Drag slime A onto B → A+B. A red minus slime (−k) onto B → B−k
 * (a result below 0 bounces off). Goal: make one slime equal to the target. Undo is free and unlimited.
 * Puzzles are generated backwards from the target, so a solution always exists (verified by BFS).
 */
import { levelSpec } from '../../domain/curriculum/curriculum';
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
  sameKindQuestion,
  takeHint,
  withRng,
} from '../_shared/round';

export const SLIME_SKILLS: readonly SkillId[] = [
  'ADD_NOCARRY',
  'ADD_CARRY',
  'SUB_NOBORROW',
  'SUB_BORROW',
  'COMPOSE_10',
  'THREE_TERM',
];

export interface Slime {
  id: number;
  value: number;
  minus: boolean;
  /** Layout slot on the tray (view only). */
  slot: number;
}

export interface SlimePuzzle {
  target: number;
  slimes: Slime[];
  /** Merges in the generated solution path (for stars/tests). */
  solutionSteps: number;
}

export type SlimePhase = 'play' | 'win' | 'done';

export interface SlimeState {
  core: RoundCore;
  puzzle: SlimePuzzle | null;
  slimes: Slime[];
  undo: Slime[][];
  phase: SlimePhase;
  phaseLeft: number;
  /** Visual events for the view: last merge / bounce / split. */
  event: { kind: 'merge' | 'bounce' | 'split' | 'undo'; to: number; from: number; tick: number } | null;
  stuckReported: boolean;
  winner: number | null;
}

export type SlimeAction =
  | { t: 'merge'; from: number; to: number }
  | { t: 'undo' }
  | { t: 'hint' }
  | { t: 'retry' };

export const WIN_TICKS = 75;
const MAX_DEPTH = 6;

type Key = string;
const keyOf = (normals: number[], minus: number[]) =>
  `${normals
    .slice()
    .sort((a, b) => a - b)
    .join(',')}|${minus
    .slice()
    .sort((a, b) => a - b)
    .join(',')}`;

/** Breadth-first search: minimum merges to reach the target, or null if impossible within MAX_DEPTH. */
export function solveSlime(target: number, slimes: readonly Slime[], maxDepth = MAX_DEPTH): number | null {
  const normals = slimes.filter((s) => !s.minus).map((s) => s.value);
  const minus = slimes.filter((s) => s.minus).map((s) => s.value);
  if (normals.includes(target)) return 0;
  let frontier: [number[], number[]][] = [[normals, minus]];
  const seen = new Set<Key>([keyOf(normals, minus)]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: [number[], number[]][] = [];
    for (const [n, m] of frontier) {
      for (let i = 0; i < n.length; i++) {
        for (let j = 0; j < n.length; j++) {
          if (i === j) continue;
          const nn = n.filter((_, k) => k !== i && k !== j);
          const v = (n[j] as number) + (n[i] as number);
          if (v === target) return depth;
          nn.push(v);
          const key = keyOf(nn, m);
          if (!seen.has(key)) {
            seen.add(key);
            next.push([nn, m]);
          }
        }
        for (let k = 0; k < m.length; k++) {
          const v = (n[i] as number) - (m[k] as number);
          if (v < 0) continue;
          if (v === target) return depth;
          const nn = n.map((x, idx) => (idx === i ? v : x));
          const mm = m.filter((_, idx) => idx !== k);
          const key = keyOf(nn, mm);
          if (!seen.has(key)) {
            seen.add(key);
            next.push([nn, mm]);
          }
        }
      }
    }
    frontier = next;
    if (frontier.length > 20000) break;
  }
  return null;
}

export function preferSlime(q: Question): boolean {
  // no 0 parts / 0 targets (a slime of 0, or a part that already equals the target, is not a puzzle)
  if (q.answer <= 0 || q.operands.some((v) => v <= 0)) return false;
  // a part that already equals the target would make the puzzle trivially "solved"
  if (q.operands.some((v, i) => (i === 0 || q.ops[i - 1] === '+') && v === q.answer)) return false;
  return (
    q.form === 'EXPR' &&
    q.operands.length <= 3 &&
    !q.operands.every((v, _i, arr) => arr.length > 2 && v === arr[0])
  );
}

/** Backwards generation: the question's parts become slimes, plus distractors that keep it solvable. */
/** `easy` (hub "쉽게"): no extra split and only one spare slime. */
export function puzzleFromQuestion(q: Question, rng: Rng, easy = false): SlimePuzzle {
  const band = bandOf(q.level);
  const target = q.answer;
  const parts: { value: number; minus: boolean }[] = [];
  q.operands.forEach((v, i) => {
    const op = i === 0 ? '+' : q.ops[i - 1];
    parts.push({ value: v, minus: op === '-' });
  });
  // A band: split a big first part once more so there is a real 2–3 step plan (10 만들기 friendly)
  const first = parts[0];
  if (
    !easy &&
    band === 'A' &&
    parts.length === 2 &&
    first &&
    !first.minus &&
    first.value >= 6 &&
    rng.chance(0.5)
  ) {
    const cut = rng.int(1, first.value - 1);
    // never split into a piece that already equals the target
    if (cut !== target && first.value - cut !== target) {
      parts.splice(0, 1, { value: cut, minus: false }, { value: first.value - cut, minus: false });
    }
  }
  const total = easy ? parts.length + 1 : band === 'A' ? 5 : band === 'B' ? 6 : 7;
  const values: { value: number; minus: boolean }[] = parts.slice();
  const ceiling = levelSpec(q.level).max;
  const near = (v: number) => Math.min(ceiling, Math.max(1, v + rng.pick([1, -1, 2, 10, -10])));
  let guard = 0;
  while (values.length < total && guard++ < 50) {
    const base = rng.pick(parts);
    if (rng.chance(0.25)) values.push({ value: Math.max(1, Math.min(9, near(3))), minus: true });
    else values.push({ value: near(base.value), minus: false });
  }
  const slots = rng.shuffle(values.map((_, i) => i));
  const slimes: Slime[] = values.map((v, i) => ({
    id: i,
    value: v.value,
    minus: v.minus,
    slot: slots[i] as number,
  }));
  // the target itself must not already be on the tray
  slimes.forEach((sl, i) => {
    if (i >= parts.length && !sl.minus && sl.value === target)
      sl.value = target + 1 <= ceiling ? target + 1 : target - 1;
  });
  const steps = parts.length - 1;
  return { target, slimes, solutionSteps: steps };
}

function newPuzzle(s: SlimeState): SlimeState {
  let core = nextStageQuestion(s.core, SLIME_SKILLS, preferSlime);
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  const r = withRng(core, (rng) => {
    let p = puzzleFromQuestion(q, rng, core.shift === -1);
    // defensive: regenerate distractors until BFS proves solvable (generation is constructive, this never loops long)
    for (let i = 0; i < 10 && solveSlime(p.target, p.slimes) === null; i++)
      p = puzzleFromQuestion(q, rng, core.shift === -1);
    return p;
  });
  core = r.core;
  return {
    ...s,
    core,
    puzzle: r.value,
    slimes: r.value.slimes,
    undo: [],
    phase: 'play',
    phaseLeft: 0,
    event: null,
    stuckReported: false,
    winner: null,
  };
}

export function initSlime(
  seed: number | string,
  level: Parameters<typeof initRound>[2],
  opts: RoundOptions = {},
): SlimeState {
  return newPuzzle({
    core: initRound('slime', seed, level, opts),
    puzzle: null,
    slimes: [],
    undo: [],
    phase: 'play',
    phaseLeft: 0,
    event: null,
    stuckReported: false,
    winner: null,
  });
}

export function stepSlime(state: SlimeState, input: InputFrame<SlimeAction>): SlimeState {
  if (state.phase === 'done') return state;
  let s: SlimeState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  const tick = s.core.tick;
  for (const a of input.actions) {
    const puzzle = s.puzzle;
    if (s.phase !== 'play' || !puzzle) break;
    if (a.t === 'hint') s = { ...s, core: takeHint(s.core) };
    if (a.t === 'retry' && s.core.puzzleHints >= 4) {
      const core = sameKindQuestion(s.core, preferSlime);
      const q = core.asked?.question;
      if (q) {
        const r = withRng(core, (rng) => puzzleFromQuestion(q, rng, core.shift === -1));
        s = {
          ...s,
          core: r.core,
          puzzle: r.value,
          slimes: r.value.slimes,
          undo: [],
          stuckReported: false,
          event: null,
        };
      }
    }
    if (a.t === 'undo') {
      const prev = s.undo[s.undo.length - 1];
      if (prev)
        s = {
          ...s,
          slimes: prev,
          undo: s.undo.slice(0, -1),
          event: { kind: 'undo', to: -1, from: -1, tick },
        };
    }
    if (a.t === 'merge') {
      const from = s.slimes.find((x) => x.id === a.from);
      const to = s.slimes.find((x) => x.id === a.to);
      if (!from || !to || from.id === to.id || to.minus) {
        if (from && to) s = { ...s, event: { kind: 'bounce', to: to.id, from: from.id, tick } };
        continue;
      }
      const value = from.minus ? to.value - from.value : to.value + from.value;
      if (value < 0) {
        // "안 돼요" bounce: nothing consumed; counts as one gentle wrong try (first time only)
        s = { ...s, event: { kind: 'bounce', to: to.id, from: from.id, tick } };
        if (s.core.puzzleWrong === 0) s = { ...s, core: recordAttempt(s.core, false, value) };
        continue;
      }
      const slimes = s.slimes
        .filter((x) => x.id !== from.id)
        .map((x) => (x.id === to.id ? { ...x, value } : x));
      s = {
        ...s,
        undo: [...s.undo, s.slimes],
        slimes,
        event: { kind: from.minus ? 'split' : 'merge', to: to.id, from: from.id, tick },
      };
      if (value === puzzle.target) {
        s = {
          ...s,
          core: recordAttempt(s.core, true, value),
          phase: 'win',
          phaseLeft: WIN_TICKS,
          winner: to.id,
        };
      } else if (!s.stuckReported && solveSlime(puzzle.target, slimes) === null) {
        // dead end: one wrong try is logged (no penalty) and the HUD suggests undo
        const tag = s.core.asked?.question.misconceptionMap[value];
        s = { ...s, core: recordAttempt(s.core, false, value, tag), stuckReported: true };
      }
    }
  }
  if (s.phase === 'win') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    const core = advancePuzzle(s.core);
    if (core.done) return { ...s, core, phase: 'done' };
    return newPuzzle({ ...s, core });
  }
  return s;
}

/** Whether the current tray can still reach the target (HUD shows the undo hint when not). */
export function isStuck(s: SlimeState): boolean {
  return !!s.puzzle && s.phase === 'play' && solveSlime(s.puzzle.target, s.slimes) === null;
}

export const slimeRules: StageRules<SlimeState, SlimeAction> = {
  id: 'slime',
  init: (seed, level, opts) => initSlime(seed, level, opts),
  step: stepSlime,
  isDone: (s) => s.phase === 'done',
  summary: (s) => roundSummary(s.core),
};
