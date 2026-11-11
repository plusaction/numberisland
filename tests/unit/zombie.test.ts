import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import {
  finisher,
  HAND,
  initZombie,
  KNOCK_BACK,
  solveZombie,
  type ZombieAction,
  type ZombieState,
  zombieRules,
} from '../../src/stages/zombie/rules';

const step = (s: ZombieState, tick: number, actions: ZombieAction[] = []) =>
  zombieRules.step(s, { tick, actions });
const TOTAL = BALANCE.zombie.waves * BALANCE.zombie.perWave;

/** Plays a round. `pick` chooses the card each time it is the child's turn (default: the solver). */
function play(seed: string, level: string, pick?: (s: ZombieState) => ZombieAction[], think = 0) {
  let s = initZombie(seed, level as never);
  let tick = 0;
  let waited = 0;
  let maxCards = 0;
  while (s.phase !== 'done' && tick < 400_000) {
    let acts: ZombieAction[] = [];
    if (s.phase === 'play' && s.zombie) {
      // the hand can always finish the number with one or two cards
      expect(s.hand).toHaveLength(HAND);
      expect(
        finisher(s.hand, s.zombie.value),
        `no finish for ${s.zombie.value} with ${s.hand}`,
      ).toBeGreaterThanOrEqual(0);
      if (waited++ >= think) {
        acts = pick ? pick(s) : solveZombie(s);
        waited = 0;
      }
    }
    const before = s;
    s = step(s, ++tick, acts);
    expect(s.core.coins).toBeGreaterThanOrEqual(before.core.coins);
    expect(s.popped).toBeGreaterThanOrEqual(before.popped);
    if (s.zombie) {
      expect(s.zombie.value).toBeGreaterThanOrEqual(0);
      expect(s.zombie.value).toBeLessThanOrEqual(99);
      maxCards = Math.max(maxCards, s.zombie.used);
    }
  }
  return { s, ticks: tick, maxCards };
}

describe('[G1:zombie] 좀비 숫자 막기 규칙', () => {
  it('the solver pops every zombie in at most two cards, at every level; the last one is the boss', () => {
    for (const level of ['L0_1', 'A2', 'A3', 'A4', 'A6']) {
      for (let seed = 0; seed < 12; seed++) {
        const { s, maxCards } = play(`z-${level}-${seed}`, level);
        expect(s.phase).toBe('done');
        expect(s.popped).toBe(TOTAL);
        expect(maxCards).toBeLessThanOrEqual(2);
        expect(s.core.wrong).toBe(0);
        expect(s.bossDown).toBe(true);
        expect(s.knocks).toBe(0);
        const r = zombieRules.summary(s);
        expect(r.cleared).toBe(true);
        expect(r.highlights).toContain('zombieBoss');
        expect(r.highlights).toContain('zombieNoKnock');
      }
    }
  });

  it('a card that would go below 0 is refused: it stays in the hand, the number is unchanged', () => {
    let found = 0;
    for (let seed = 0; seed < 40 && found < 5; seed++) {
      let s = initZombie(`nope-${seed}`, 'A2');
      let tick = 0;
      while (s.phase !== 'play') s = step(s, ++tick);
      const z = s.zombie!;
      const slot = s.hand.findIndex((c) => z.value + c < 0);
      if (slot < 0) continue;
      found++;
      const hand = s.hand.slice();
      s = step(s, ++tick, [{ t: 'card', id: slot }]);
      expect(s.phase).toBe('nope');
      expect(s.zombie!.value).toBe(z.value);
      expect(s.hand).toEqual(hand);
      expect(s.core.wrong).toBe(1);
      expect(s.popped).toBe(0);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('any playable card keeps the number finishable (random play still ends the round)', () => {
    for (let seed = 0; seed < 10; seed++) {
      let n = seed * 7;
      // first a "wrong turn" (any card that is not refused), then the solver
      const { s } = play(`rand-${seed}`, 'A3', (st) => {
        const z = st.zombie!;
        n++;
        const ok = st.hand.map((c, i) => ({ c, i })).filter((x) => z.value + x.c >= 0 && z.value + x.c <= 99);
        return n % 3 === 0 && ok.length ? [{ t: 'card', id: ok[n % ok.length]!.i }] : solveZombie(st);
      });
      expect(s.phase).toBe('done');
      expect(s.popped).toBe(TOTAL);
    }
  });

  it('no game over: an ignored zombie bumps the door, hops back, and can still be popped', () => {
    let s = initZombie('idle', 'A3');
    let tick = 0;
    while (s.phase !== 'knock' && tick < 10_000) s = step(s, ++tick);
    expect(s.phase).toBe('knock');
    expect(s.knocks).toBe(1);
    const coins = s.core.coins;
    while (s.phase !== 'play') s = step(s, ++tick);
    expect(s.zombie!.walk).toBeCloseTo(KNOCK_BACK, 1);
    expect(s.core.coins).toBe(coins);
    expect(s.popped).toBe(0);
    // slow play (4 s a card) still finishes
    const slow = play('slow', 'A3', undefined, 240);
    expect(slow.s.phase).toBe('done');
    expect(slow.s.popped).toBe(TOTAL);
  });

  it('is deterministic for a seed (replay)', () => {
    const a = play('same', 'A4', undefined, 60);
    const b = play('same', 'A4', undefined, 60);
    expect(a.ticks).toBe(b.ticks);
    expect(a.s.core.coins).toBe(b.s.core.coins);
    expect(a.s.knocks).toBe(b.s.knocks);
  });
});
