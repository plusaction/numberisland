/**
 * Soft-body jelly: a small mass–spring shell simulated on the CPU, rendered on the GPU.
 *
 * Every slime is a unit sphere carried by NODES surface points. Each node is a point mass with a spring to
 * its rest shape, smoothing springs to its neighbours, a shared pressure that keeps the volume (squeeze one
 * side and the rest bulges), gravity sag, a floor it cannot sink through (so it flattens where it sits) and
 * the inertia of the body being carried (it lags behind and sloshes when dragged). Semi-implicit Euler with
 * fixed substeps; decorative only — game rules never read it (P5).
 *
 * The vertex shader bends the sphere by blending the displacements of the 4 nearest nodes per vertex
 * (`softBallGeometry` precomputes indices + weights as attributes), so the whole surface moves smoothly.
 */
import { attribute, int, uniformArray, vec3 } from 'three/tsl';
import { BufferAttribute, type BufferGeometry, Vector3 } from 'three/webgpu';
import { ball } from '../geo/shapes';

const D = 1 / Math.sqrt(3);
/** Rest directions: the 6 axes + the 8 cube corners. Index 4 is the front (+Z), where the face sits. */
export const NODE_DIRS: readonly Vector3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [D, D, D],
  [D, D, -D],
  [D, -D, D],
  [D, -D, -D],
  [-D, D, D],
  [-D, D, -D],
  [-D, -D, D],
  [-D, -D, -D],
].map(([x, y, z]) => new Vector3(x, y, z));
export const NODES = NODE_DIRS.length;
export const FRONT = 4;

const NEIGHBOURS: number[][] = NODE_DIRS.map((a, i) =>
  NODE_DIRS.flatMap((b, j) => (i !== j && a.dot(b) > 0.45 ? [j] : [])),
);

const K_SHAPE = 70; // spring back to the rest shape
const K_SMOOTH = 30; // neighbours pull together: dents spread into soft bulges
const K_VOLUME = 55; // pressure: what goes in on one side comes out on the other
const DAMP = 3.2; // low damping = long chewy wobble
const GRAVITY = 3.4; // sag (unit-sphere units)
const MAX = 0.38;

export interface SoftBody {
  /** Node displacements in the body's local unit-sphere space (shader input, read every frame). */
  readonly disp: Vector3[];
  /** Push nodes facing `dir` (unit, local) inward with speed `strength` (a poke / a landing). */
  poke(dir: Vector3, strength: number): void;
  /** Kick every node along `dir` (a jump, a yank). */
  kick(dir: Vector3, strength: number): void;
  /** Advance; `accel` = the carrier's acceleration in local units/s² (inertia), `breath` = rest swell. */
  step(dt: number, accel: Vector3, breath: number): void;
}

export function createSoftBody(): SoftBody {
  const disp = NODE_DIRS.map(() => new Vector3());
  const vel = NODE_DIRS.map(() => new Vector3());
  const force = new Vector3();
  const avg = new Vector3();
  const sub = (h: number, accel: Vector3, breath: number) => {
    let radial = 0;
    for (let i = 0; i < NODES; i++) radial += (disp[i] as Vector3).dot(NODE_DIRS[i] as Vector3);
    radial /= NODES;
    for (let i = 0; i < NODES; i++) {
      const d = disp[i] as Vector3;
      const v = vel[i] as Vector3;
      const r = NODE_DIRS[i] as Vector3;
      const nb = NEIGHBOURS[i] as number[];
      avg.set(0, 0, 0);
      for (const j of nb) avg.add(disp[j] as Vector3);
      avg.multiplyScalar(1 / Math.max(1, nb.length));
      force
        .copy(r)
        .multiplyScalar(breath)
        .sub(d)
        .multiplyScalar(K_SHAPE)
        .addScaledVector(avg.sub(d), K_SMOOTH)
        .addScaledVector(r, -K_VOLUME * radial)
        .addScaledVector(v, -DAMP)
        .addScaledVector(accel, -1);
      force.y -= GRAVITY;
      v.addScaledVector(force, h);
    }
    for (let i = 0; i < NODES; i++) {
      const d = disp[i] as Vector3;
      const v = vel[i] as Vector3;
      d.addScaledVector(v, h);
      if (d.length() > MAX) d.setLength(MAX);
      // the tray: the jelly may not sink below its own bottom, so it spreads out where it sits
      const y = (NODE_DIRS[i] as Vector3).y + d.y;
      if (y < -1) {
        d.y = -1 - (NODE_DIRS[i] as Vector3).y;
        if (v.y < 0) v.y *= -0.2;
      }
    }
  };
  return {
    disp,
    poke(dir, strength) {
      for (let i = 0; i < NODES; i++) {
        const r = NODE_DIRS[i] as Vector3;
        const f = Math.max(0, r.dot(dir)) ** 2;
        (vel[i] as Vector3).addScaledVector(r, -strength * f);
      }
    },
    kick(dir, strength) {
      for (const v of vel) v.addScaledVector(dir, strength);
    },
    step(dt, accel, breath) {
      const total = Math.min(dt, 1 / 20);
      const n = Math.max(1, Math.ceil(total / (1 / 120)));
      for (let k = 0; k < n; k++) sub(total / n, accel, breath);
    },
  };
}

/** Sphere geometry (radius 1) carrying, per vertex, its 4 nearest soft-body nodes and blend weights. */
let softBall: BufferGeometry | null = null;
export function softBallGeometry(): BufferGeometry {
  if (softBall) return softBall;
  const g = ball(1, 40).clone();
  g.userData.shared = true;
  const pos = g.getAttribute('position');
  const idx = new Float32Array(pos.count * 4);
  const wts = new Float32Array(pos.count * 4);
  const p = new Vector3();
  const scored: { i: number; w: number }[] = NODE_DIRS.map((_, i) => ({ i, w: 0 }));
  for (let v = 0; v < pos.count; v++) {
    p.fromBufferAttribute(pos, v).normalize();
    for (const s of scored) s.w = Math.max(0, p.dot(NODE_DIRS[s.i] as Vector3)) ** 4;
    const top = scored
      .slice()
      .sort((a, b) => b.w - a.w)
      .slice(0, 4);
    const sum = top.reduce((a, s) => a + s.w, 0) || 1;
    top.forEach((s, k) => {
      idx[v * 4 + k] = s.i;
      wts[v * 4 + k] = s.w / sum;
    });
  }
  g.setAttribute('softIdx', new BufferAttribute(idx, 4));
  g.setAttribute('softW', new BufferAttribute(wts, 4));
  softBall = g;
  return g;
}

/** TSL: this vertex's soft-body displacement (blend of its 4 nodes), for `material.positionNode`. */
export function softDisplacement(body: SoftBody) {
  const arr = uniformArray(body.disp, 'vec3');
  const i = attribute('softIdx', 'vec4');
  const w = attribute('softW', 'vec4');
  return vec3(arr.element(int(i.x)) as never)
    .mul(w.x)
    .add(vec3(arr.element(int(i.y)) as never).mul(w.y))
    .add(vec3(arr.element(int(i.z)) as never).mul(w.z))
    .add(vec3(arr.element(int(i.w)) as never).mul(w.w));
}
