import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { celebrationSize } from '../../src/stages/_shared/fx';

/**
 * F3 checklist per stage (static evidence: each scene wires the juice primitives; behaviour of the
 * primitives themselves is unit-tested in engine.test.ts). Visual quality is judged by art review.
 */
const CHECKS: [string, RegExp][] = [
  ['squash & stretch spring', /new Spring\(/],
  ['hit-stop', /hitStop\.trigger\(/],
  ['particles', /world\.particles\.emit\(/],
  ['streak-escalating celebration', /celebrate\(/],
  ['camera shake gated by reduced motion', /new Shake\(!ctx\.reducedMotion/],
  ['signature sound', /audio\.play\('(reel|gift|merge)'/],
  ['funny failure sound', /audio\.play\('wrong\.(boing|duck|pfft)'/],
];

for (const stage of ['fishing', 'bomb', 'slime']) {
  describe(`[F3:${stage}] 모션·주스 체크리스트`, () => {
    const src = readFileSync(`src/stages/${stage}/scene.ts`, 'utf8');
    for (const [name, re] of CHECKS) it(name, () => expect(re.test(src)).toBe(true));
  });
}

describe('celebration escalates with the streak', () => {
  it('more particles for longer streaks, capped', () => {
    const sizes = [1, 2, 3, 4, 9].map((s) => celebrationSize(s).confetti);
    expect(sizes[1]).toBeGreaterThan(sizes[0] as number);
    expect(sizes[2]).toBeGreaterThan(sizes[1] as number);
    expect(sizes[4]).toBe(sizes[3]);
    expect(celebrationSize(3).big).toBe(true);
  });
});
