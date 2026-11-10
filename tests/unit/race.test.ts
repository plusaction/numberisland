import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import {
  crossChoices,
  initRace,
  MAX_LEAD,
  type RaceAction,
  type RaceState,
  raceRules,
  SLIP_TICKS,
  STAR_SQUARES,
  solveRace,
} from '../../src/stages/race/rules';

const step = (s: RaceState, tick: number, actions: RaceAction[] = []) => raceRules.step(s, { tick, actions });
const LENGTH = BALANCE.race.length;

/**
 * Drives a race in real time. `think` = ticks the driver waits on each question before answering;
 * `wrongEvery` > 0 presses one wrong answer first on every n-th question.
 */
function drive(seed: string, level: string, shift: -1 | 0 | 1 = 0, think = 0, wrongEvery = 0) {
  let s = initRace(seed, level as never, { shift });
  let tick = 0;
  let asked = 0;
  let lastKey = '';
  let waited = 0;
  let maxLead = 0;
  while (s.phase !== 'done' && tick < 200_000) {
    let acts: RaceAction[] = [];
    const q = s.core.asked?.question;
    if (s.phase === 'play' && q) {
      if (q.key !== lastKey) {
        asked++;
        lastKey = q.key;
        waited = 0;
        const four = crossChoices(q);
        expect(four).toHaveLength(4);
        expect(new Set(four.map((c) => c.value)).size).toBe(4);
        expect(four.some((c) => c.value === q.answer)).toBe(true);
      }
      if (waited++ >= think) {
        const wrong = crossChoices(q).find((c) => c.value !== q.answer && !s.tried.includes(c.value));
        acts =
          wrongEvery > 0 && asked % wrongEvery === 0 && s.tried.length === 0 && wrong
            ? [{ t: 'pick', value: wrong.value }]
            : solveRace(s);
      }
    }
    const before = s;
    s = step(s, ++tick, acts);
    // nothing is ever lost: position, coins and stars only grow
    expect(s.me).toBeGreaterThanOrEqual(before.me);
    expect(s.core.coins).toBeGreaterThanOrEqual(before.core.coins);
    expect(s.stars.length).toBeGreaterThanOrEqual(before.stars.length);
    s.rivals.forEach((r, i) => {
      expect(r).toBeGreaterThanOrEqual(before.rivals[i] as number);
    });
    maxLead = Math.max(maxLead, Math.max(...s.rivals) - s.me);
  }
  return { s, asked, ticks: tick, maxLead };
}

