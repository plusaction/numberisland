import { describe, expect, it } from 'vitest';
import { CURRICULUM, levelIndex } from '../../src/domain/curriculum/curriculum';
import { createAdaptiveState } from '../../src/domain/edu/adaptive';
import { addForgettingCarry, columnSteps, evaluate, subBorrowReversed } from '../../src/domain/edu/arith';
import { feedbackFor, MISCONCEPTION_FEEDBACK } from '../../src/domain/edu/feedback';
import { generateQuestion } from '../../src/domain/edu/generate';
import { answerQuestion, createSession, nextQuestion } from '../../src/domain/edu/session';
import {
  MISCONCEPTIONS,
  type MisconceptionTag,
  REPRESENTATIONS,
  type Representation,
} from '../../src/domain/edu/types';
import { createRng } from '../../src/domain/rng/rng';

describe('[E3] 오개념 기반 오답·피드백', () => {
  it('textbook examples: 47+38→75, 52−27→35', () => {
    expect(addForgettingCarry(47, 38)).toBe(75);
    expect(subBorrowReversed(52, 27)).toBe(35);
  });

  it('every misconception tag is generated somewhere and has a visual feedback', () => {
    const seen = new Set<MisconceptionTag>();
    for (const level of CURRICULUM) {
      const rng = createRng(`e3-${level.id}`);
      for (let i = 0; i < 500; i++) {
        const q = generateQuestion({ level: level.id, rng });
        for (const tag of Object.values(q.misconceptionMap)) seen.add(tag);
      }
    }
    for (const tag of MISCONCEPTIONS) {
      expect(seen.has(tag), tag).toBe(true);
      expect(MISCONCEPTION_FEEDBACK[tag].animation).toBeTruthy();
      expect(feedbackFor(tag).durationMs).toBeLessThanOrEqual(2000);
    }
  });

  it('carry/borrow questions offer the matching misconception distractor', () => {
    let carry = 0;
    let carryTagged = 0;
    let borrow = 0;
    let borrowTagged = 0;
    for (const level of CURRICULUM) {
      const rng = createRng(`e3b-${level.id}`);
      for (let i = 0; i < 300; i++) {
        const q = generateQuestion({ level: level.id, rng });
        if (q.form !== 'EXPR' || q.operands.length !== 2) continue;
        const tags = Object.values(q.misconceptionMap);
        if (q.skill === 'ADD_CARRY') {
          carry++;
          if (tags.includes('CARRY_FORGOTTEN')) carryTagged++;
        }
        if (q.skill === 'SUB_BORROW') {
          borrow++;
          if (tags.includes('BORROW_REVERSED')) borrowTagged++;
        }
      }
    }
    expect(carryTagged / carry).toBeGreaterThan(0.8);
    expect(borrowTagged / borrow).toBeGreaterThan(0.8);
  });
});

describe('[E4] 힌트 4단계', () => {
  it('every question has visual → strategy → steps → demo, demo/retry use different numbers', () => {
    for (const level of CURRICULUM) {
      const rng = createRng(`e4-${level.id}`);
      for (let i = 0; i < 400; i++) {
        const q = generateQuestion({ level: level.id, rng });
        expect(q.hintPlan.map((h) => h.kind)).toEqual(['visual', 'strategy', 'steps', 'demo']);
        const demo = q.hintPlan[3];
        if (demo?.kind !== 'demo') throw new Error('no demo');
        const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, k) => v === b[k]);
        const sameProblem = (x: { operands: number[]; ops: string[]; missingIndex?: number }) =>
          same(x.operands, q.operands) &&
          x.ops.join('') === q.ops.join('') &&
          x.missingIndex === q.missingIndex;
        expect(sameProblem(demo.example)).toBe(false);
        expect(sameProblem(demo.retry)).toBe(false);
        // retry is a new problem for the child — its answer is computed, never pre-filled into the original
        expect(demo.retry.answer).toBeGreaterThanOrEqual(0);
        const steps = q.hintPlan[2];
        if (steps?.kind !== 'steps') throw new Error('no steps');
        expect(steps.columns.length).toBeGreaterThan(0);
      }
    }
  });

  it('column steps reproduce the written method', () => {
    const add = columnSteps(47, 38, '+');
    expect(add.map((c) => c.digit)).toEqual([5, 8]);
    expect(add[0]?.carryOut).toBe(1);
    const sub = columnSteps(52, 27, '-');
    expect(sub.map((c) => c.digit)).toEqual([5, 2]);
    expect(sub[0]?.carryOut).toBe(-1);
    const s3 = columnSteps(1200, 300, '-');
    expect(
      s3
        .map((c) => c.digit)
        .reverse()
        .join(''),
    ).toBe('0900');
    expect(evaluate([1200, 300], ['-'])).toBe(900);
  });
});

