/**
 * ⑧ 정답 달리기 레이스 — pure rules (P5).
 *
 * A kart race along a roller-coaster track of `BALANCE.race.length` squares against two rival monsters.
 * Each turn shows one question with four answers in a cross (↑ ← → ↓). Right = BOOST one square; every
 * third right answer in a row adds a TURBO square. Wrong = the kart spins on a banana peel for a second and
 * the same question stays (that answer dims) — nothing is lost (P2).
 *
 * No time pressure: the rivals only move when the child answers (seeded chance per turn, by difficulty), so
 * thinking time is unlimited and a replay is exact. A child who answers everything right always wins: they
 * need 9 turns for 12 squares, a rival moves at most one square a turn. Star coins wait at fixed squares.
 * The race goes on until the child crosses the line, whatever the rivals do.
 */
import { BALANCE } from '../../domain/balance';
import type { Choice, Question, SkillId } from '../../domain/edu/types';
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

export const RACE_SKILLS: readonly SkillId[] = [
  'ADD_NOCARRY',
  'ADD_CARRY',
  'SUB_NOBORROW',
  'SUB_BORROW',
  'COMPOSE_10',
  'MISSING_TERM',
];
export const RIVALS = 2;
/** Squares where a star coin waits. */
export const STAR_SQUARES: readonly number[] = [4, 8];
export const START_TICKS = 100;
export const BOOST_TICKS = 55;
/** SPEC: a slip lasts one second. */
export const SLIP_TICKS = 60;
export const FINISH_TICKS = 170;
/** Chance per turn that the first rival moves a square (hub difficulty = the rivals' pace). */
export const RIVAL_PACE = { easy: 0.5, normal: 0.65, hard: 0.8 } as const;

export type RacePhase = 'start' | 'play' | 'boost' | 'slip' | 'finish' | 'done';

export interface RaceState {
  core: RoundCore;
  me: number;
  rivals: number[];
  /** What each rival did on the last turn (for the scene): 1 moved, 0 slipped, -1 already home. */
  rivalMoves: number[];
  /** Right answers in a row (turbo every `turboEvery`). */
  streak: number;
  /** Squares gained by the last right answer (2 = turbo). */
  gain: number;
  turbos: number;
  stars: number[];
  /** Answers already tried on this question (dimmed). */
  tried: number[];
  lastWrong: { value: number; made: number; tag?: string } | null;
  /** 1..3 once the child has crossed the line. */
  place: number | null;
  phase: RacePhase;
  phaseLeft: number;
}

/** `id` (CROSS_ID + slot) only tells the tutorial hand which answer key to point at. */
export type RaceAction = { t: 'pick'; value: number; id?: number } | { t: 'hint' } | { t: 'retry' };
export const CROSS_ID = 200;

/** A number sentence with four different number answers, everything 0..99. */
export function preferRace(q: Question): boolean {
  if (q.form !== 'EXPR' && q.form !== 'MISSING') return false;
  if (q.operands.length !== 2) return false;
  if (q.answer < 0 || q.answer > 99 || q.result < 0 || q.result > 99) return false;
  const values = q.choices.filter((c) => c.display === undefined).map((c) => c.value);
  return new Set(values).size >= 4 && values.includes(q.answer);
}

/** The four answers in cross order (↑ ← → ↓), as the question lists them. */
export function crossChoices(q: Question): Choice[] {
  const seen = new Set<number>();
  const out: Choice[] = [];
  for (const c of q.choices) {
    if (c.display !== undefined || seen.has(c.value)) continue;
    seen.add(c.value);
    out.push(c);
  }
  // the answer must be among the four shown
  const four = out.slice(0, 4);
  if (!four.some((c) => c.value === q.answer)) {
    const right = out.find((c) => c.value === q.answer);
    if (right) four[3] = right;
  }
  return four;
}

/** Current place (1 = first): rivals strictly ahead push the child back. */
export const placeOf = (me: number, rivals: readonly number[]) => 1 + rivals.filter((r) => r > me).length;

const paceFor = (shift: number, i: number) =>
  (shift < 0 ? RIVAL_PACE.easy : shift > 0 ? RIVAL_PACE.hard : RIVAL_PACE.normal) - i * 0.1;

function ask(s: RaceState): RaceState {
  return { ...s, core: nextStageQuestion(s.core, RACE_SKILLS, preferRace), tried: [], lastWrong: null };
}

export function initRace(
  seed: number | string,
  level: Parameters<typeof initRound>[2],
  opts: RoundOptions = {},
): RaceState {
  return ask({
    core: initRound('race', seed, level, { ...opts, puzzles: opts.puzzles ?? BALANCE.race.length }),
    me: 0,
    rivals: Array.from({ length: RIVALS }, () => 0),
    rivalMoves: Array.from({ length: RIVALS }, () => 0),
    streak: 0,
    gain: 0,
    turbos: 0,
    stars: [],
    tried: [],
    lastWrong: null,
    place: null,
    phase: 'start',
    phaseLeft: START_TICKS,
  });
}

