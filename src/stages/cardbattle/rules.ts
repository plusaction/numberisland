/**
 * ⑦ 숫자 카드 배틀 — pure rules (P5).
 *
 * A match against a toy monster: each round shows a target T. The child holds three cards, picks two and
 * + or − (always bigger − smaller, so no negatives), and plays them; the monster plays its own pair. The
 * result closer to T wins the round (the difference is a subtraction, drawn on a number line). Exactly T is
 * a PERFECT. First to 3 round wins, at most 5 rounds; a tie scores for nobody.
 *
 * The child's hand always holds a pair that makes T exactly (it comes from the adaptive engine's question:
 * its two operands + one more card), so a child who finds it can never lose a round. Picking the exact pair
 * is what counts as "correct" for learning; losing a round costs nothing (P2).
 */
import { BALANCE } from '../../domain/balance';
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

export const CARD_SKILLS: readonly SkillId[] = ['ADD_NOCARRY', 'ADD_CARRY', 'SUB_NOBORROW', 'SUB_BORROW'];
export const HAND = 3;
/** Keyboard / pointer ids: cards 0..2, the + and − chips, the "play" button. */
export const OP_PLUS = 10;
export const OP_MINUS = 11;
export const DEAL_TICKS = 70;
export const REVEAL_TICKS = 230;
export const WINS_NEEDED = 3;

export type BotId = 'chick' | 'octopus' | 'robot';
/** How often each monster finds its best play (the rest of the time it plays any pair). */
export const BOT_SKILL: Record<BotId, number> = { chick: 0.25, octopus: 0.55, robot: 0.85 };

export interface Play {
  cards: [number, number];
  op: Op;
  result: number;
}

export interface Duel {
  target: number;
  hand: number[];
  botHand: number[];
  /** The monster's play, fixed when the round is dealt (shown at the reveal). */
  bot: Play;
}

export type CardPhase = 'deal' | 'play' | 'reveal' | 'done';

export interface CardState {
  core: RoundCore;
  bot: BotId;
  duel: Duel | null;
  picked: number[];
  op: Op;
  phase: CardPhase;
  phaseLeft: number;
  /** The child's play this round (set at "play"). */
  mine: Play | null;
  /** -1 the monster won the round, 0 tie, 1 the child won. */
  outcome: -1 | 0 | 1 | null;
  wins: number;
  losses: number;
  perfects: number;
}

export type CardAction =
  | { t: 'card'; id: number }
  | { t: 'op'; op: Op }
  | { t: 'play' }
  | { t: 'hint' }
  | { t: 'retry' };

/** + adds; − is always bigger minus smaller (grade 1: no negative results). */
export const combine = (a: number, b: number, op: Op) => (op === '+' ? a + b : Math.abs(a - b));
export const distance = (target: number, r: number) => Math.abs(target - r);

/** Every play a hand allows (3 pairs × 2 ops). */
export function plays(hand: readonly number[]): Play[] {
  const out: Play[] = [];
  for (let i = 0; i < hand.length; i++)
    for (let j = i + 1; j < hand.length; j++)
      for (const op of ['+', '-'] as const)
        out.push({ cards: [i, j], op, result: combine(hand[i] as number, hand[j] as number, op) });
  return out;
}

export function bestPlay(hand: readonly number[], target: number): Play {
  return plays(hand).reduce((a, b) => (distance(target, b.result) < distance(target, a.result) ? b : a));
}

/** Questions that make a good duel: two positive operands, a target 2..99. */
export function preferCards(q: Question): boolean {
  return (
    q.form === 'EXPR' &&
    q.operands.length === 2 &&
    q.operands.every((v) => v > 0 && v <= 99) &&
    q.answer >= 2 &&
    q.answer <= 99
  );
}

const botFor = (shift: number): BotId => (shift < 0 ? 'chick' : shift > 0 ? 'robot' : 'octopus');

export function duelFromQuestion(q: Question, bot: BotId, rng: Rng): Duel {
  const target = q.answer;
  const [a = 1, b = 1] = q.operands;
  const top = Math.max(9, Math.max(a, b) + 5);
  // the third card: a near miss, never one that also makes target with a or b (one clear perfect pair)
  let c = 1;
  for (let i = 0; i < 40; i++) {
    c = Math.max(1, Math.min(top, (rng.chance(0.5) ? a : b) + rng.pick([-3, -2, -1, 1, 2, 3])));
    const alt = plays([a, b, c]).filter((p) => p.result === target && p.cards.includes(2));
    if (c !== a && c !== b && alt.length === 0) break;
  }
  const hand = rng.shuffle([a, b, c]);
  // the monster's hand: around the target, sometimes spot on
  const x = rng.int(1, Math.max(1, target - 1));
  const off = rng.pick([0, 0, 1, -1, 2, -2, 3]);
  const y = Math.max(1, target - x + off);
  const z = rng.int(1, top);
  const botHand = rng.shuffle([x, y, z]);
  const all = plays(botHand);
  const play = rng.chance(BOT_SKILL[bot]) ? bestPlay(botHand, target) : rng.pick(all);
  return { target, hand, botHand, bot: play };
}

