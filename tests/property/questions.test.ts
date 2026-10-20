import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../src/domain/curriculum/curriculum';
import { evaluate, hasBorrow, hasCarry, partials } from '../../src/domain/edu/arith';
import { generateQuestion } from '../../src/domain/edu/generate';
import { MISCONCEPTIONS, type Question } from '../../src/domain/edu/types';
import { createRng } from '../../src/domain/rng/rng';

const RUNS = 10_000;

/** Independent oracle: recompute the expected answer from what the child sees. */
function oracle(q: Question): number {
  switch (q.form) {
    case 'EXPR':
    case 'WORD':
      return evaluate(q.operands, q.ops);
    case 'MISSING':
    case 'SPLIT': {
      const mi = q.missingIndex as number;
      if (mi === -1) return evaluate(q.operands, q.ops);
      // solve the hidden slot by brute force over [0, max] — no shared code with the generator
      const max = Math.max(q.result, ...q.operands) * 2 + 10;
      const sols: number[] = [];
      for (let x = 0; x <= max; x++) {
        const ops = q.operands.slice();
        ops[mi] = x;
        if (evaluate(ops, q.ops) === q.result) sols.push(x);
      }
      expect(sols.length).toBe(1);
      return sols[0] as number;
    }
    case 'COMPARE':
      return Math.max(...(q.items ?? []).map((i) => evaluate(i.operands, i.ops)));
    case 'CLOSEST': {
      const t = q.target as number;
      const vals = (q.items ?? []).map((i) => evaluate(i.operands, i.ops));
      return vals.reduce((best, v) => (Math.abs(v - t) < Math.abs(best - t) ? v : best));
    }
    case 'SEQUENCE': {
      const i = q.missingIndex as number;
      const step = (q.operands[1] as number) - (q.operands[0] as number);
      return (q.operands[0] as number) + step * i;
    }
    case 'PLACE':
      if (q.target === undefined) return q.operands.reduce((a, b) => a + b, 0);
      return Math.floor((q.operands[0] as number) / 10 ** q.target) % 10;
  }
}

describe('[E1] 정답·범위 무결성 — 전 레벨 × 1만 문항', () => {
  for (const level of CURRICULUM) {
    it(`${level.id}: answer correct, in range, non-negative, unique choices`, () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
          const q = generateQuestion({ level: level.id, rng: createRng(seed) });
          expect(q.answer).toBe(oracle(q));
          const shown = [...q.operands, q.result, q.answer];
          for (const v of shown) {
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(level.max);
          }
          for (const p of partials(q.operands, q.ops)) expect(p).toBeGreaterThanOrEqual(0);
          // choices: contain the answer exactly once, all distinct, all non-negative
          const values = q.choices.map((c) => c.value);
          expect(new Set(values).size).toBe(values.length);
          expect(values.filter((v) => v === q.answer)).toHaveLength(1);
          for (const v of values) expect(v).toBeGreaterThanOrEqual(0);
          expect(values.length).toBe(q.form === 'COMPARE' || q.form === 'CLOSEST' ? 2 : 4);
          // misconception map only references wrong choices and valid tags
          for (const [val, tag] of Object.entries(q.misconceptionMap)) {
            expect(Number(val)).not.toBe(q.answer);
            expect(values).toContain(Number(val));
            expect(MISCONCEPTIONS).toContain(tag);
          }
          // carry rules per skill
          const [a = 0, b = 0] = q.operands;
          if (q.skill === 'ADD_CARRY') expect(hasCarry(a, b)).toBe(true);
          if (q.skill === 'ADD_NOCARRY') expect(hasCarry(a, b)).toBe(false);
          if (q.skill === 'SUB_BORROW') expect(hasBorrow(a, b)).toBe(true);
          if (q.skill === 'SUB_NOBORROW') expect(hasBorrow(a, b)).toBe(false);
          expect(level.skills).toContain(q.skill);
        }),
        { seed: 20261020, numRuns: RUNS },
      );
    });
  }

  it('same seed → identical question (reproducible)', () => {
    for (const level of CURRICULUM) {
      for (let s = 0; s < 50; s++) {
        expect(generateQuestion({ level: level.id, rng: createRng(s) })).toEqual(
          generateQuestion({ level: level.id, rng: createRng(s) }),
        );
      }
    }
  });
});
