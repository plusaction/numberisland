import { Matrix4, Vector3 } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createPhysicsFx } from '../../src/engine/physics/physics';
import { WAVES_POND, WAVES_SEA, waveHeight } from '../../src/engine/water/waves';

describe('[F3] 장식 물리 (동전·사탕·조약돌·물방울)', () => {
  it('bodies fall, bounce, come to rest on the ground and despawn after their lifetime', () => {
    const fx = createPhysicsFx();
    fx.setGround(0, 7);
    fx.burst('coin', { x: 0, y: 2, z: 0 }, 12);
    expect(fx.live).toBe(12);
    let minY = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 60 * 3; i++) fx.step(1 / 60);
    // all coins are on the slab or the table, none fell through
    const coins = fx.object.children[0] as unknown as {
      count: number;
      getMatrixAt(i: number, m: unknown): void;
    };
    expect(coins.count).toBe(12);
    const m = new Matrix4();
    const p = new Vector3();
    for (let i = 0; i < coins.count; i++) {
      coins.getMatrixAt(i, m);
      p.setFromMatrixPosition(m);
      minY = Math.min(minY, p.y);
    }
    expect(minY).toBeGreaterThan(-1.3); // table top is 1.2 below the slab
    for (let i = 0; i < 60 * 3; i++) fx.step(1 / 60);
    expect(fx.live).toBe(0);
    fx.dispose();
  });

  it('per-kind pools are capped (oldest bodies are recycled, no unbounded growth)', () => {
    const fx = createPhysicsFx();
    for (let i = 0; i < 10; i++) fx.burst('candy', { x: 0, y: 2, z: 0 }, 20);
    expect(fx.live).toBeLessThanOrEqual(50);
    fx.clear();
    expect(fx.live).toBe(0);
    fx.dispose();
  });
});

describe('[F3] 물결 (Gerstner) — CPU와 셰이더가 같은 파도', () => {
  it('surface height stays within the summed amplitudes and actually moves over time', () => {
    for (const w of [WAVES_POND, WAVES_SEA]) {
      const amp = w.list.reduce((a, x) => a + x.amp, 0);
      let lo = 0;
      let hi = 0;
      for (let t = 0; t < 10; t += 0.37) {
        const h = waveHeight(w, 1.3, -0.7, t);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
        expect(Math.abs(h)).toBeLessThanOrEqual(amp + 1e-9);
      }
      expect(hi - lo).toBeGreaterThan(amp * 0.5);
    }
  });
});
