/**
 * ② 좀비 숫자 막기 — pure rules (P5).
 *
 * Wobbly, friendly "비틀이" zombies toddle across the yard toward the house, one at a time, each holding a
 * number balloon. The child plays cards from a hand of four (−k takes away, +k adds): every card changes
 * the balloon's number, and exactly 0 pops it — the zombie plops down happily and joins the garden party.
 * A card that would go below 0 is refused with a "안 돼요" wiggle and stays in the hand. After every card a
 * new one is dealt so that the number can always still be brought to 0 (with one or two cards).
 *
 * Each zombie is a subtraction from the adaptive engine: a − b = c gives the balloon a and the cards −b and
 * −c, so finishing in two cards is exactly that take-away fact (a − b = c, then c − c = 0).
 *
 * No failing (P2): a zombie that reaches the house only bumps the door ("쿵"), is startled and hops back.
 * It walks slower after refused cards, and never while a hint is open. Three waves; the very last zombie is
 * the big boss 비틀이 (fixed order, +coins).
 */
import { BALANCE } from '../../domain/balance';
import type { Question, SkillId } from '../../domain/edu/types';
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

export const ZOMBIE_SKILLS: readonly SkillId[] = ['SUB_NOBORROW', 'SUB_BORROW'];
export const HAND = 4;
export const LANES = 3;
export const WAVE_TICKS = 100;
export const HIT_TICKS = 34;
export const NOPE_TICKS = 30;
export const POP_TICKS = 85;
export const KNOCK_TICKS = 70;
/** Where a startled zombie lands after bumping the door (0 = gate, 1 = door). */
export const KNOCK_BACK = 0.4;

export type ZombiePhase = 'wave' | 'play' | 'hit' | 'nope' | 'pop' | 'knock' | 'done';

export interface Zombie {
  /** 0-based count over the round (its look and lane derive from it). */
  id: number;
  lane: number;
  /** The number on the balloon now. */
  value: number;
  /** The number it arrived with. */
  start: number;
  /** 0 (garden gate) … 1 (house door). */
  walk: number;
  boss: boolean;
  /** Cards that have landed on it. */
  used: number;
}

export interface ZombieState {
  core: RoundCore;
  zombie: Zombie | null;
  /** Card deltas by slot (−k / +k). */
  hand: number[];
  /** The slot just played (its new card is dealt when the throw lands) or refused. */
  slot: number;
  /** The last sum shown as a popup: from + delta = to. */
  eq: { from: number; delta: number; to: number } | null;
  wave: number;
  /** Zombies popped so far (they gather in the garden). */
  popped: number;
  knocks: number;
  bossDown: boolean;
  phase: ZombiePhase;
  phaseLeft: number;
}

export type ZombieAction = { t: 'card'; id: number } | { t: 'hint' } | { t: 'retry' };

/** a − b = c with a 2..99 and b ≥ 1. */
export function preferZombie(q: Question): boolean {
  const [a = 0, b = 0] = q.operands;
  return (
    q.form === 'EXPR' &&
    q.operands.length === 2 &&
    q.ops[0] === '-' &&
    a >= 2 &&
    a <= 99 &&
    b >= 1 &&
    q.answer >= 0 &&
    q.answer === a - b
  );
}

/** Can `value` be brought to exactly 0 with one or two of these cards? Returns the first slot to play. */
export function finisher(hand: readonly number[], value: number, skip = -1): number {
  for (let i = 0; i < hand.length; i++) if (i !== skip && hand[i] === -value) return i;
  for (let i = 0; i < hand.length; i++) {
    if (i === skip) continue;
    const first = hand[i] as number;
    if (first >= 0 || value + first <= 0) continue;
    for (let j = 0; j < hand.length; j++) if (j !== i && j !== skip && hand[j] === -(value + first)) return i;
  }
  return -1;
}