describe('[G1:race] 정답 달리기 레이스 규칙 (실시간)', () => {
  it('quick right answers always win at every difficulty, with turbos and both star coins', () => {
    for (const level of ['L0_1', 'A2', 'A3', 'A4', 'A6']) {
      for (const shift of [-1, 0, 1] as const) {
        for (let seed = 0; seed < 8; seed++) {
          // answering within about a second and a half
          const { s } = drive(`r-${level}-${shift}-${seed}`, level, shift, 90);
          expect(s.phase).toBe('done');
          expect(s.me).toBe(LENGTH);
          expect(s.place).toBe(1);
          expect(s.turbos).toBeGreaterThanOrEqual(1);
          expect(s.stars.slice().sort((a, b) => a - b)).toEqual([...STAR_SQUARES]);
          const r = raceRules.summary(s);
          expect(r.cleared).toBe(true);
          expect(r.highlights).toContain('raceWin');
          expect(r.highlights).toContain('raceTurbo');
        }
      }
    }
  });

  it('everybody keeps driving: with no answers the kart still creeps and the rivals pull ahead — gently', () => {
    for (const shift of [-1, 0, 1] as const) {
      let s = initRace(`idle-${shift}`, 'A3', { shift });
      let tick = 0;
      while (s.phase !== 'play') s = step(s, ++tick);
      const at = s.me;
      for (let i = 0; i < 120; i++) s = step(s, ++tick);
      // moving within two seconds of the start, rivals too
      expect(s.me).toBeGreaterThan(at);
      expect(Math.max(...s.rivals)).toBeGreaterThan(0);
      for (let i = 0; i < 6000; i++) {
        s = step(s, ++tick);
        expect(Math.max(...s.rivals) - s.me).toBeLessThanOrEqual(MAX_LEAD + 0.05);
      }
      // waiting does not win the race: after 100 s without an answer the kart has only crawled
      expect(s.me).toBeLessThan(3);
      expect(s.phase).toBe('play');
      expect(s.core.correct).toBe(0);
    }
  });

  it('a wrong answer stops the kart for a second, keeps the question and dims that answer', () => {
    let s = initRace('slip', 'A3');
    let tick = 0;
    while (s.phase !== 'play') s = step(s, ++tick);
    const q = s.core.asked!.question;
    const wrong = crossChoices(q).find((c) => c.value !== q.answer)!;
    s = step(s, ++tick, [{ t: 'pick', value: wrong.value }]);
    expect(s.phase).toBe('slip');
    const held = s.me;
    for (let i = 0; i < SLIP_TICKS - 1; i++) {
      s = step(s, ++tick);
      expect(s.me).toBe(held);
    }
    expect(s.phase).toBe('play');
    expect(s.tried).toEqual([wrong.value]);
    expect(s.core.asked!.question.key).toBe(q.key);
    // the dimmed answer cannot be pressed again
    const again = step(s, ++tick, [{ t: 'pick', value: wrong.value }]);
    expect(again.phase).toBe('play');
    expect(again.core.wrong).toBe(s.core.wrong);
    const { s: end } = drive('slips', 'A3', 1, 120, 2);
    expect(end.phase).toBe('done');
    expect(end.place).toBeGreaterThanOrEqual(1);
    expect(end.place).toBeLessThanOrEqual(3);
  });

  it('a right answer boosts a whole square and refills the fuel; the third in a row is a turbo', () => {
    let s = initRace('boost', 'A3');
    let tick = 0;
    const gains: number[] = [];
    while (gains.length < 3 && tick < 5000) {
      const before = s;
      s = step(s, ++tick, s.phase === 'play' ? solveRace(s) : []);
      if (before.phase === 'play' && s.phase === 'boost') {
        expect(s.fuel).toBe(1);
        expect(s.boostTo - before.me).toBeCloseTo(s.gain, 5);
        gains.push(s.gain);
      }
    }
    expect(gains).toEqual([1, 1, 2]);
  });

  it('harder rivals stay further ahead; a slow thinker can lose to them — and is never punished', () => {
    // average gap (rival − me) over a whole race, 7 s of thinking per question
    const gap = (shift: -1 | 0 | 1) => {
      let sum = 0;
      for (let seed = 0; seed < 20; seed++) {
        let s = initRace(`pace-${seed}`, 'A3', { shift });
        let tick = 0;
        let waited = 0;
        let key = '';
        let acc = 0;
        while (s.phase !== 'done' && tick < 200_000) {
          const q = s.core.asked?.question;
          let acts: RaceAction[] = [];
          if (s.phase === 'play' && q) {
            if (q.key !== key) {
              key = q.key;
              waited = 0;
            }
            if (waited++ >= 420) acts = solveRace(s);
          }
          s = step(s, ++tick, acts);
          acc += (s.rivals[0] as number) - s.me;
        }
        sum += acc / tick;
      }
      return sum / 20;
    };
    const [easy, normal, hard] = [gap(-1), gap(0), gap(1)];
    expect(easy).toBeLessThan(normal);
    expect(normal).toBeLessThan(hard);
    // ten seconds a question against the hard rivals: sometimes lost, the race still finishes
    const slow = Array.from({ length: 12 }, (_, i) => drive(`slow-${i}`, 'A3', 1, 600).s);
    expect(slow.some((s) => (s.place ?? 1) > 1)).toBe(true);
    expect(slow.every((s) => s.phase === 'done' && s.me === LENGTH)).toBe(true);
  });

  it('is deterministic for a seed (replay)', () => {
    const a = drive('same', 'A4', 0, 150, 3);
    const b = drive('same', 'A4', 0, 150, 3);
    expect(a.s.rivals).toEqual(b.s.rivals);
    expect(a.s.place).toBe(b.s.place);
    expect(a.ticks).toBe(b.ticks);
    expect(a.s.core.coins).toBe(b.s.core.coins);
  });
});
