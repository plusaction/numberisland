import { Vector3 } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { createSoftBody, FRONT, NODE_DIRS, NODES } from '../../src/engine/physics/softbody';

const ZERO = new Vector3();
const settle = (b: ReturnType<typeof createSoftBody>, secs: number, accel = ZERO) => {
  for (let i = 0; i < secs * 60; i++) b.step(1 / 60, accel, 0);
};

describe('[slime] soft-body jelly shell', () => {
  it('rests stably: sags onto the tray (bottom flat, never below it), stays bounded', () => {
    const b = createSoftBody();
    settle(b, 4);
    for (let i = 0; i < NODES; i++) {
      const d = b.disp[i] as Vector3;
      expect(Number.isFinite(d.x + d.y + d.z)).toBe(true);
      expect(d.length()).toBeLessThanOrEqual(0.38 + 1e-9);
      expect((NODE_DIRS[i] as Vector3).y + d.y).toBeGreaterThanOrEqual(-1 - 1e-9);
    }
    expect((b.disp[2] as Vector3).y).toBeLessThan(0); // the top sags a little
  });

  it('pressing one side bulges the other (volume), then it wobbles back to rest', () => {
    const b = createSoftBody();
    settle(b, 3);
    const rest = (b.disp[5] as Vector3).z;
    b.poke(NODE_DIRS[FRONT] as Vector3, 4);
    let bulge = 0;
    for (let i = 0; i < 20; i++) {
      b.step(1 / 60, ZERO, 0);
      bulge = Math.max(bulge, rest - (b.disp[5] as Vector3).z); // back node pushed outward (−z)
    }
    expect(bulge).toBeGreaterThan(0.01);
    settle(b, 6);
    expect(Math.abs((b.disp[5] as Vector3).z - rest)).toBeLessThan(0.01);
  });

  it('being dragged sideways makes the jelly lag behind (inertia)', () => {
    const b = createSoftBody();
    settle(b, 3);
    const x0 = (b.disp[2] as Vector3).x;
    for (let i = 0; i < 10; i++) b.step(1 / 60, new Vector3(30, 0, 0), 0);
    expect((b.disp[2] as Vector3).x).toBeLessThan(x0 - 0.02);
  });
});
