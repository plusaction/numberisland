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
import { generateQuestion } from '../../domain/edu/generate';
import type { Question, SkillId } from '../../domain/edu/types';
import type { PhaseTable } from '../../domain/fsm';
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
  /**
   * 꼬마 비틀이: an optional second target with a small balloon (bonus coins). The child aims by tapping a
   * zombie; a card goes to the aimed balloon. If it reaches the door it just toddles home — no knock,
   * nothing lost (P2), and a card it refuses is not a wrong answer.
   */
  mini: { id: number; value: number; walk: number; lane: number } | null;
  /** 0 = the main zombie, 1 = the little one. */
  aim: 0 | 1;
  /** The card in flight is for the little one. */
  hitMini: boolean;
  miniPopped: number;
  phase: ZombiePhase;
  phaseLeft: number;
}

export type ZombieAction =
  | { t: 'card'; id: number }
  | { t: 'hint' }
  | { t: 'retry' }
  | { t: 'aim'; who: 0 | 1; id?: number };
/** Target ids for the pointer / keyboard: the main zombie and the little one. */
export const AIM_ID = (who: 0 | 1) => 900 + who;

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
      kind < 2
        ? rng.int(1, 3)
        : kind < 4
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

/**
 * Friendly numbers (D39): the first wave's balloons are 10 or less, later waves 20 or less — the take-away
 * facts of grade 1. Only the hub's "어렵게" lets the adaptive engine bring two-digit balloons.
 */
export function easyZombieQuestion(wave: number, rng: Rng, avoid: readonly string[]): Question | null {
  const within10 = wave === 0 || rng.chance(0.35);
  for (let i = 0; i < 200; i++) {
    const q = generateQuestion({
      level: within10 ? 'L0_1' : 'A2',
      skill: within10 ? 'SUB_NOBORROW' : 'SUB_BORROW',
      rng,
      ...(i < 120 ? { avoid } : {}),
    });
    if (preferZombie(q) && (q.operands[0] as number) <= BALANCE.zombie.maxNumber) return q;
  }
  return null;
}

function spawn(s: ZombieState): ZombieState {
  const wave = Math.floor(s.core.index / perWave());
  let core = nextStageQuestion(
    s.core,
    ZOMBIE_SKILLS,
    preferZombie,
    s.core.shift > 0 ? undefined : (rng, avoid) => easyZombieQuestion(wave, rng, avoid),
  );
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  const id = core.index;
  const a = q.operands[0] as number;
  const boss = id === total(core) - 1;
  const r = withRng(core, (rng) => {
    const hand = handFor(q, rng);
    const lane = rng.int(0, LANES - 1);
    // the second zombie of each wave brings a little friend; one spare card becomes its exact take-away
    let mini: ZombieState['mini'] = null;
    if (id % perWave() === 1 && !boss) {
      const value = rng.int(2, 5);
      for (let i = 0; i < hand.length && !mini; i++) {
        const tryHand = hand.slice();
        tryHand[i] = -value;
        if (hand.includes(-value) || finisher(tryHand, a) < 0) continue;
        hand[i] = -value;
        mini = { id, value, walk: 0, lane: (lane + 1 + rng.int(0, LANES - 2)) % LANES };
      }
    }
    return { hand, lane, mini };
  });
  core = r.core;
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
      boss,
      used: 0,
    },
    slot: -1,
    eq: null,
    mini: r.value.mini,
    aim: 0,
    hitMini: false,
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
    mini: null,
    aim: 0,
    hitMini: false,
    miniPopped: 0,
    phase: 'wave',
    phaseLeft: WAVE_TICKS,
  });
}

/** The next card of a shortest finish. */
export function solveZombie(s: ZombieState): ZombieAction[] {
  if (!s.zombie) return [];
  const slot = finisher(s.hand, s.zombie.value);
  if (slot < 0) return [];
  // the shortest finish is for the main zombie: aim back at it first when needed
  return s.aim === 1
    ? [
        { t: 'aim', who: 0 },
        { t: 'card', id: slot },
      ]
    : [{ t: 'card', id: slot }];
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
          // new numbers, new cards: the little one's card is gone, so it goes home
          mini: null,
          aim: 0,
        };
      }
    }
    if (a.t === 'aim') s = { ...s, aim: a.who === 1 && s.mini ? 1 : 0 };
    if (a.t === 'card' && s.aim === 1 && s.mini) {
      const delta = s.hand[a.id];
      if (delta === undefined) continue;
      const to = s.mini.value + delta;
      if (to < 0 || to > 9) {
        // the little balloon refuses it: a bounce, not a wrong answer
        s = { ...s, slot: a.id, eq: null, phase: 'nope', phaseLeft: NOPE_TICKS };
      } else {
        s = {
          ...s,
          mini: { ...s.mini, value: to },
          hitMini: true,
          slot: a.id,
          eq: { from: s.mini.value, delta, to },
          phase: 'hit',
          phaseLeft: HIT_TICKS,
        };
      }
      continue;
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
    // the little one toddles too; at the door it simply turns for home
    if (s.mini) {
      const mw = s.mini.walk + BALANCE.zombie.miniWalkPerSecond / 60;
      s = mw >= 1 ? { ...s, mini: null, aim: 0 } : { ...s, mini: { ...s.mini, walk: mw } };
    }
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
    if (s.hitMini) {
      // the little balloon: exactly 0 pops it for bonus coins
      const popped = s.mini?.value === 0;
      s = {
        ...s,
        hitMini: false,
        ...(popped
          ? {
              mini: null,
              aim: 0 as const,
              miniPopped: s.miniPopped + 1,
              core: { ...s.core, coins: s.core.coins + BALANCE.zombie.miniBonus },
            }
          : {}),
      };
    } else if (z.value === 0) {
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
    if (s.miniPopped > 0) highlights.push('zombieMini');
    if (s.knocks === 0 && s.popped >= s.core.puzzles) highlights.push('zombieNoKnock');
    return { ...r, highlights };
  },
};

/** The phases as a table (docs + tests hold the step function to it; see `domain/fsm.ts`). */
export const ZOMBIE_PHASES_INITIAL: ZombiePhase = 'wave';
export const ZOMBIE_PHASES: PhaseTable<ZombiePhase> = {
  wave: { input: false, timed: true, to: ['play'], note: 'a new group arrives at the gate' },
  play: { input: true, timed: false, to: ['hit', 'nope', 'knock'], note: 'play a card on the balloon' },
  hit: { input: false, timed: true, to: ['play', 'pop'], note: 'the card lands, the number changes' },
  nope: { input: false, timed: true, to: ['play'], note: 'refused card (would go below 0)' },
  pop: { input: false, timed: true, to: ['play', 'wave', 'done'], note: 'exactly 0: the balloon pops' },
  knock: { input: false, timed: true, to: ['play'], note: 'the zombie bumps the door and hops back' },
  done: { input: false, timed: false, to: [], note: 'round over' },
};
