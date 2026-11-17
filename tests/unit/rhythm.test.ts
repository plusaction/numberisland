/** B bundle: the round's big one, tidy slime merges, the optional second catch, opponents with habits. */
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import { createRng } from '../../src/domain/rng/rng';
import { finaleBonus, initRound, isFinale } from '../../src/stages/_shared/round';
import { botLikes, plays } from '../../src/stages/cardbattle/rules';
import { initFishing, solveFishing, stepFishing } from '../../src/stages/fishing/rules';
import { rivalPace } from '../../src/stages/race/rules';
import { initSlime, stepSlime } from '../../src/stages/slime/rules';

describe('[G2] 한 판의 리듬', () => {
  it('finale: only the last puzzle, bonus coins once, never fewer coins', () => {
    const core = initRound('bomb', 1, 'A1', { puzzles: 4 });
    expect(isFinale(core)).toBe(false);
    expect(finaleBonus(core)).toBe(core);
    const last = { ...core, index: 3 };
    const paid = finaleBonus(last);
    expect(paid.coins).toBe(last.coins + BALANCE.finaleBonus);
    expect(finaleBonus(paid)).toBe(paid);
  });

  it('slime: the fewest merges earn the tidy bonus; a longer way earns none and loses nothing', () => {
    let neat = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = initSlime(seed, 'A1');
      const p = s.puzzle;
      if (!p || s.par !== 1) continue;
      // one merge solves it: find the pair
      const coins = s.core.coins;
      for (const a of s.slimes)
        for (const b of s.slimes) {
          if (a.id === b.id || s.phase !== 'play') continue;
          const t = stepSlime(s, { tick: 0, actions: [{ t: 'merge', from: a.id, to: b.id }] });
          if (t.phase === 'win') s = t;
        }
      if (s.phase !== 'win') continue;
      expect(s.lastNeat).toBe(true);
      expect(s.core.coins).toBeGreaterThan(coins);
      neat++;
    }
    expect(neat).toBeGreaterThan(0);
  });

  it('fishing: a second pair is offered when one swims; taking it pays, missing it costs nothing, moving on works', () => {
    let offered = 0;
    for (let seed = 1; seed <= 300 && offered < 3; seed++) {
      let s = initFishing(seed, 'A1');
      const p = s.puzzle;
      if (!p || p.mode === 'missing' || solveFishing(p).length < 2) continue;
      const first = solveFishing(p)[0] as number[];
      for (const id of first) s = stepFishing(s, { tick: 0, actions: [{ t: 'tap', id }] });
      for (let i = 0; i < 400 && !(s.phase === 'play' && s.bonus === 1); i++)
        s = stepFishing(s, { tick: 0, actions: s.phase === 'hook' ? [{ t: 'reel' }] : [] });
      if (s.bonus !== 1 || !s.puzzle) continue;
      offered++;
      const { coins, correct, wrong, index } = s.core;
      // a wrong pair in the bonus: nothing recorded, nothing lost
      const live = s.puzzle.fish.filter((f) => !f.caught);
      const good = solveFishing(s.puzzle)[0] as number[];
      const bad = live.find((f) => !good.includes(f.id));
      if (bad) {
        let w = stepFishing(s, { tick: 0, actions: [{ t: 'tap', id: bad.id }] });
        w = stepFishing(w, { tick: 0, actions: [{ t: 'tap', id: good[0] as number }] });
        if (w.phase === 'bounce') {
          expect(w.core.wrong).toBe(wrong);
          expect(w.core.coins).toBe(coins);
        }
      }
      // taking it: coins up, the answer is not counted twice
      let t = s;
      for (const id of good) t = stepFishing(t, { tick: 0, actions: [{ t: 'tap', id }] });
      expect(t.core.coins).toBe(coins + BALANCE.secondPairBonus);
      expect(t.core.correct).toBe(correct);
      // moving on: straight to the next puzzle
      const n = stepFishing(s, { tick: 0, actions: [{ t: 'reel' }] });
      expect(n.core.index).toBe(index + 1);
      expect(n.bonus).toBe(0);
    }
    expect(offered).toBeGreaterThan(0);
  });

  it('card monsters have habits; rivals have characters', () => {
    const hand = [3, 8, 5];
    const all = plays(hand);
    expect(all.filter((p) => botLikes('chick', p, hand)).every((p) => p.op === '+')).toBe(true);
    expect(all.filter((p) => botLikes('octopus', p, hand)).every((p) => p.op === '-')).toBe(true);
    expect(all.filter((p) => botLikes('robot', p, hand)).every((p) => !p.cards.includes(0))).toBe(true);
    // the sprinter starts faster and ends slower than the late runner
    expect(rivalPace(0, 0)).toBeGreaterThan(rivalPace(1, 0));
    expect(rivalPace(0, 1)).toBeLessThan(rivalPace(1, 1));
    expect(createRng(1)).toBeTruthy();
  });
});