/**
 * A card that is not needed: a small +k, a take-away near half the number, or — a trap worth meeting — one
 * a little bigger than the number itself (it will be refused: "you cannot take away more than there is").
 */
function spare(value: number, rng: Rng, avoid: readonly number[]): number {
  for (let i = 0; i < 20; i++) {
    const kind = rng.int(0, 9);
    const c =
      kind < 3
        ? rng.int(1, 5)
        : kind < 6
          ? -Math.min(99, value + rng.int(1, 3))
          : -Math.max(1, Math.round(value / 2) + rng.pick([-2, -1, 1, 2, 3]));
    if (!avoid.includes(c) && value + c <= 99) return c;
  }
  return 1;
}

export function handFor(q: Question, rng: Rng): number[] {
  const [a = 2, b = 1] = q.operands;
  const c = q.answer;
  const need = c === 0 ? [-a] : [-b, -c];
  const hand = need.slice();
  while (hand.length < HAND) hand.push(spare(a, rng, hand));
  return rng.shuffle(hand);
}

const total = (core: RoundCore) => core.puzzles;
const perWave = () => BALANCE.zombie.perWave;

function spawn(s: ZombieState): ZombieState {
  let core = nextStageQuestion(s.core, ZOMBIE_SKILLS, preferZombie);
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  const id = core.index;
  const r = withRng(core, (rng) => ({ hand: handFor(q, rng), lane: rng.int(0, LANES - 1) }));
  core = r.core;
  const a = q.operands[0] as number;
  return {
    ...s,
    core,
    hand: r.value.hand,
    zombie: {
      id,
      lane: r.value.lane,
      value: a,
      start: a,
      walk: 0,
      boss: id === total(core) - 1,
      used: 0,
    },
    slot: -1,
    eq: null,
  };
}

export function initZombie(
  seed: number | string,
  level: Parameters<typeof initRound>[2],
  opts: RoundOptions = {},
): ZombieState {
  const core = initRound('zombie', seed, level, {
    ...opts,
    puzzles: opts.puzzles ?? BALANCE.zombie.waves * BALANCE.zombie.perWave,
  });
  return spawn({
    core,
    zombie: null,
    hand: [],
    slot: -1,
    eq: null,
    wave: 0,
    popped: 0,
    knocks: 0,
    bossDown: false,
    phase: 'wave',
    phaseLeft: WAVE_TICKS,
  });
}

/** The next card of a shortest finish. */
export function solveZombie(s: ZombieState): ZombieAction[] {
  if (!s.zombie) return [];
  const slot = finisher(s.hand, s.zombie.value);
  return slot >= 0 ? [{ t: 'card', id: slot }] : [];
}

