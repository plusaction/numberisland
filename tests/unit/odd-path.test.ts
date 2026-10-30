import { describe, expect, it } from 'vitest';
import { oddPath } from '../../src/stages/fishing/odd-items';

describe('[F3] 낚시 보너스 물건 — 다양한 방향, 언제나 연못 안', () => {
  it('every path stays on the pond and entry directions spread all around', () => {
    const sectors = new Set<number>();
    for (let id = 0; id < 400; id += 7) {
      for (let lane = 0; lane < 6; lane++) {
        for (let k = 0; k <= 1; k += 0.05) {
          const p = oddPath(id * 60, lane, k);
          expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(4.6); // pond radius
        }
        const start = oddPath(id * 60, lane, 0);
        sectors.add(Math.floor(((Math.atan2(start.z, start.x) + Math.PI) / (2 * Math.PI)) * 8));
      }
    }
    expect(sectors.size).toBeGreaterThanOrEqual(7); // comes in from (almost) every side
  });
});
