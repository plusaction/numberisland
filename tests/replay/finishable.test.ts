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