function deal(s: CardState): CardState {
  let core = nextStageQuestion(s.core, CARD_SKILLS, preferCards);
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  const r = withRng(core, (rng) => duelFromQuestion(q, s.bot, rng));
  core = r.core;
  return {
    ...s,
    core,
    duel: r.value,
    picked: [],
    op: '+',
    phase: 'deal',
    phaseLeft: DEAL_TICKS,
    mine: null,
    outcome: null,
  };
}

export function initCards(
  seed: number | string,
  level: Parameters<typeof initRound>[2],
  opts: RoundOptions = {},
): CardState {
  const core = initRound('cardbattle', seed, level, {
    ...opts,
    puzzles: opts.puzzles ?? BALANCE.cards.rounds,
  });
  return deal({
    core,
    bot: botFor(core.shift),
    duel: null,
    picked: [],
    op: '+',
    phase: 'play',
    phaseLeft: 0,
    mine: null,
    outcome: null,
    wins: 0,
    losses: 0,
    perfects: 0,
  });
}

/** Actions that win the round with a PERFECT: the exact pair, its op, play. */
export function solveCards(s: CardState): CardAction[] {
  const d = s.duel;
  if (!d) return [];
  const best = bestPlay(d.hand, d.target);
  const acts: CardAction[] = [];
  for (const id of s.picked) if (!best.cards.includes(id)) acts.push({ t: 'card', id });
  for (const id of best.cards) if (!s.picked.includes(id)) acts.push({ t: 'card', id });
  if (s.op !== best.op) acts.push({ t: 'op', op: best.op });
  acts.push({ t: 'play' });
  return acts;
}

export function stepCards(state: CardState, input: InputFrame<CardAction>): CardState {
  if (state.phase === 'done') return state;
  let s: CardState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  for (const a of input.actions) {
    const d = s.duel;
    if (!d) continue;
    if (a.t === 'hint' && (s.phase === 'play' || s.phase === 'deal')) s = { ...s, core: takeHint(s.core) };
    if (s.phase !== 'play') continue;
    if (a.t === 'retry' && s.core.puzzleHints >= 4) {
      const core = sameKindQuestion(s.core, preferCards);
      const q = core.asked?.question;
      if (q) {
        const r = withRng(core, (rng) => duelFromQuestion(q, s.bot, rng));
        s = { ...s, core: r.core, duel: r.value, picked: [], op: '+' };
      }
    }
    if (a.t === 'card' && a.id >= 0 && a.id < HAND) {
      if (s.picked.includes(a.id)) s = { ...s, picked: s.picked.filter((x) => x !== a.id) };
      else s = { ...s, picked: [...s.picked, a.id].slice(-2) };
    }
    if (a.t === 'op') s = { ...s, op: a.op };
    if (a.t === 'play' && s.picked.length === 2) {
      const [i, j] = s.picked as [number, number];
      const result = combine(d.hand[i] as number, d.hand[j] as number, s.op);
      const mine: Play = { cards: [i, j], op: s.op, result };
      const me = distance(d.target, result);
      const it = distance(d.target, d.bot.result);
      const outcome: -1 | 0 | 1 = me < it ? 1 : me > it ? -1 : 0;
      const perfect = result === d.target;
      const q = s.core.asked?.question;
      let core = recordAttempt(s.core, perfect, result, perfect ? undefined : q?.misconceptionMap[result]);
      if (perfect) core = { ...core, coins: core.coins + BALANCE.cards.perfectBonus };
      s = {
        ...s,
        core,
        mine,
        outcome,
        phase: 'reveal',
        phaseLeft: REVEAL_TICKS,
        wins: s.wins + (outcome === 1 ? 1 : 0),
        losses: s.losses + (outcome === -1 ? 1 : 0),
        perfects: s.perfects + (perfect ? 1 : 0),
      };
    }
  }
  if (s.phase === 'deal' || s.phase === 'reveal') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    if (s.phase === 'deal') return { ...s, phase: 'play', phaseLeft: 0 };
    const over = s.wins >= WINS_NEEDED || s.losses >= WINS_NEEDED;
    // every duel moves on, perfect or not (it was played and recorded); first to 3 ends the match
    let core = advancePuzzle(s.core);
    if (over) core = { ...core, done: true };
    if (core.done) return { ...s, core, phase: 'done' };
    return deal({ ...s, core });
  }
  return s;
}

export const cardRules: StageRules<CardState, CardAction> = {
  id: 'cardbattle',
  init: (seed, level, opts) => initCards(seed, level, opts),
  step: stepCards,
  isDone: (s) => s.phase === 'done',
  summary: (s): RoundResult => {
    // a match may end early (first to 3): it is complete after the duels actually played
    const r = roundSummary({ ...s.core, puzzles: Math.max(1, Math.min(s.core.puzzles, s.core.index)) });
    const highlights = [...r.highlights];
    if (s.wins >= WINS_NEEDED) highlights.push('cardChampion');
    if (s.perfects) highlights.push('cardPerfect');
    return { ...r, highlights };
  },
};
