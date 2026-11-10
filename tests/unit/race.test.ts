import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import {
  crossChoices,
  initRace,
  type RaceAction,
  type RaceState,
  raceRules,
  STAR_SQUARES,
  solveRace,
} from '../../src/stages/race/rules';

const step = (s: RaceState, tick: number, actions: RaceAction[] = []) => raceRules.step(s, { tick, actions });

/** Drives a race; `wrongEvery` > 0 presses one wrong answer first on every n-th question. */
function drive(seed: string, level: string, shift: -1 | 0 | 1 = 0, wrongEvery = 0) {
  let s = initRace(seed, level as never, { shift });
  let tick = 0;
  let asked = 0;
  let lastKey = '';
  let rivalSteps = 0;
  let turns = 0;
  while (s.phase !== 'done' && tick < 60_000) {
    let acts: RaceAction[] = [];
    const q = s.core.asked?.question;
    if (s.phase === 'play' && q) {
      const fresh = q.key !== lastKey;
      if (fresh) {
        asked++;
        lastKey = q.key;
        const four = crossChoices(q);
        expect(four).toHaveLength(4);
        expect(new Set(four.map((c) => c.value)).size).toBe(4);
        expect(four.some((c) => c.value === q.answer)).toBe(true);
      }
      const wrong = crossChoices(q).find((c) => c.value !== q.answer && !s.tried.includes(c.value));
      acts =
        fresh && wrongEvery > 0 && asked % wrongEvery === 0 && wrong
          ? [{ t: 'pick', value: wrong.value }]
          : solveRace(s);
    }
    const before = s;
    s = step(s, ++tick, acts);
    // nothing is ever lost: position, coins and stars only grow
    expect(s.me).toBeGreaterThanOrEqual(before.me);
    expect(s.core.coins).toBeGreaterThanOrEqual(before.core.coins);
    expect(s.stars.length).toBeGreaterThanOrEqual(before.stars.length);
    if (acts.length && before.phase === 'play' && s.phase !== 'play') {
      turns++;
      rivalSteps += s.rivals[0]! - before.rivals[0]!;
    }
  }
  return { s, asked, turns, rivalSteps };
}

describe('[G1:race] 정답 달리기 레이스 규칙', () => {
  it('all right answers always win, in 9 turns, with 3 turbos and both star coins', () => {
    for (const level of ['L0_1', 'A2', 'A3', 'A4', 'A6']) {
      for (const shift of [-1, 0, 1] as const) {
        for (let seed = 0; seed < 8; seed++) {
          const { s, turns } = drive(`r-${level}-${shift}-${seed}`, level, shift);
          expect(s.phase).toBe('done');
          expect(s.me).toBe(BALANCE.race.length);
          expect(s.place).toBe(1);
          expect(turns).toBe(9);
          expect(s.turbos).toBe(3);
          expect(s.stars.slice().sort((a, b) => a - b)).toEqual([...STAR_SQUARES]);
          const r = raceRules.summary(s);
          expect(r.cleared).toBe(true);
          expect(r.highlights).toContain('raceWin');
          expect(r.highlights).toContain('raceTurbo');
        }
      }
    }
  });

  it('a wrong answer keeps the square and the question, dims that answer, and the race still finishes', () => {
    let s = initRace('slip', 'A3');
    let tick = 0;
    while (s.phase !== 'play') s = step(s, ++tick);
    const q = s.core.asked!.question;
    const wrong = crossChoices(q).find((c) => c.value !== q.answer)!;
    s = step(s, ++tick, [{ t: 'pick', value: wrong.value }]);
    expect(s.phase).toBe('slip');
    expect(s.me).toBe(0);
    expect(s.tried).toEqual([wrong.value]);
    while (s.phase !== 'play') s = step(s, ++tick);
    expect(s.core.asked!.question.key).toBe(q.key);
    // the dimmed answer cannot be pressed again
    const again = step(s, ++tick, [{ t: 'pick', value: wrong.value }]);
    expect(again.phase).toBe('play');
    expect(again.core.wrong).toBe(s.core.wrong);
    const { s: end } = drive('slips', 'A3', 1, 2);
    expect(end.phase).toBe('done');
    expect(end.me).toBe(BALANCE.race.length);
    expect(end.place).toBeGreaterThanOrEqual(1);
    expect(end.place).toBeLessThanOrEqual(3);
  });

  it('input waits for the start lights; nothing moves without an answer (no time pressure)', () => {
    let s = initRace('wait', 'A3');
    expect(s.phase).toBe('start');
    const early = step(s, 1, solveRace(s));
    expect(early.me).toBe(0);
    let tick = 0;
    while (s.phase !== 'play') s = step(s, ++tick);
    for (let i = 0; i < 2000; i++) s = step(s, ++tick);
    expect(s.me).toBe(0);
    expect(s.rivals).toEqual([0, 0]);
  });

  it('harder rivals move more often per turn (easy < normal < hard)', () => {
    const pace = (shift: -1 | 0 | 1) => {
      let steps = 0;
      let turns = 0;
      for (let seed = 0; seed < 60; seed++) {
        const r = drive(`pace-${seed}`, 'A3', shift);
        steps += r.rivalSteps;
        turns += r.turns;
      }
      return steps / turns;
    };
    const [easy, normal, hard] = [pace(-1), pace(0), pace(1)];
    expect(easy).toBeLessThan(normal);
    expect(normal).toBeLessThan(hard);
  });

  it('is deterministic for a seed (replay)', () => {
    const a = drive('same', 'A4', 0, 3);
    const b = drive('same', 'A4', 0, 3);
    expect(a.s.rivals).toEqual(b.s.rivals);
    expect(a.s.place).toBe(b.s.place);
    expect(a.s.core.coins).toBe(b.s.core.coins);
  });
});