export function stepZombie(state: ZombieState, input: InputFrame<ZombieAction>): ZombieState {
  if (state.phase === 'done') return state;
  let s: ZombieState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  for (const a of input.actions) {
    const z = s.zombie;
    if (!z) continue;
    if (a.t === 'hint' && (s.phase === 'play' || s.phase === 'wave')) s = { ...s, core: takeHint(s.core) };
    if (s.phase !== 'play') continue;
    if (a.t === 'retry' && s.core.puzzleHints >= 4) {
      const core = sameKindQuestion(s.core, preferZombie);
      const q = core.asked?.question;
      if (q) {
        const r = withRng(core, (rng) => handFor(q, rng));
        const n = q.operands[0] as number;
        s = {
          ...s,
          core: r.core,
          hand: r.value,
          zombie: { ...z, value: n, start: n, walk: Math.min(z.walk, 0.3), used: 0 },
          eq: null,
        };
      }
    }
    if (a.t === 'card') {
      const delta = s.hand[a.id];
      if (delta === undefined) continue;
      const to = z.value + delta;
      if (to < 0 || to > 99) {
        // refused: the card stays, the child learns "you cannot take away more than there is"
        s = {
          ...s,
          core: recordAttempt(s.core, false, Math.abs(delta)),
          slot: a.id,
          eq: null,
          phase: 'nope',
          phaseLeft: NOPE_TICKS,
        };
      } else {
        s = {
          ...s,
          zombie: { ...z, value: to, used: z.used + 1 },
          slot: a.id,
          eq: { from: z.value, delta, to },
          phase: 'hit',
          phaseLeft: HIT_TICKS,
        };
      }
    }
  }
  const z = s.zombie;
  // the zombie toddles on while the child thinks (slower after refused cards); never during the shows
  if (z && (s.phase === 'play' || s.phase === 'nope')) {
    const slow = 1 / (1 + 0.6 * s.core.puzzleWrong);
    const walk = z.walk + (BALANCE.zombie.walkPerSecond * slow) / 60;
    if (walk >= 1 && s.phase === 'play')
      return {
        ...s,
        zombie: { ...z, walk: 1 },
        knocks: s.knocks + 1,
        phase: 'knock',
        phaseLeft: KNOCK_TICKS,
      };
    s = { ...s, zombie: { ...z, walk: Math.min(1, walk) } };
  }
  if (s.phase === 'play') return s;
  const left = s.phaseLeft - 1;
  if (left > 0) {
    // startled: hop back from the door over the knock show
    if (s.phase === 'knock' && z) {
      const k = 1 - left / KNOCK_TICKS;
      return { ...s, phaseLeft: left, zombie: { ...z, walk: 1 - (1 - KNOCK_BACK) * Math.min(1, k * 1.4) } };
    }
    return { ...s, phaseLeft: left };
  }
  if (s.phase === 'wave' || s.phase === 'nope' || s.phase === 'knock')
    return { ...s, phase: 'play', phaseLeft: 0 };
  if (s.phase === 'hit' && z) {
    if (z.value === 0) {
      let core = recordAttempt(s.core, true, s.core.asked?.question.answer ?? 0);
      if (z.boss) core = { ...core, coins: core.coins + BALANCE.zombie.bossBonus };
      return { ...s, core, bossDown: s.bossDown || z.boss, phase: 'pop', phaseLeft: POP_TICKS };
    }
    // deal a new card into the played slot: the number must stay finishable with one or two cards
    const r = withRng(s.core, (rng) => {
      const hand = s.hand.slice();
      const others = hand.filter((_, i) => i !== s.slot);
      if (finisher(hand, z.value, s.slot) >= 0) hand[s.slot] = spare(z.value, rng, others);
      else {
        // complete a pair with a take-away already in the hand when there is one, else the exact card
        const part = others.find((c) => c < 0 && z.value + c > 0);
        hand[s.slot] = part !== undefined && rng.chance(0.5) ? -(z.value + part) : -z.value;
      }
      return hand;
    });
    return { ...s, core: r.core, hand: r.value, slot: -1, phase: 'play', phaseLeft: 0 };
  }
  // pop over: next zombie (a wave cut between waves) or the end
  const popped = s.popped + 1;
  const core = advancePuzzle(s.core);
  if (core.done) return { ...s, core, popped, zombie: null, phase: 'done' };
  const wave = Math.floor(core.index / perWave());
  const next = spawn({ ...s, core, popped, wave });
  return wave !== s.wave
    ? { ...next, phase: 'wave', phaseLeft: WAVE_TICKS }
    : { ...next, phase: 'play', phaseLeft: 0 };
}

export const zombieRules: StageRules<ZombieState, ZombieAction> = {
  id: 'zombie',
  init: (seed, level, opts) => initZombie(seed, level, opts),
  step: stepZombie,
  isDone: (s) => s.phase === 'done',
  summary: (s): RoundResult => {
    const r = roundSummary(s.core);
    const highlights = [...r.highlights];
    if (s.bossDown) highlights.push('zombieBoss');
    if (s.knocks === 0 && s.popped >= s.core.puzzles) highlights.push('zombieNoKnock');
    return { ...r, highlights };
  },
};
