import { describe, expect, it } from 'vitest';
import { FlashGuard, HitStop, Spring, squashScale } from '../../src/engine/fx/juice';
import { createFixedLoop, STEP } from '../../src/engine/loop/fixed-loop';
import { createGovernor, TIER_CONFIG } from '../../src/engine/quality/quality';

describe('fixed loop (P6)', () => {
  it('advances in exact 60 Hz steps and caps big frames', () => {
    let ticks = 0;
    const loop = createFixedLoop({ update: () => ticks++, render: () => {} }, undefined);
    loop.advance(0.5); // capped at 0.25 s
    expect(ticks).toBe(Math.floor(0.25 / STEP));
    loop.advance(STEP * 3 + 1e-9);
    expect(ticks).toBe(Math.floor(0.25 / STEP) + 3);
    loop.dispose();
  });
});

describe('quality governor', () => {
  it('drops a tier after sustained slow frames and never above the backend max', () => {
    const g = createGovernor('webgl2');
    expect(g.tier).toBe('balanced');
    let changed: string | null = null;
    for (let i = 0; i < 400 && !changed; i++) changed = g.sample(40);
    expect(changed).toBe('low');
    for (let i = 0; i < 4000; i++) g.sample(5);
    expect(g.tier).toBe('low'); // never upgrades back into a tier that was too slow
    const w = createGovernor('webgl2', 'low');
    for (let i = 0; i < 12000; i++) w.sample(5);
    expect(w.tier).toBe('high'); // WebGL2 may earn contact shadows, never the WebGPU-only ultra tier
    expect(TIER_CONFIG.high.post).toBe('partial');
    expect(TIER_CONFIG.balanced.gpuParticles).toBe(false);
  });
  it('cooldown: no change within 10 s of the previous change', () => {
    const g = createGovernor('webgpu', 'high');
    let changes = 0;
    let t = 0;
    for (let i = 0; i < 2000; i++) {
      if (g.sample(i % 2 ? 60 : 5)) changes++;
      t += i % 2 ? 60 : 5;
    }
    expect(changes).toBeLessThanOrEqual(Math.ceil(t / 10_000));
  });

  it('locked governor never changes', () => {
    const g = createGovernor('webgpu', 'ultra', true);
    for (let i = 0; i < 1000; i++) g.sample(60);
    expect(g.tier).toBe('ultra');
  });
});

describe('[F3] juice primitives', () => {
  it('spring overshoots then settles; squash preserves volume', () => {
    const s = new Spring(0, 200, 12);
    s.target = 1;
    let max = 0;
    for (let i = 0; i < 240; i++) max = Math.max(max, s.update(1 / 60));
    expect(max).toBeGreaterThan(1);
    expect(s.settled).toBe(true);
    const q = squashScale(0.3);
    expect(q.x * q.y * q.z).toBeCloseTo(1, 5);
  });
  it('hit-stop freezes visual time briefly', () => {
    const h = new HitStop();
    h.trigger(45);
    expect(h.filter(1 / 60)).toBe(0);
    expect(h.filter(1 / 60)).toBe(0);
    expect(h.filter(1 / 60)).toBe(0);
    expect(h.filter(1 / 60)).toBeGreaterThan(0);
  });
  it('photosensitivity: at most 3 flashes per second', () => {
    const f = new FlashGuard();
    const allowed = [0, 100, 200, 300, 400, 900, 1150].map((t) => f.allow(t));
    expect(allowed).toEqual([true, true, true, false, false, false, true]);
  });
});
