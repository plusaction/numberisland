/**
 * Decorative rigid-body physics — a tiny purpose-built solver (no WASM, a few KB, zero load time).
 * D16: a general engine (Rapier, 1.7 MB gzipped) was measured and rejected for what is only eye candy.
 *
 * P5: physics never decides anything — answers are judged by the pure stage rules. Bodies are spheres for
 * collision (coins are rendered as discs that settle flat), bounce with restitution, slide with friction, roll
 * (angular velocity follows contact velocity), collide with each other (bounded O(n²), n ≤ 200), fall off the
 * diorama edge onto the play table, sleep when at rest and despawn after a few seconds. Each kind is one
 * InstancedMesh (one draw call); storage is preallocated typed arrays (no per-frame allocation).
 */
import {
  Color,
  type ColorRepresentation,
  Group,
  InstancedMesh,
  Matrix4,
  type Object3D,
  Quaternion,
  Vector3,
  type Vector3Like,
} from 'three/webgpu';
import { ball, disc } from '../geo/shapes';
import { metalMaterial, toyMaterial } from '../tsl/materials';

export type BurstKind = 'coin' | 'candy' | 'pebble' | 'drop';
const KINDS: readonly BurstKind[] = ['coin', 'candy', 'pebble', 'drop'];

export interface PhysicsFx {
  readonly object: Object3D;
  burst(kind: BurstKind, at: Vector3Like, count: number, colors?: readonly ColorRepresentation[]): void;
  /** Ground for this scene: a round slab top at `y` with `radius`; the play table is 1.2 below it. */
  setGround(y: number, radius: number): void;
  step(dt: number): void;
  clear(): void;
  dispose(): void;
  /** Live bodies (perf HUD / tests). */
  readonly live: number;
}

const MAX = 200;
const LIFE = 5;
const G = -9.81;
const SPEC: Record<BurstKind, { r: number; e: number; mu: number; cap: number }> = {
  coin: { r: 0.12, e: 0.35, mu: 0.5, cap: 60 },
  candy: { r: 0.12, e: 0.55, mu: 0.3, cap: 50 },
  pebble: { r: 0.1, e: 0.4, mu: 0.6, cap: 40 },
  drop: { r: 0.07, e: 0.1, mu: 0.8, cap: 50 },
};

