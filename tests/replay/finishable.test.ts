import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../src/domain/curriculum/curriculum';
import { bombModule } from '../../src/stages/bomb/index';
import { fishingModule } from '../../src/stages/fishing/index';
import { slimeModule } from '../../src/stages/slime/index';

/** Every round, started at every curriculum level, can be finished by following the solution (no dead puzzles). */
const MODULES = [
  ['fishing', fishingModule],
  ['bomb', bombModule],
  ['slime', slimeModule],
] as const;

for (const [name, mod] of MODULES) {
  describe(`[G1:${name}] 모든 레벨에서 끝까지 풀 수 있음`, () => {
    it('solution play finishes every round (17 levels × 12 seeds × 3 difficulty shifts)', () => {
      for (const level of CURRICULUM) {
        for (let seed = 0; seed < 12; seed++) {
          for (const shift of [-1, 0, 1] as const) {
            // biome-ignore lint/suspicious/noExplicitAny: heterogenous module list
            const m = mod as any;
            let s = m.rules.init(`fin-${level.id}-${seed}-${shift}`, level.id, { shift });
            let tick = 0;
            while (s.phase !== 'done' && tick < 30_000) {
              const acts = s.phase === 'play' ? m.solution(s) : [];
              if (s.phase === 'play')
                expect(acts.length, `${level.id}/${seed}/${shift} puzzle ${s.core.index}`).toBeGreaterThan(0);
              s = m.rules.step(s, { tick: ++tick, actions: acts });
            }
            expect(s.phase).toBe('done');
            expect(s.core.wrong).toBe(0);
          }
        }
      }
    });
  });
}

describe('[E4] 힌트 4단계 후 다른 숫자로 재도전 (스테이지)', () => {
  for (const [name, mod] of MODULES) {
    it(`${name}: after 4 hints, retry swaps in a same-kind puzzle with new numbers and nothing is auto-solved`, () => {
      // biome-ignore lint/suspicious/noExplicitAny: heterogenous module list
      const m = mod as any;
      for (let seed = 0; seed < 20; seed++) {
        let s = m.rules.init(`retry-${seed}`, 'A3');
        const before = s.core.asked.question;
        let tick = 0;
        for (let i = 0; i < 4; i++) s = m.rules.step(s, { tick: ++tick, actions: [m.hintAction] });
        s = m.rules.step(s, { tick: ++tick, actions: [m.retryAction] });
        const after = s.core.asked.question;
        expect(after.key).not.toBe(before.key);
        expect(after.form).toBe(before.form);
        expect(after.skill).toBe(before.skill);
        expect(s.phase).toBe('play');
        expect(s.core.correct).toBe(0);
        expect(s.core.hintsUsed).toBe(4);
      }
    });
  }
});
