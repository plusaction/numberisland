/**
 * ⑥ 피자 가게 둘이서 — pure rules (P5).
 *
 * The child runs a toy pizza shop with a partner monster (피자랑). Customers come one at a time; roles swap
 * every order: the child BAKES (addition — "a slices with mushroom + b with cheese, how many in all?") or
 * PACKS (subtraction — "the order is n slices, m are in the box, how many more?"), and the partner does the
 * other half. The answer is one of three big pizza keys; a wrong key only makes the oven puff / the box
 * spill (funny, nothing is lost — P2). Every order can be solved exactly. The third order is always the VIP
 * (fixed order, not a lucky draw) and tips one more coin.
 */
import { BALANCE } from '../../domain/balance';
import type { Question, SkillId } from '../../domain/edu/types';
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

export type PizzaRole = 'bake' | 'pack';
export const BAKE_SKILLS: readonly SkillId[] = ['ADD_NOCARRY', 'ADD_CARRY', 'COMPOSE_10'];
export const PACK_SKILLS: readonly SkillId[] = ['SUB_NOBORROW', 'SUB_BORROW'];
export const CUSTOMERS = 5;
export const KEYS = 3;
export const KEY = (i: number) => 100 + i;
/** The VIP customer is always this order (0-based). */
export const VIP_ORDER = 2;
export const ENTER_TICKS = 90;
export const JAM_TICKS = 50;
/** Bake/pack → box → hand over → high-five, one continuous show. */
export const SERVE_TICKS = 260;

export interface Order {
  role: PizzaRole;
  customer: number;
  vip: boolean;
  /** bake: the two topping counts; pack: a = slices ordered, b = slices already in the box. */
  a: number;
  b: number;
  answer: number;
  /** Three keys (the answer + two near misses), ascending. */
  options: number[];
}

export type PizzaPhase = 'enter' | 'play' | 'jam' | 'serve' | 'done';

export interface PizzaState {
  core: RoundCore;
  order: Order | null;
  phase: PizzaPhase;
  phaseLeft: number;
  /** Keys tried in this order (dimmed). */
  tried: number[];
  lastWrong: { value: number; made: number; tag?: string } | null;
  served: number;
  vipServed: boolean;
}

export type PizzaAction = { t: 'pick'; id: number } | { t: 'hint' } | { t: 'retry' };

export const roleOf = (index: number): PizzaRole => (index % 2 === 0 ? 'bake' : 'pack');

/** A plain two-number sentence of the role's sign, every number 1..99 (a pack order needs ≥ 1 more). */
export function preferFor(role: PizzaRole): (q: Question) => boolean {
  return (q) =>
    q.form === 'EXPR' &&
    q.operands.length === 2 &&
    q.ops.length === 1 &&
    q.ops[0] === (role === 'bake' ? '+' : '-') &&
    q.operands.every((v) => Number.isInteger(v) && v >= 1 && v <= 99) &&
    q.answer >= 1 &&
    q.answer <= 99;
}

export function orderFromQuestion(
  q: Question,
  role: PizzaRole,
  customer: number,
  vip: boolean,
  rng: Rng,
): Order {
  const [a = 1, b = 1] = q.operands;
  const answer = q.answer;
  return { role, customer, vip, a, b, answer, options: answerOptions(q, answer, rng, KEYS, 1) };
}

function newOrder(s: PizzaState): PizzaState {
  const index = s.core.index;
  const role = roleOf(index);
  let core = nextStageQuestion(s.core, role === 'bake' ? BAKE_SKILLS : PACK_SKILLS, preferFor(role));
  const q = core.asked?.question;
  if (!q) return { ...s, core };
  // customers take turns (seeded start), so each round brings a different line-up
  const customer = (index + ((s.core.rng[0] >>> 0) % CUSTOMERS)) % CUSTOMERS;
  const r = withRng(core, (rng) => orderFromQuestion(q, role, customer, index === VIP_ORDER, rng));
  core = r.core;
  return { ...s, core, order: r.value, tried: [], lastWrong: null, phase: 'enter', phaseLeft: ENTER_TICKS };
}

export function initPizza(
  seed: number | string,
  level: Parameters<typeof initRound>[2],
  opts: RoundOptions = {},
): PizzaState {
  return newOrder({
    core: initRound('pizza', seed, level, { ...opts, puzzles: opts.puzzles ?? BALANCE.pizza.orders }),
    order: null,
    phase: 'play',
    phaseLeft: 0,
    tried: [],
    lastWrong: null,
    served: 0,
    vipServed: false,
  });
}

/** The right key. */
export function solvePizza(s: PizzaState): PizzaAction[] {
  const o = s.order;
  return o ? [{ t: 'pick', id: KEY(o.options.indexOf(o.answer)) }] : [];
}

export function stepPizza(state: PizzaState, input: InputFrame<PizzaAction>): PizzaState {
  if (state.phase === 'done') return state;
  let s: PizzaState = { ...state, core: { ...state.core, tick: state.core.tick + 1 } };
  for (const a of input.actions) {
    const o = s.order;
    if (!o) continue;
    // a hint may be asked while the customer is still walking in; everything else waits for 'play'
    if (a.t === 'hint' && (s.phase === 'play' || s.phase === 'enter')) s = { ...s, core: takeHint(s.core) };
    if (s.phase !== 'play') continue;
    if (a.t === 'retry' && s.core.puzzleHints >= 4) {
      const core = sameKindQuestion(s.core, preferFor(o.role));
      const q = core.asked?.question;
      if (q) {
        const r = withRng(core, (rng) => orderFromQuestion(q, o.role, o.customer, o.vip, rng));
        s = { ...s, core: r.core, order: r.value, tried: [], lastWrong: null };
      }
    }
    if (a.t === 'pick') {
      const given = s.order?.options[a.id - KEY(0)];
      if (given === undefined || !s.order) continue;
      const q = s.core.asked?.question;
      if (given === s.order.answer) {
        let core = recordAttempt(s.core, true, given);
        if (s.order.vip) core = { ...core, coins: core.coins + BALANCE.pizza.vipBonus };
        s = { ...s, core, phase: 'serve', phaseLeft: SERVE_TICKS };
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
  if (s.phase === 'enter' || s.phase === 'jam' || s.phase === 'serve') {
    const left = s.phaseLeft - 1;
    if (left > 0) return { ...s, phaseLeft: left };
    if (s.phase !== 'serve') return { ...s, phase: 'play', phaseLeft: 0 };
    const served = s.served + 1;
    const vipServed = s.vipServed || !!s.order?.vip;
    const core = advancePuzzle(s.core);
    if (core.done) return { ...s, core, phase: 'done', served, vipServed };
    return newOrder({ ...s, core, served, vipServed });
  }
  return s;
}

export const pizzaRules: StageRules<PizzaState, PizzaAction> = {
  id: 'pizza',
  init: (seed, level, opts) => initPizza(seed, level, opts),
  step: stepPizza,
  isDone: (s) => s.phase === 'done',
  summary: (s): RoundResult => {
    const r = roundSummary(s.core);
    const highlights = [...r.highlights];
    if (s.served >= s.core.puzzles) highlights.push('pizzaShop');
    if (s.vipServed) highlights.push('pizzaVip');
    return { ...r, highlights };
  },
};
