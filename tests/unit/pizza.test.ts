import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import {
  BAKE_SKILLS,
  initPizza,
  KEY,
  PACK_SKILLS,
  type PizzaAction,
  type PizzaState,
  pizzaRules,
  roleOf,
  solvePizza,
  VIP_ORDER,
} from '../../src/stages/pizza/rules';

const step = (s: PizzaState, tick: number, actions: PizzaAction[] = []) =>
  pizzaRules.step(s, { tick, actions });

/** Plays a whole round; `wrongFirst` presses a wrong key before the right one on every order. */
function playRound(seed: string, level: string, wrongFirst = false) {
  let s = initPizza(seed, level as never);
  let tick = 0;
  const orders: NonNullable<PizzaState['order']>[] = [];
  let lastIndex = -1;
  while (s.phase !== 'done' && tick < 20_000) {
    let acts: PizzaAction[] = [];
    if (s.phase === 'play' && s.order) {
      if (s.core.index !== lastIndex) {
        orders.push(s.order);
        lastIndex = s.core.index;
        if (wrongFirst) {
          const wrong = s.order.options.findIndex((v) => v !== s.order?.answer);
          acts = [{ t: 'pick', id: KEY(wrong) }];
        }
      }
      if (!acts.length) acts = solvePizza(s);
    }
    const coins = s.core.coins;
    const index = s.core.index;
    s = step(s, ++tick, acts);
    expect(s.core.coins).toBeGreaterThanOrEqual(coins);
    expect(s.core.index).toBeGreaterThanOrEqual(index);
  }
  return { s, orders };
}

describe('[G1:pizza] 피자 가게 규칙', () => {
  it('roles swap every order: bake = addition, pack = subtraction, every order solvable (0 < answer ≤ 99)', () => {
    for (const level of ['L0_1', 'A2', 'A3', 'A4', 'A6']) {
      for (let seed = 0; seed < 15; seed++) {
        const { s, orders } = playRound(`p-${level}-${seed}`, level);
        expect(s.phase).toBe('done');
        expect(orders).toHaveLength(BALANCE.pizza.orders);
        orders.forEach((o, i) => {
          expect(o.role).toBe(roleOf(i));
          expect(o.answer).toBe(o.role === 'bake' ? o.a + o.b : o.a - o.b);
          expect(o.answer).toBeGreaterThanOrEqual(1);
          expect(o.answer).toBeLessThanOrEqual(99);
          expect(o.options).toContain(o.answer);
          expect(new Set(o.options).size).toBe(o.options.length);
          expect(o.options.length).toBe(3);
          expect(o.vip).toBe(i === VIP_ORDER);
        });
      }
    }
  });

  it('the asked question uses the role skills', () => {
    let s = initPizza('skills', 'A3');
    let tick = 0;
    const seen: string[] = [];
    while (s.phase !== 'done' && tick < 20_000) {
      if (s.phase === 'play' && s.core.asked && seen.length === s.core.index) {
        const skill = s.core.asked.question.skill;
        expect((roleOf(s.core.index) === 'bake' ? BAKE_SKILLS : PACK_SKILLS).includes(skill)).toBe(true);
        seen.push(skill);
      }
      s = step(s, ++tick, s.phase === 'play' ? solvePizza(s) : []);
    }
    expect(seen.length).toBe(BALANCE.pizza.orders);
  });

  it('a wrong key costs nothing: the order stays, the key is marked tried, the round still finishes', () => {
    const { s } = playRound('wrong', 'A3', true);
    expect(s.phase).toBe('done');
    expect(s.core.wrong).toBe(BALANCE.pizza.orders);
    expect(s.served).toBe(BALANCE.pizza.orders);
  });

  it('input waits during the walk-in, the VIP tips a coin, highlights name the shop and the VIP', () => {
    let s = initPizza('vip', 'A3');
    expect(s.phase).toBe('enter');
    const early = step(s, 1, solvePizza(s));
    expect(early.phase).toBe('enter');
    expect(early.core.correct).toBe(0);
    let tick = 0;
    let vipCoins = 0;
    while (s.phase !== 'done' && tick < 20_000) {
      const before = s.core.coins;
      const vip = s.order?.vip && s.phase === 'play';
      s = step(s, ++tick, s.phase === 'play' ? solvePizza(s) : []);
      if (vip && s.phase === 'serve') vipCoins = s.core.coins - before;
    }
    expect(vipCoins).toBeGreaterThanOrEqual(BALANCE.pizza.vipBonus + 1);
    expect(s.vipServed).toBe(true);
    const r = pizzaRules.summary(s);
    expect(r.highlights).toContain('pizzaShop');
    expect(r.highlights).toContain('pizzaVip');
  });

  it('is deterministic for a seed (replay)', () => {
    const a = playRound('same', 'A4');
    const b = playRound('same', 'A4');
    expect(a.orders).toEqual(b.orders);
    expect(a.s.core.coins).toBe(b.s.core.coins);
  });
});