export function solveRace(s: RaceState): RaceAction[] {
  const q = s.core.asked?.question;
  if (!q) return [];
  const slot = crossChoices(q).findIndex((c) => c.value === q.answer);
  return [{ t: 'pick', value: q.answer, id: CROSS_ID + slot }];
}

/** The rivals take their turn (seeded): each moves a square or slips; one already home stays. */
function rivalsTurn(s: RaceState): RaceState {
  const length = s.core.puzzles;
  const r = withRng(s.core, (rng) =>
    s.rivals.map((pos, i) => (pos >= length ? -1 : rng.chance(paceFor(s.core.shift, i)) ? 1 : 0)),
  );
  return {
    ...s,
    core: r.core,
    rivalMoves: r.value,
    rivals: s.rivals.map((pos, i) => Math.min(length, pos + Math.max(0, r.value[i] ?? 0))),
  };
}

export function stepRace(state: RaceState, input: InputFrame<RaceAction>): RaceState {
  if (state.phase === 'done') return state;
  let s: RaceState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  const length = s.core.puzzles;
  for (const a of input.actions) {
    const q = s.core.asked?.question;
    if (!q) continue;
    if (a.t === 'hint' && (s.phase === 'play' || s.phase === 'start')) s = { ...s, core: takeHint(s.core) };
    if (s.phase !== 'play') continue;
    if (a.t === 'retry' && s.core.puzzleHints >= 4)
      s = { ...s, core: sameKindQuestion(s.core, preferRace), tried: [], lastWrong: null };
    if (a.t === 'pick') {
      if (!crossChoices(q).some((c) => c.value === a.value) || s.tried.includes(a.value)) continue;
      if (a.value === q.answer) {
        const streak = s.streak + 1;
        const turbo = streak % BALANCE.race.turboEvery === 0;
        const gain = turbo ? 2 : 1;
        const me = Math.min(length, s.me + gain);
        let core = recordAttempt(s.core, true, a.value);
        const got = STAR_SQUARES.filter((sq) => sq <= me && !s.stars.includes(sq));
        if (got.length) core = { ...core, coins: core.coins + got.length * BALANCE.race.starCoin };
        s = rivalsTurn({
          ...s,
          core,
          me,
          streak,
          gain,
          turbos: s.turbos + (turbo ? 1 : 0),
          stars: [...s.stars, ...got],
          phase: 'boost',
          phaseLeft: BOOST_TICKS,
        });
      } else {
        const tag = q.misconceptionMap[a.value];
        s = rivalsTurn({
          ...s,
          core: recordAttempt(s.core, false, a.value, tag),
          streak: 0,
          gain: 0,
          tried: [...s.tried, a.value],
          lastWrong: tag ? { value: a.value, made: a.value, tag } : { value: a.value, made: a.value },
          phase: 'slip',
          phaseLeft: SLIP_TICKS,
        });
      }
    }
  }
  if (s.phase === 'start' || s.phase === 'boost' || s.phase === 'slip' || s.phase === 'finish') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    if (s.phase === 'start' || s.phase === 'slip') return { ...s, phase: 'play', phaseLeft: 0 };
    if (s.phase === 'finish') return { ...s, core: { ...s.core, done: true }, phase: 'done' };
    // boost over: across the line → the finish show; otherwise the next question
    const core = advancePuzzle(s.core);
    if (s.me >= length) {
      // a rival that was already home before this turn came in first; one arriving on the same turn did not
      const place = 1 + s.rivalMoves.filter((m) => m === -1).length;
      return { ...s, core: { ...core, done: false }, place, phase: 'finish', phaseLeft: FINISH_TICKS };
    }
    // a long race (many slips are not puzzles; only right answers advance) never runs out of questions
    return ask({ ...s, core: { ...core, done: false }, phase: 'play', phaseLeft: 0 });
  }
  return s;
}

export const raceRules: StageRules<RaceState, RaceAction> = {
  id: 'race',
  init: (seed, level, opts) => initRace(seed, level, opts),
  step: stepRace,
  isDone: (s) => s.phase === 'done',
  summary: (s): RoundResult => {
    // turbo squares skip questions: the round is complete after the questions actually asked
    const r = roundSummary({ ...s.core, puzzles: Math.max(1, Math.min(s.core.puzzles, s.core.index)) });
    const highlights = [...r.highlights];
    if (s.place === 1) highlights.push('raceWin');
    if (s.turbos > 0) highlights.push('raceTurbo');
    return { ...r, highlights };
  },
};
