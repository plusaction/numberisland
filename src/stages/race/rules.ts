/**
 * ⑧ 정답 달리기 레이스 — pure rules (P5).
 *
 * A real-time kart race along a roller-coaster track of `BALANCE.race.length` squares against two rival
 * monsters. Everybody keeps driving. Each question shows four answers in a cross (↑ ← → ↓):
 * right = BOOST a whole square (every third right answer in a row is a TURBO: two squares) and a full tank;
 * wrong = the kart spins on a banana peel for a second (it never goes backwards; that answer dims, the
 * question stays). Between answers the kart cruises on its booster fuel, which runs down in a few seconds —
 * without answers it only crawls, so the race is won with right answers, not by waiting.
 *
 * Gentle competition (D35): the rivals drive by themselves (fixed 60 Hz ticks + seeded boosts and slips, so
 * a replay is exact), but on a rubber band — a rival ahead eases off and never gets more than about two and
 * a half squares away, a rival behind speeds up. No countdown is shown and nothing is ever lost (P2); the
 * race goes on until the child crosses the line.
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
export const BOOST_TICKS = BALANCE.race.boostTicks;
/** SPEC: a slip lasts one second. */
export const SLIP_TICKS = 60;
export const FINISH_TICKS = 170;
/** A rival never leads by more than this many squares (the rubber band's hard end). */
export const MAX_LEAD = 2.5;

export type RacePhase = 'start' | 'play' | 'boost' | 'slip' | 'finish' | 'done';
export type RivalFx = { kind: 'run' | 'boost' | 'slip'; left: number };

export interface RaceState {
  core: RoundCore;
  /** Positions in squares (continuous). */
  me: number;
  rivals: number[];
  /** What each rival is doing (for the scene) and the ticks until its next seeded event. */
  rivalFx: RivalFx[];
  rivalNext: number[];
  /** Booster fuel 0..1: full after a right answer, runs down while cruising. */
  fuel: number;
  /** Where the running boost ends. */
  boostTo: number;
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

/** Current place (1 = first): rivals clearly ahead push the child back. */
export const placeOf = (me: number, rivals: readonly number[]) =>
  1 + rivals.filter((r) => r > me + 0.02).length;

/** A rival's cruising speed in squares / second (hub difficulty; the second rival is a bit slower). */
export const rivalSpeed = (shift: number, i: number) =>
  (shift < 0 ? BALANCE.race.rival.easy : shift > 0 ? BALANCE.race.rival.hard : BALANCE.race.rival.normal) *
  (i === 0 ? 1 : 0.85);

/** Rubber band: a rival ahead of the child eases off, one behind speeds up. */
export const band = (gap: number) => Math.max(0.04, Math.min(2.1, 1 - 0.55 * (gap - 0.3)));

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
    rivalFx: Array.from({ length: RIVALS }, () => ({ kind: 'run', left: 0 }) as RivalFx),
    rivalNext: Array.from({ length: RIVALS }, (_, i) => 120 + i * 70),
    fuel: 1,
    boostTo: 0,
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

/** One tick of the rivals: seeded boosts / slips now and then, cruising on the rubber band otherwise. */
function driveRivals(s: RaceState, mySpeed: number): RaceState {
  const length = s.core.puzzles;
  let core = s.core;
  const rivalFx = s.rivalFx.slice();
  const rivalNext = s.rivalNext.slice();
  const rivals = s.rivals.map((pos, i) => {
    if (pos >= length) return length;
    let fx = rivalFx[i] as RivalFx;
    if (fx.left > 0) fx = fx.left > 1 ? { ...fx, left: fx.left - 1 } : { kind: 'run', left: 0 };
    const next = (rivalNext[i] ?? 0) - 1;
    if (next <= 0) {
      const r = withRng(core, (rng) => ({ boost: rng.chance(0.6), wait: rng.int(150, 230) }));
      core = r.core;
      fx = r.value.boost ? { kind: 'boost', left: 40 } : { kind: 'slip', left: 50 };
      rivalNext[i] = r.value.wait;
    } else rivalNext[i] = next;
    rivalFx[i] = fx;
    const gap = pos - s.me;
    let v =
      rivalSpeed(s.core.shift, i) * band(gap) * (fx.kind === 'boost' ? 2.4 : fx.kind === 'slip' ? 0 : 1);
    // the hard end of the band: at the maximum lead a rival only keeps the child's own pace
    if (gap >= MAX_LEAD - 0.1) v = Math.min(v, mySpeed);
    return Math.min(length, pos + v / 60);
  });
  return { ...s, core, rivals, rivalFx, rivalNext };
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
        s = {
          ...s,
          core: recordAttempt(s.core, true, a.value),
          streak,
          gain,
          fuel: 1,
          boostTo: Math.min(length, s.me + gain),
          turbos: s.turbos + (turbo ? 1 : 0),
          phase: 'boost',
          phaseLeft: BOOST_TICKS,
        };
      } else {
        const tag = q.misconceptionMap[a.value];
        s = {
          ...s,
          core: recordAttempt(s.core, false, a.value, tag),
          streak: 0,
          gain: 0,
          tried: [...s.tried, a.value],
          lastWrong: tag ? { value: a.value, made: a.value, tag } : { value: a.value, made: a.value },
          phase: 'slip',
          phaseLeft: SLIP_TICKS,
        };
      }
    }
  }
  if (s.phase === 'start' || s.phase === 'finish') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    if (s.phase === 'start') return { ...s, phase: 'play', phaseLeft: 0 };
    return { ...s, core: { ...s.core, done: true }, phase: 'done' };
  }
  // ── everybody drives (play / boost / slip)
  let me = s.me;
  let fuel = s.fuel;
  let mySpeed = 0;
  if (s.phase === 'play') {
    mySpeed = BALANCE.race.cruise * Math.max(0.06, fuel);
    fuel = Math.max(0, fuel - 1 / (BALANCE.race.fuelSeconds * 60));
  } else if (s.phase === 'boost') {
    mySpeed = ((s.boostTo - s.me) / Math.max(1, s.phaseLeft)) * 60;
  }
  me = Math.min(length, me + mySpeed / 60);
  let core = s.core;
  const got = STAR_SQUARES.filter((sq) => sq <= me && !s.stars.includes(sq));
  if (got.length) core = { ...core, coins: core.coins + got.length * BALANCE.race.starCoin };
  s = driveRivals({ ...s, core, me, fuel, stars: got.length ? [...s.stars, ...got] : s.stars }, mySpeed);
  const finish = (x: RaceState): RaceState => ({
    ...x,
    me: length,
    // rivals already on the line came in first
    place: 1 + x.rivals.filter((r) => r >= length).length,
    phase: 'finish',
    phaseLeft: FINISH_TICKS,
  });
  if (s.phase === 'play') return s.me >= length ? finish(s) : s;
  const left = s.phaseLeft - 1;
  if (left > 0) return { ...s, phaseLeft: left };
  if (s.phase === 'slip') return { ...s, phase: 'play', phaseLeft: 0 };
  // boost over: the question is done; across the line → the finish show, otherwise the next question
  const next = advancePuzzle(s.core);
  if (s.me >= length - 1e-9) return finish({ ...s, core: { ...next, done: false } });
  return ask({ ...s, core: { ...next, done: false }, phase: 'play', phaseLeft: 0 });
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
