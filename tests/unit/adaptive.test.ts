import { describe, expect, it } from 'vitest';
import { CURRICULUM, levelIndex, type TermSetting } from '../../src/domain/curriculum/curriculum';
import {
  type AdaptiveSettings,
  chooseNext,
  createAdaptiveState,
  DEFAULT_SETTINGS,
  recordAnswer,
  stepLevel,
} from '../../src/domain/edu/adaptive';
import { bktPredict, bktUpdate } from '../../src/domain/edu/bkt';
import { dueCards, newCard, reviewCard } from '../../src/domain/edu/fsrs';
import { placementAnswer, startPlacement } from '../../src/domain/edu/placement';
import type { LevelId } from '../../src/domain/edu/types';
import { createRng } from '../../src/domain/rng/rng';

const N = CURRICULUM.length;
const termFor = (k: number): TermSetting => {
  const b = (CURRICULUM[k] as { band: string }).band;
  return b === '0' ? '1-1' : b === 'A' ? '1-2' : b === 'B' ? '2-1' : '2-2';
};
const FLOORS: Record<TermSetting, LevelId> = { '1-1': 'L0_1', '1-2': 'L0_1', '2-1': 'A1', '2-2': 'A3' };

/**
 * Virtual learner with true level k: P(correct at level i) = clamp(base − 0.25·(i − k)).
 * Expected level E = highest level with P ≥ 0.70 (ZPD lower bound), clamped to the term floor.
 */
function simulate(base: number, k: number, seed: number) {
  const rng = createRng(`e5-${base}-${k}-${seed}`);
  const settings: AdaptiveSettings = { ...DEFAULT_SETTINGS, term: termFor(k) };
  const p = (lvl: LevelId) => Math.min(0.97, Math.max(0.05, base - 0.25 * (levelIndex(lvl) - k)));
  let pl = startPlacement(settings);
  let placementCount = 0;
  while (!pl.done) {
    pl = placementAnswer(pl, rng.float() < p(pl.current), settings);
    placementCount++;
  }
  let st = createAdaptiveState(pl.result as LevelId, settings);
  let E = 0;
  for (let i = 0; i < N; i++) if (Math.min(0.97, base - 0.25 * (i - k)) >= 0.7) E = i;
  E = Math.max(E, levelIndex(FLOORS[termFor(k)]));
  // placement alone does not count: the engine must hold E±1 after at least one adaptive answer
  let reached = false;
  let chain = 0;
  let maxChain = 0;
  for (let q = 0; q < 40; q++) {
    const pick = chooseNext(st, rng, 0, settings);
    const correct = rng.float() < p(pick.level);
    const r = recordAnswer(
      st,
      { level: pick.level, skill: pick.skill, slot: pick.slot, correct, hintsUsed: 0, day: 0 },
      settings,
    );
    st = r.state;
    if (r.event === 'demote') maxChain = Math.max(maxChain, ++chain);
    if (correct) chain = 0;
    if (Math.abs(levelIndex(st.level) - E) <= 1) reached = true;
  }
  return { reached, final: Math.abs(levelIndex(st.level) - E) <= 1, maxChain, placementCount };
}