export function createPhysicsFx(): PhysicsFx {
  const root = new Group();
  root.name = 'physics-fx';
  const meshes: Record<BurstKind, InstancedMesh> = {
    coin: new InstancedMesh(disc(0.15, 0.035, 20), metalMaterial('#ffc83d', 0.22), SPEC.coin.cap),
    candy: new InstancedMesh(ball(0.12, 14), toyMaterial('#ffffff'), SPEC.candy.cap),
    pebble: new InstancedMesh(ball(0.1, 8), toyMaterial('#cfc4b6', { finish: 'matte' }), SPEC.pebble.cap),
    drop: new InstancedMesh(ball(0.07, 10), toyMaterial('#7fdcf0', { roughness: 0.05 }), SPEC.drop.cap),
  };
  const white = new Color('#ffffff');
  for (const k of KINDS) {
    const m = meshes[k];
    m.castShadow = true;
    m.frustumCulled = false; // bodies move every frame; their bounds would need recomputing each frame
    m.count = 0;
    for (let i = 0; i < SPEC[k].cap; i++) m.setColorAt(i, white);
    root.add(m);
  }

  // structure-of-arrays body storage
  const kind = new Uint8Array(MAX);
  const pos = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3);
  const rot = new Float32Array(MAX * 4);
  const spin = new Float32Array(MAX * 3);
  const age = new Float32Array(MAX);
  const asleep = new Uint8Array(MAX);
  const colorOf: Color[] = Array.from({ length: MAX }, () => new Color('#ffffff'));
  let n = 0;
  let groundY = 0;
  let groundR = 7;
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  const removeAt = (i: number) => {
    const last = n - 1;
    if (i !== last) {
      kind[i] = kind[last] as number;
      pos.copyWithin(i * 3, last * 3, last * 3 + 3);
      vel.copyWithin(i * 3, last * 3, last * 3 + 3);
      rot.copyWithin(i * 4, last * 4, last * 4 + 4);
      spin.copyWithin(i * 3, last * 3, last * 3 + 3);
      age[i] = age[last] as number;
      asleep[i] = asleep[last] as number;
      (colorOf[i] as Color).copy(colorOf[last] as Color);
    }
    n--;
  };
  const countOf = (k: BurstKind) => {
    let c = 0;
    const id = KINDS.indexOf(k);
    for (let i = 0; i < n; i++) if (kind[i] === id) c++;
    return c;
  };

  const q = new Quaternion();
  const dq = new Quaternion();
  const axis = new Vector3();
  const m4 = new Matrix4();
  const p = new Vector3();
  const s = new Vector3();
  const flat = new Quaternion();

  const fx: PhysicsFx = {
    object: root,
    get live() {
      return n;
    },
    setGround(y, radius) {
      groundY = y;
      groundR = radius;
    },
    burst(k, at, count, colors) {
      const id = KINDS.indexOf(k);
      for (let c = 0; c < count; c++) {
        // per-kind cap and global cap: recycle the oldest body
        if (countOf(k) >= SPEC[k].cap || n >= MAX) {
          let oldest = -1;
          for (let i = 0; i < n; i++)
            if (kind[i] === id && (oldest < 0 || (age[i] ?? 0) > (age[oldest] ?? 0))) oldest = i;
          if (oldest < 0) return;
          removeAt(oldest);
        }
        const i = n++;
        const a = rand() * Math.PI * 2;
        const sp = 1.2 + rand() * 2.2;
        kind[i] = id;
        pos.set([at.x + Math.cos(a) * 0.2, at.y + rand() * 0.3, at.z + Math.sin(a) * 0.2], i * 3);
        vel.set([Math.cos(a) * sp, 3 + rand() * 3, Math.sin(a) * sp], i * 3);
        q.setFromAxisAngle(axis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), rand() * 6);
        rot.set([q.x, q.y, q.z, q.w], i * 4);
        spin.set([rand() * 10 - 5, rand() * 10 - 5, rand() * 10 - 5], i * 3);
        age[i] = 0;
        asleep[i] = 0;
        (colorOf[i] as Color).set(
          colors?.length ? (colors[c % colors.length] as ColorRepresentation) : '#ffffff',
        );
      }
    },
    step(dt) {
      if (n === 0) return;
      const h = Math.min(dt, 1 / 30);
      // integrate + ground/table contacts
      for (let i = n - 1; i >= 0; i--) {
        age[i] = (age[i] ?? 0) + h;
        const o = i * 3;
        if ((age[i] ?? 0) > LIFE || (pos[o + 1] ?? 0) < groundY - 6) {
          removeAt(i);
          continue;
        }
        if (asleep[i]) continue;
        const spec = SPEC[KINDS[kind[i] ?? 0] as BurstKind];
        vel[o + 1] = (vel[o + 1] ?? 0) + G * h;
        pos[o] = (pos[o] ?? 0) + (vel[o] ?? 0) * h;
        pos[o + 1] = (pos[o + 1] ?? 0) + (vel[o + 1] ?? 0) * h;
        pos[o + 2] = (pos[o + 2] ?? 0) + (vel[o + 2] ?? 0) * h;
        const onSlab = Math.hypot(pos[o] ?? 0, pos[o + 2] ?? 0) < groundR;
        const floor = (onSlab ? groundY : groundY - 1.2) + spec.r;
        if ((pos[o + 1] ?? 0) < floor) {
          pos[o + 1] = floor;
          if ((vel[o + 1] ?? 0) < 0) vel[o + 1] = -(vel[o + 1] ?? 0) * spec.e;
          if (Math.abs(vel[o + 1] ?? 0) < 0.4) vel[o + 1] = 0;
          // friction on the tangential velocity, and rolling: spin = up × v / r
          const f = Math.max(0, 1 - spec.mu * 6 * h);
          vel[o] = (vel[o] ?? 0) * f;
          vel[o + 2] = (vel[o + 2] ?? 0) * f;
          spin[o] = (vel[o + 2] ?? 0) / spec.r;
          spin[o + 1] = (spin[o + 1] ?? 0) * f;
          spin[o + 2] = -(vel[o] ?? 0) / spec.r;
          const speed = Math.hypot(vel[o] ?? 0, vel[o + 1] ?? 0, vel[o + 2] ?? 0);
          if (speed < 0.05 && (age[i] ?? 0) > 0.5) asleep[i] = 1;
        }
        // orientation
        const r4 = i * 4;
        q.set(rot[r4] ?? 0, rot[r4 + 1] ?? 0, rot[r4 + 2] ?? 0, rot[r4 + 3] ?? 1);
        const w = Math.hypot(spin[o] ?? 0, spin[o + 1] ?? 0, spin[o + 2] ?? 0);
        if (w > 1e-4) {
          dq.setFromAxisAngle(
            axis.set((spin[o] ?? 0) / w, (spin[o + 1] ?? 0) / w, (spin[o + 2] ?? 0) / w),
            w * h,
          );
          q.premultiply(dq);
        }
        // coins settle flat once they are rolling slowly on the ground
        if (kind[i] === 0 && (vel[o + 1] ?? 0) === 0) q.slerp(flat, Math.min(1, h * 6));
        rot.set([q.x, q.y, q.z, q.w], r4);
      }
      // body-body: push apart + exchange normal velocity (equal masses)
      for (let i = 0; i < n; i++) {
        const oi = i * 3;
        const ri = SPEC[KINDS[kind[i] ?? 0] as BurstKind].r;
        for (let j = i + 1; j < n; j++) {
          const oj = j * 3;
          const dx = (pos[oj] ?? 0) - (pos[oi] ?? 0);
          const dy = (pos[oj + 1] ?? 0) - (pos[oi + 1] ?? 0);
          const dz = (pos[oj + 2] ?? 0) - (pos[oi + 2] ?? 0);
          const rr = ri + SPEC[KINDS[kind[j] ?? 0] as BurstKind].r;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-10) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const nz = dz / d;
          const push = (rr - d) / 2;
          pos[oi] = (pos[oi] ?? 0) - nx * push;
          pos[oi + 1] = (pos[oi + 1] ?? 0) - ny * push;
          pos[oi + 2] = (pos[oi + 2] ?? 0) - nz * push;
          pos[oj] = (pos[oj] ?? 0) + nx * push;
          pos[oj + 1] = (pos[oj + 1] ?? 0) + ny * push;
          pos[oj + 2] = (pos[oj + 2] ?? 0) + nz * push;
          const rv =
            ((vel[oj] ?? 0) - (vel[oi] ?? 0)) * nx +
            ((vel[oj + 1] ?? 0) - (vel[oi + 1] ?? 0)) * ny +
            ((vel[oj + 2] ?? 0) - (vel[oi + 2] ?? 0)) * nz;
          if (rv < 0) {
            const jn = (-(1 + 0.4) * rv) / 2;
            vel[oi] = (vel[oi] ?? 0) - jn * nx;
            vel[oi + 1] = (vel[oi + 1] ?? 0) - jn * ny;
            vel[oi + 2] = (vel[oi + 2] ?? 0) - jn * nz;
            vel[oj] = (vel[oj] ?? 0) + jn * nx;
            vel[oj + 1] = (vel[oj + 1] ?? 0) + jn * ny;
            vel[oj + 2] = (vel[oj + 2] ?? 0) + jn * nz;
            asleep[i] = 0;
            asleep[j] = 0;
          }
        }
      }
      // upload instances: live bodies packed per kind
      const counts = [0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        const k = kind[i] ?? 0;
        const m = meshes[KINDS[k] as BurstKind];
        const o = i * 3;
        const life = age[i] ?? 0;
        const shrink = life > LIFE - 0.6 ? Math.max(0.01, (LIFE - life) / 0.6) : 1;
        m4.compose(
          p.set(pos[o] ?? 0, pos[o + 1] ?? 0, pos[o + 2] ?? 0),
          q.set(rot[i * 4] ?? 0, rot[i * 4 + 1] ?? 0, rot[i * 4 + 2] ?? 0, rot[i * 4 + 3] ?? 1),
          s.setScalar(shrink),
        );
        const idx = counts[k] ?? 0;
        counts[k] = idx + 1;
        m.setMatrixAt(idx, m4);
        m.setColorAt(idx, colorOf[i] as Color);
      }
      KINDS.forEach((k, id) => {
        const m = meshes[k];
        m.count = counts[id] ?? 0;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      });
    },
    clear() {
      n = 0;
      for (const k of KINDS) meshes[k].count = 0;
    },
    dispose() {
      n = 0;
      for (const k of KINDS) {
        meshes[k].removeFromParent();
        meshes[k].dispose();
      }
    },
  };
  return fx;
}