describe('[E6] 표현 다양성', () => {
  it('all 5 representations exist; every band uses ≥2', () => {
    const used = new Map<string, Set<Representation>>();
    for (const level of CURRICULUM) {
      const rng = createRng(`e6-${level.id}`);
      for (let i = 0; i < 400; i++) {
        const q = generateQuestion({ level: level.id, rng });
        const set = used.get(level.band) ?? new Set<Representation>();
        set.add(q.visual.representation);
        for (const h of q.hintPlan) if (h.kind === 'visual') set.add(h.visual.representation);
        used.set(level.band, set);
      }
    }
    const all = new Set([...used.values()].flatMap((s) => [...s]));
    for (const r of REPRESENTATIONS) expect(all.has(r), r).toBe(true);
    for (const [band, set] of used) expect(set.size, `band ${band}`).toBeGreaterThanOrEqual(2);
  });
});

/** Levels whose whole math space is smaller than 500 (documented in docs/GAPS.md). */
const SMALL_SPACE: Record<string, number> = { L0_1: 400, A2: 420 };

describe('[E7] 문제 다양성', () => {
  it('unique problem space per level ≥ 500 (except documented small-space levels)', () => {
    for (const level of CURRICULUM) {
      const rng = createRng(`e7-${level.id}`);
      const keys = new Set<string>();
      for (let i = 0; i < 20_000; i++) keys.add(generateQuestion({ level: level.id, rng }).key);
      expect(keys.size, level.id).toBeGreaterThanOrEqual(SMALL_SPACE[level.id] ?? 500);
    }
  });

  it('a 30-question session at one level never repeats a question', () => {
    for (const level of CURRICULUM) {
      for (let seed = 0; seed < 20; seed++) {
        let s = createSession(createAdaptiveState(level.id));
        const rng = createRng(`e7s-${level.id}-${seed}`);
        const keys = new Set<string>();
        for (let i = 0; i < 30; i++) {
          const r = nextQuestion(s, rng, 0, undefined, level.id);
          s = r.session;
          expect(keys.has(r.asked.question.id), `${level.id} #${i}`).toBe(false);
          keys.add(r.asked.question.id);
          s = answerQuestion(s, r.asked, { correct: true, hintsUsed: 0 }, 0).session;
        }
      }
    }
  });

  it('6+7 carries the hidden firework tag', () => {
    const rng = createRng('six-seven');
    let found = false;
    for (let i = 0; i < 4000 && !found; i++) {
      const q = generateQuestion({ level: 'A2', skill: 'ADD_CARRY', rng });
      if (q.operands.includes(6) && q.operands.includes(7)) {
        expect(q.tags).toContain('SIX_SEVEN');
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('levels are ordered from 1-1 to 2-2 with C4 marked as challenge', () => {
    expect(levelIndex('L0_1')).toBe(0);
    expect(CURRICULUM.find((l) => l.id === 'C4')?.challenge).toBe(true);
    expect(CURRICULUM.filter((l) => l.challenge)).toHaveLength(1);
  });
});
