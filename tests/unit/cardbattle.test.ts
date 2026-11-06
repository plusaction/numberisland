import { describe, expect, it } from 'vitest';
import {
  bestPlay,
  type CardAction,
  type CardState,
  cardRules,
  DEAL_TICKS,
  initCards,
  plays,
  solveCards,
  WINS_NEEDED,
} from '../../src/stages/cardbattle/rules';

const step = (s: CardState, tick: number, actions: CardAction[] = []) => cardRules.step(s, { tick, actions });

function playMatch(seed: string, level: string, shift: -1 | 0 | 1 = 0, perfect = true) {
  let s = initCards(seed, level as never, { shift });
  let tick = 0;
  const hands: number[][] = [];
  while (s.phase !== 'done' && tick < 20_000) {
    let acts: CardAction[] = [];
    if (s.phase === 'play' && s.duel) {
      hands.push(s.duel.hand);
      acts = perfect
        ? solveCards(s)
        : [{ t: 'card', id: 0 }, { t: 'card', id: 1 }, { t: 'op', op: '+' }, { t: 'play' }];
    }
    const coins = s.core.coins;
    s = step(s, ++tick, acts);
    expect(s.core.coins).toBeGreaterThanOrEqual(coins);
  }
  return { s, hands };
}

describe('[G1:cardbattle] 숫자 카드 배틀 규칙', () => {
  it('every hand holds an exact (PERFECT) pair; no play is ever negative', () => {
    for (const level of ['L0_1', 'A2', 'A3', 'A4', 'A6']) {
      for (let seed = 0; seed < 15; seed++) {
        let s = cardRules.init(`hand-${level}-${seed}`, level as never);
        for (let r = 0; r < 5 && s.duel; r++) {
          const d = s.duel;
          expect(bestPlay(d.hand, d.target).result).toBe(d.target);
          for (const p of [...plays(d.hand), ...plays(d.botHand)]) expect(p.result).toBeGreaterThanOrEqual(0);
          expect(d.target).toBeLessThanOrEqual(99);
          // move on to the next duel
          let tick = 0;
          while (s.phase !== 'play') s = step(s, ++tick);
          s = step(s, ++tick, solveCards(s));
          while (s.phase === 'reveal') s = step(s, ++tick);
          if (s.phase === 'done') break;
        }
      }
    }
  });

  it('playing the perfect pair never loses a duel; the match ends at 3 wins with no wrongs', () => {
    for (const shift of [-1, 0, 1] as const) {
      for (let seed = 0; seed < 10; seed++) {
        const { s } = playMatch(`win-${shift}-${seed}`, 'A2', shift);
        expect(s.losses).toBe(0);
        expect(s.wins + s.losses).toBeLessThanOrEqual(5);
        expect(s.core.wrong).toBe(0);
        expect(cardRules.summary(s).highlights).toContain('cardPerfect');
        if (s.wins >= WINS_NEEDED) expect(cardRules.summary(s).highlights).toContain('cardChampion');
        expect(cardRules.summary(s).stars).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('a duel starts with a short deal (input waits); only two cards can be up at once', () => {
    let s = cardRules.init('deal-1', 'A2');
    expect(s.phase).toBe('deal');
    s = step(s, 1, [{ t: 'card', id: 0 }]);
    expect(s.picked).toEqual([]);
    for (let i = 0; i < DEAL_TICKS; i++) s = step(s, i + 2);
    s = step(s, 100, [
      { t: 'card', id: 0 },
      { t: 'card', id: 1 },
      { t: 'card', id: 2 },
    ]);
    expect(s.picked).toEqual([1, 2]);
    s = step(s, 101, [{ t: 'card', id: 1 }]);
    expect(s.picked).toEqual([2]);
    s = step(s, 102, [{ t: 'play' }]);
    expect(s.phase).toBe('play'); // needs two cards
  });

  it('the monsters differ: the robot finds its best play far more often than the chick', () => {
    const rate = (shift: -1 | 1) => {
      let best = 0;
      let n = 0;
      for (let seed = 0; seed < 120; seed++) {
        const s = initCards(`bot-${shift}-${seed}`, 'A2', { shift });
        const d = s.duel;
        if (!d) continue;
        n++;
        if (Math.abs(d.target - d.bot.result) === Math.abs(d.target - bestPlay(d.botHand, d.target).result))
          best++;
      }
      return best / n;
    };
    expect(rate(1)).toBeGreaterThan(rate(-1) + 0.25);
  });
});