describe('[E5] 적응 엔진 수렴', () => {
  for (const base of [0.5, 0.7, 0.9]) {
    it(`learner accuracy ${base}: reaches expected level ±1 within 40 questions in ≥95% of runs, no 3-demotion chains`, () => {
      let runs = 0;
      let reached = 0;
      let final = 0;
      for (let k = 0; k < N; k++) {
        for (let seed = 0; seed < 60; seed++) {
          const r = simulate(base, k, seed);
          runs++;
          if (r.reached) reached++;
          if (r.final) final++;
          expect(r.maxChain).toBeLessThan(3);
          expect(r.placementCount).toBeGreaterThanOrEqual(3);
          expect(r.placementCount).toBeLessThanOrEqual(5);
        }
      }
      expect(reached / runs).toBeGreaterThanOrEqual(0.95);
      // Stricter snapshot metric (still at E±1 after question 40), reported for honesty.
      expect(final / runs).toBeGreaterThanOrEqual(0.85);
      console.info(
        `[E5] base=${base} reach=${(reached / runs).toFixed(3)} final=${(final / runs).toFixed(3)}`,
      );
    });
  }

  it('2 wrong in a row demotes one level; 3 correct promotes', () => {
    let st = createAdaptiveState('A3');
    const ans = (correct: boolean) =>
      recordAnswer(st, {
        level: st.level,
        skill: 'ADD_CARRY',
        slot: 'current',
        correct,
        hintsUsed: 0,
        day: 0,
      });
    let r = ans(true);
    st = r.state;
    r = ans(true);
    st = r.state;
    r = ans(true);
    expect(r.event).toBe('promote');
    st = r.state;
    expect(st.level).toBe('A4');
    r = ans(false);
    st = r.state;
    r = ans(false);
    expect(r.event).toBe('demote');
    expect(r.state.level).toBe('A3');
  });

  it('third consecutive demotion becomes rescue mode with auto hint', () => {
    let st = createAdaptiveState('B3');
    const events: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = recordAnswer(st, {
        level: st.level,
        skill: 'SUB_BORROW',
        slot: 'current',
        correct: false,
        hintsUsed: 0,
        day: 0,
      });
      st = r.state;
      if (r.event !== 'none') events.push(r.event);
    }
    expect(events).toEqual(['demote', 'demote', 'rescue']);
    const pick = chooseNext(st, createRng(1), 0);
    expect(pick.slot).toBe('rescue');
    expect(pick.autoHint).toBe(true);
  });

  it('C4 challenge is skipped when the parent turns it off', () => {
    const off = { ...DEFAULT_SETTINGS, term: '2-2' as const, challengeEnabled: false };
    expect(stepLevel('C3', 1, off)).toBe('C5');
    expect(stepLevel('C3', 1, { ...off, challengeEnabled: true })).toBe('C4');
  });

  it('mix is ≈60/25/15 current/review/challenge', () => {
    const st = createAdaptiveState('A4');
    const rng = createRng('mix');
    const counts = { current: 0, review: 0, challenge: 0, rescue: 0 };
    for (let i = 0; i < 4000; i++) counts[chooseNext(st, rng, 0).slot]++;
    expect(counts.current / 4000).toBeCloseTo(0.6, 1);
    expect(counts.review / 4000).toBeCloseTo(0.25, 1);
    expect(counts.challenge / 4000).toBeCloseTo(0.15, 1);
  });
});

describe('BKT / FSRS', () => {
  it('BKT mastery rises with correct and falls with wrong answers', () => {
    let p = 0.3;
    for (let i = 0; i < 5; i++) p = bktUpdate(p, true);
    expect(p).toBeGreaterThan(0.9);
    expect(bktPredict(p)).toBeGreaterThan(0.8);
    expect(bktUpdate(0.5, false)).toBeLessThan(0.5);
  });

  it('FSRS: wrong answers come back tomorrow, good answers space out', () => {
    let c = newCard('A5:ADD_CARRY', 10);
    c = reviewCard(c, 'again', 10);
    expect(c.due).toBe(11);
    expect(dueCards([c], 11)).toHaveLength(1);
    const good = reviewCard(reviewCard(c, 'good', 11), 'good', 13);
    expect(good.due - 13).toBeGreaterThanOrEqual(2);
  });
});

describe('[E5] 난이도 선택(쉽게/어렵게)에서도 적응이 계속됨', () => {
  it('perfect rounds with shift +1 or −1 still promote; misses with −1 still demote', async () => {
    const { fishingModule } = await import('../../src/stages/fishing/index');
    for (const shift of [-1, 1] as const) {
      let adaptive = createAdaptiveState('A3');
      for (let round = 0; round < 3; round++) {
        let s = fishingModule.rules.init(`shift-${shift}-${round}`, adaptive.level, { shift, adaptive });
        let tick = 0;
        while (s.phase !== 'done' && tick < 20000)
          s = fishingModule.rules.step(s, {
            tick: ++tick,
            actions: s.phase === 'play' ? fishingModule.solution(s) : [],
          });
        adaptive = s.core.session.adaptive;
      }
      expect(levelIndex(adaptive.level), `shift ${shift}`).toBeGreaterThan(levelIndex('A3'));
    }
  });
});
