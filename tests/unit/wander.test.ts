/** The monster friend's stroll: it goes places, steers round things and never walks through them. */
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/domain/rng/rng';
import {
  initWander,
  type Obstacle,
  reachable,
  stepWander,
  type WanderWorld,
} from '../../src/scenes/island/wander';

/** Roughly the hub island: tree, four houses, eight portals, a few decorations. */
function island(body = 0.55): WanderWorld {
  const obstacles: Obstacle[] = [{ x: 0, z: 0, r: 1.25, interesting: true }];
  for (const [deg, size] of [
    [20, 0.9],
    [-25, 0.75],
    [170, 0.7],
    [255, 0.8],
  ] as const) {
    const a = (deg * Math.PI) / 180;
    obstacles.push({ x: Math.cos(a) * 2.6, z: Math.sin(a) * 2.6, r: size * 0.8 });
  }
  for (const deg of [200, 230, 280, 315, 350, 50, 95, 140]) {
    const a = (deg * Math.PI) / 180;
    obstacles.push({ x: Math.cos(a) * 4.7, z: Math.sin(a) * 4.7, r: 0.95, interesting: true });
  }
  for (const [deg, r] of [
    [25, 3.0],
    [165, 3.1],
    [300, 2.6],
  ] as const) {
    const a = (deg * Math.PI) / 180;
    obstacles.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, r: 0.45, interesting: true });
  }
  return { obstacles, edge: 5.4, body };
}

describe('[G7] 괴물 친구 산책', () => {
  it('never overlaps a thing, never leaves the island, and gets around (many seeds)', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const w = island(seed % 2 ? 0.55 : 0.75);
      const rng = createRng(`wander-${seed}`);
      const s = initWander(w, rng, 3.9, 5.0);
      const cells = new Set<string>();
      let moving = 0;
      for (let i = 0; i < 20_000; i++) {
        stepWander(s, w, 1 / 60, rng);
        expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(w.edge + 1e-6);
        for (const o of w.obstacles)
          expect(Math.hypot(s.x - o.x, s.z - o.z)).toBeGreaterThanOrEqual(o.r + w.body - 0.02);
        cells.add(`${Math.round(s.x)},${Math.round(s.z)}`);
        if (s.speed > 0.1) moving++;
      }
      // it walks most of the time and visits most of the ground it can stand on
      // the ground it can reach from where it starts (things may close off a corner)
      const area = reachable(w, s.x, s.z);
      const free = new Set(
        area.map((c) => `${Math.round(c.i * 0.3 - w.edge)},${Math.round(c.j * 0.3 - w.edge)}`),
      ).size;
      expect(moving / 20_000).toBeGreaterThan(0.4);
      expect(cells.size, `seed ${seed}: ${cells.size} of ${free}`).toBeGreaterThanOrEqual(
        Math.floor(free * 0.6),
      );
    }
  });

  it('rarely touches things: the whiskers steer it round before the safety net is needed', () => {
    const w = island();
    const rng = createRng('touch');
    const s = initWander(w, rng, 3.9, 5.0);
    let close = 0;
    for (let i = 0; i < 20_000; i++) {
      stepWander(s, w, 1 / 60, rng);
      if (w.obstacles.some((o) => Math.hypot(s.x - o.x, s.z - o.z) < o.r + w.body + 0.03)) close++;
    }
    expect(close / 20_000).toBeLessThan(0.08);
  });

  it('does not get trapped in a tight spot', () => {
    const w: WanderWorld = {
      obstacles: [
        { x: 0, z: 1.6, r: 1 },
        { x: 1.6, z: 0, r: 1 },
        { x: 0, z: -1.6, r: 1 },
      ],
      edge: 5,
      body: 0.5,
    };
    const rng = createRng('trap');
    const s = initWander(w, rng, 0, 0);
    const start = { x: s.x, z: s.z };
    let far = 0;
    for (let i = 0; i < 6000; i++) {
      stepWander(s, w, 1 / 60, rng);
      far = Math.max(far, Math.hypot(s.x - start.x, s.z - start.z));
    }
    expect(far).toBeGreaterThan(2);
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const w = island();
      const rng = createRng('same');
      const s = initWander(w, rng, 3.9, 5.0);
      for (let i = 0; i < 3000; i++) stepWander(s, w, 1 / 60, rng);
      return [s.x, s.z, s.heading];
    };
    expect(run()).toEqual(run());
  });
});