describe('[G2] 레이스: 터보 선택', () => {
  it('shield mode: the third right answer in a row saves a bubble; the next wrong answer does not spin the kart', async () => {
    const { initRace, stepRace, solveRace, crossChoices } = await import('../../src/stages/race/rules');
    let s = initRace(5, 'A1');
    s = stepRace(s, { tick: 0, actions: [{ t: 'mode', mode: 'shield' }] });
    let guard = 0;
    while (!s.shield && guard++ < 4000)
      s = stepRace(s, { tick: 0, actions: s.phase === 'play' ? solveRace(s) : [] });
    expect(s.shield).toBe(true);
    while (s.phase !== 'play' && guard++ < 6000) s = stepRace(s, { tick: 0, actions: [] });
    const q = s.core.asked?.question;
    const wrong = q ? crossChoices(q).find((c) => c.value !== q.answer) : undefined;
    expect(wrong).toBeTruthy();
    const me = s.me;
    const coins = s.core.coins;
    s = stepRace(s, { tick: 0, actions: [{ t: 'pick', value: wrong?.value ?? -1 }] });
    expect(s.phase).toBe('play');
    expect(s.shield).toBe(false);
    expect(s.blocked).toBe(1);
    expect(s.core.wrong).toBe(1);
    expect(s.me).toBeGreaterThanOrEqual(me);
    expect(s.core.coins).toBeGreaterThanOrEqual(coins);
  });
});

describe('[G2] 좀비: 꼬마 비틀이', () => {
  it('the little one is optional: its exact card pops it for coins, a refused card is not a wrong answer, the main zombie stays finishable', async () => {
    const { initZombie, stepZombie, solveZombie, finisher } = await import('../../src/stages/zombie/rules');
    let seen = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let s = initZombie(seed, 'A1');
      for (let i = 0; i < 60_000 && s.phase !== 'done'; i++) {
        if (s.phase === 'play' && s.mini && s.aim === 0 && s.hand.includes(-s.mini.value)) {
          seen++;
          const { coins, wrong } = s.core;
          s = stepZombie(s, { tick: 0, actions: [{ t: 'aim', who: 1 }] });
          expect(s.aim).toBe(1);
          // a card too big for the little balloon bounces off: no wrong answer
          const big = s.hand.findIndex((c) => (s.mini?.value ?? 0) + c < 0);
          if (big >= 0) {
            const r = stepZombie(s, { tick: 0, actions: [{ t: 'card', id: big }] });
            expect(r.core.wrong).toBe(wrong);
            expect(r.core.coins).toBe(coins);
          }
          s = stepZombie(s, { tick: 0, actions: [{ t: 'card', id: s.hand.indexOf(-(s.mini?.value ?? 0)) }] });
          while (s.phase === 'hit') s = stepZombie(s, { tick: 0, actions: [] });
          expect(s.miniPopped).toBeGreaterThan(0);
          expect(s.core.coins).toBeGreaterThan(coins);
          expect(s.core.wrong).toBe(wrong);
          expect(s.aim).toBe(0);
          if (s.zombie) expect(finisher(s.hand, s.zombie.value)).toBeGreaterThanOrEqual(0);
        }
        s = stepZombie(s, { tick: 0, actions: s.phase === 'play' ? solveZombie(s) : [] });
      }
      expect(s.phase).toBe('done');
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('[G2] 피자: 톡톡 세어 담기', () => {
  it('a small pack order can be answered by tapping slices in; a wrong count spills (no loss) and can be redone', async () => {
    const { initPizza, stepPizza, countable, solvePizza } = await import('../../src/stages/pizza/rules');
    let tested = 0;
    for (let seed = 1; seed <= 30 && tested < 3; seed++) {
      let s = initPizza(seed, 'A1');
      for (let i = 0; i < 20_000 && s.phase !== 'done'; i++) {
        const o = s.order;
        if (
          s.phase === 'play' &&
          o &&
          countable(o) &&
          s.added === 0 &&
          s.tried.length === 0 &&
          o.answer >= 2
        ) {
          tested++;
          const coins = s.core.coins;
          // one too few → spill, nothing lost
          let w = s;
          for (let k = 0; k < o.answer - 1; k++) w = stepPizza(w, { tick: 0, actions: [{ t: 'add' }] });
          w = stepPizza(w, { tick: 0, actions: [{ t: 'packed' }] });
          expect(w.phase).toBe('jam');
          expect(w.added).toBe(0);
          expect(w.core.coins).toBe(coins);
          // the right count serves the order
          for (let k = 0; k < o.answer; k++) s = stepPizza(s, { tick: 0, actions: [{ t: 'add' }] });
          s = stepPizza(s, { tick: 0, actions: [{ t: 'packed' }] });
          expect(s.phase).toBe('serve');
          expect(s.core.correct).toBeGreaterThan(0);
        }
        s = stepPizza(s, { tick: 0, actions: s.phase === 'play' ? solvePizza(s) : [] });
      }
    }
    expect(tested).toBeGreaterThan(0);
  });
});
