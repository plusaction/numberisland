/**
 * Living-scene kit (D62): small things that move on their own so a map feels alive — butterflies and
 * dragonflies, birds and bats, fireflies, falling snow / petals / leaves and rising bubbles, little critters
 * that hop, waddle or swim along a path, and gentle wind sway / spin / drift for props.
 *
 * Decoration only (P5: never touches the rules). Each swarm is ONE InstancedMesh (one draw call) driven by
 * pure time functions, no allocation per frame. Low tier: half the count. Reduced motion: slow and calm
 * (no flapping, a quarter of the speed).
 */
import {
  type BufferGeometry,
  Color,
  type ColorRepresentation,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  MeshBasicNodeMaterial,
  type Object3D,
  Quaternion,
  Vector3,
} from 'three/webgpu';
import { createRng } from '../../domain/rng/rng';
import { ball, roundedBox } from '../geo/shapes';
import { toyMaterial } from '../tsl/materials';

export interface Living {
  update(t: number, dt: number): void;
}

export interface LifeOpts {
  /** Lower tiers: fewer bodies. */
  low: boolean;
  /** prefers-reduced-motion: slow and calm. */
  calm: boolean;
}

/** One place to register every moving thing of a map; the stage calls `update` each frame. */
export class Life {
  readonly group = new Group();
  private items: Living[] = [];
  private t = 0;
  constructor(readonly opts: LifeOpts) {
    this.group.name = 'map-life';
  }
  /** Scaled count for the tier. */
  n(count: number): number {
    return Math.max(1, Math.round(this.opts.low ? count / 2 : count));
  }
  add<T extends Living>(item: T): T {
    this.items.push(item);
    return item;
  }
  update(dt: number) {
    const d = this.opts.calm ? dt * 0.25 : dt;
    this.t += d;
    for (const it of this.items) it.update(this.t, d);
  }
}

const m4 = new Matrix4();
const q = new Quaternion();
const p = new Vector3();
const s = new Vector3();
const up = new Vector3(0, 1, 0);
const tmpColor = new Color();
const AXIS_Z = new Vector3(0, 0, 1);
const wingQ = new Quaternion();
const wingOff = new Vector3();
const leafAxis = new Vector3();

function instanced(
  geo: BufferGeometry,
  mat: Material,
  count: number,
  colors?: readonly ColorRepresentation[],
) {
  const m = new InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  if (colors?.length)
    for (let i = 0; i < count; i++)
      m.setColorAt(i, tmpColor.set(colors[i % colors.length] as ColorRepresentation));
  return m;
}

/** A tiny two-winged flyer geometry built from two flattened balls (shared by butterflies/dragonflies). */
function wingMat(color: ColorRepresentation) {
  return toyMaterial(color, { finish: 'satin', rimStrength: 0.3 });
}

export interface FlutterOpts {
  count: number;
  center: [number, number, number];
  /** Horizontal wander radius and height band. */
  radius: number;
  height: [number, number];
  colors: readonly ColorRepresentation[];
  /** Wing size. */
  size?: number;
  /** Dragonflies: long thin wings, darting straight lines. */
  darting?: boolean;
  seed?: string;
}

/** Butterflies / dragonflies: flap (wings = two instanced meshes mirrored) and wander on Lissajous paths. */
export function flutter(life: Life, o: FlutterOpts): Living {
  const n = life.n(o.count);
  const size = o.size ?? 0.16;
  const geo = ball(size, 8);
  const mat = wingMat('#ffffff');
  const left = instanced(geo, mat, n, o.colors);
  const right = instanced(geo, mat, n, o.colors);
  const body = instanced(ball(size * 0.35, 6), toyMaterial('#3b3355', { finish: 'matte' }), n);
  life.group.add(left, right, body);
  const rng = createRng(o.seed ?? 'flutter');
  const ph = Array.from({ length: n }, () => [
    rng.float() * 6.28,
    0.6 + rng.float() * 0.6,
    rng.float() * 6.28,
  ]);
  const [cx, cy, cz] = o.center;
  return life.add({
    update(t) {
      for (let i = 0; i < n; i++) {
        const [a, sp, b] = ph[i] as [number, number, number];
        const k = t * sp * (o.darting ? 0.5 : 0.35);
        const x = cx + Math.sin(k + a) * o.radius * Math.cos(k * 0.7 + b);
        const z = cz + Math.cos(k * 1.3 + a) * o.radius * 0.8;
        const y = cy + o.height[0] + (o.height[1] - o.height[0]) * (0.5 + 0.5 * Math.sin(k * 2.1 + b));
        const heading = Math.atan2(Math.cos(k + a), -Math.sin(k * 1.3 + a));
        const flap = life.opts.calm ? 0.4 : Math.sin(t * (o.darting ? 40 : 16) + a) * 0.9;
        const long = o.darting ? 2.2 : 1;
        for (const [mesh, side] of [
          [left, -1],
          [right, 1],
        ] as const) {
          q.setFromAxisAngle(up, heading);
          q.multiply(wingQ.setFromAxisAngle(AXIS_Z, side * flap));
          p.set(x, y, z).add(wingOff.set(side * size * 0.9, 0, 0).applyQuaternion(q));
          s.set(long, 0.12, o.darting ? 0.45 : 1);
          mesh.setMatrixAt(i, m4.compose(p, q, s));
        }
        q.setFromAxisAngle(up, heading);
        body.setMatrixAt(i, m4.compose(p.set(x, y, z), q, s.set(0.6, 0.6, o.darting ? 4 : 2)));
      }
      left.instanceMatrix.needsUpdate = true;
      right.instanceMatrix.needsUpdate = true;
      body.instanceMatrix.needsUpdate = true;
    },
  });
}

export interface FlockOpts {
  count: number;
  center: [number, number, number];
  radius: number;
  height: number;
  color: ColorRepresentation;
  size?: number;
  /** Bats flap fast and swoop; gulls glide. */
  style?: 'glide' | 'swoop';
  seed?: string;
}

/** Birds / gulls / bats circling high over the map: a V of two thin wings that beat (or glide). */
export function flock(life: Life, o: FlockOpts): Living {
  const n = life.n(o.count);
  const size = o.size ?? 0.35;
  const mat = toyMaterial(o.color, { finish: 'matte' });
  const geo = roundedBox(size, 0.04, size * 0.35, 0.015);
  const lw = instanced(geo, mat, n);
  const rw = instanced(geo, mat, n);
  life.group.add(lw, rw);
  const rng = createRng(o.seed ?? 'flock');
  const ph = Array.from({ length: n }, () => [
    rng.float() * 6.28,
    0.8 + rng.float() * 0.5,
    rng.float() * 1.5,
  ]);
  const [cx, cy, cz] = o.center;
  const axisZ = new Vector3(0, 0, 1);
  const wq = new Quaternion();
  const off = new Vector3();
  return life.add({
    update(t) {
      for (let i = 0; i < n; i++) {
        const [a, sp, dh] = ph[i] as [number, number, number];
        const ang = a + t * 0.25 * sp;
        const r = o.radius * (0.75 + 0.25 * Math.sin(t * 0.3 + a));
        const swoop = o.style === 'swoop' ? Math.sin(t * 1.6 + a) * 0.8 : Math.sin(t * 0.5 + a) * 0.3;
        p.set(cx + Math.cos(ang) * r, cy + o.height + dh + swoop, cz + Math.sin(ang) * r);
        const heading = -ang;
        const beat = life.opts.calm
          ? 0.25
          : o.style === 'swoop'
            ? Math.sin(t * 18 + a) * 0.7
            : 0.25 + Math.max(0, Math.sin(t * 5 + a)) * 0.5;
        for (const [mesh, side] of [
          [lw, -1],
          [rw, 1],
        ] as const) {
          q.setFromAxisAngle(up, heading);
          wq.setFromAxisAngle(axisZ, side * beat);
          q.multiply(wq);
          off.set(side * size * 0.45, 0, 0).applyQuaternion(q);
          mesh.setMatrixAt(i, m4.compose(off.add(p), q, s.set(1, 1, 1)));
        }
      }
      lw.instanceMatrix.needsUpdate = true;
      rw.instanceMatrix.needsUpdate = true;
    },
  });
}

export interface GlowOpts {
  count: number;
  center: [number, number, number];
  radius: number;
  height: [number, number];
  color: ColorRepresentation;
  size?: number;
  seed?: string;
}

/** Fireflies / glowing spores: unlit dots that wander slowly and blink. */
export function glow(life: Life, o: GlowOpts): Living {
  const n = life.n(o.count);
  const mesh = instanced(ball(o.size ?? 0.06, 6), new MeshBasicNodeMaterial({ color: o.color }), n);
  life.group.add(mesh);
  const rng = createRng(o.seed ?? 'glow');
  const ph = Array.from({ length: n }, () => [rng.float() * 6.28, rng.float() * 6.28, 0.4 + rng.float()]);
  const [cx, cy, cz] = o.center;
  return life.add({
    update(t) {
      for (let i = 0; i < n; i++) {
        const [a, b, sp] = ph[i] as [number, number, number];
        const k = t * 0.3 * sp;
        p.set(
          cx + Math.sin(k + a) * o.radius * Math.cos(k * 0.6 + b),
          cy + o.height[0] + (o.height[1] - o.height[0]) * (0.5 + 0.5 * Math.sin(k * 1.7 + b)),
          cz + Math.cos(k * 0.9 + b) * o.radius,
        );
        const blink = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 * sp + a));
        mesh.setMatrixAt(i, m4.compose(p, q.identity(), s.setScalar(blink)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  });
}

export interface FallOpts {
  count: number;
  /** Box the particles live in: min / max corners. */
  min: [number, number, number];
  max: [number, number, number];
  kind: 'snow' | 'petal' | 'leaf' | 'bubble' | 'sprinkle' | 'star';
  colors: readonly ColorRepresentation[];
  speed?: number;
  seed?: string;
}

/** Snow, petals, leaves and sprinkles fall (bubbles rise), swaying, then start over at the top/bottom. */
export function fall(life: Life, o: FallOpts): Living {
  const n = life.n(o.count);
  const geo =
    o.kind === 'snow' || o.kind === 'bubble' || o.kind === 'star'
      ? ball(o.kind === 'bubble' ? 0.1 : 0.06, 6)
      : o.kind === 'sprinkle'
        ? roundedBox(0.04, 0.16, 0.04, 0.015)
        : ball(0.12, 6);
  const mat =
    o.kind === 'star'
      ? new MeshBasicNodeMaterial({ color: '#ffffff' })
      : o.kind === 'bubble'
        ? toyMaterial('#ffffff', { roughness: 0.05, rimStrength: 0.6 })
        : toyMaterial('#ffffff', { finish: o.kind === 'snow' ? 'matte' : 'satin' });
  const mesh = instanced(geo, mat, n, o.colors);
  life.group.add(mesh);
  const rng = createRng(o.seed ?? `fall-${o.kind}`);
  const pts = Array.from({ length: n }, () => [rng.float(), rng.float(), rng.float(), rng.float() * 6.28]);
  const [x0, y0, z0] = o.min;
  const [x1, y1, z1] = o.max;
  const h = y1 - y0;
  const sp = o.speed ?? (o.kind === 'snow' ? 0.5 : o.kind === 'bubble' ? 0.6 : o.kind === 'star' ? 0 : 0.7);
  const flat = o.kind === 'petal' || o.kind === 'leaf';
  return life.add({
    update(t) {
      for (let i = 0; i < n; i++) {
        const [fx, fy, fz, a] = pts[i] as [number, number, number, number];
        const prog = (fy + (t * sp) / h) % 1;
        const y = o.kind === 'bubble' ? y0 + prog * h : y1 - prog * h;
        const sway = Math.sin(t * 1.3 + a) * 0.25;
        p.set(x0 + fx * (x1 - x0) + sway, y, z0 + fz * (z1 - z0) + Math.cos(t + a) * 0.15);
        if (flat) q.setFromAxisAngle(leafAxis.set(Math.sin(a), 0.4, Math.cos(a)).normalize(), t * 2 + a);
        else q.setFromAxisAngle(up, t + a);
        const sc = o.kind === 'star' ? 0.5 + 0.5 * Math.abs(Math.sin(t * 1.5 + a * 3)) : 1;
        mesh.setMatrixAt(i, m4.compose(p, q, flat ? s.set(1, 0.25, 0.7) : s.setScalar(sc)));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  });
}

export interface CritterOpts {
  /** Builds one critter (a small Group); called `count` times. */
  make: (i: number) => Object3D;
  count: number;
  /** Path: a loop (ellipse) or a back-and-forth line. */
  path:
    | { kind: 'loop'; center: [number, number, number]; rx: number; rz: number }
    | { kind: 'line'; from: [number, number, number]; to: [number, number, number] };
  speed: number;
  /** How it moves: hop (frogs, bunnies), waddle (penguins, ducks on land), swim (bob on water), scuttle
   * (crabs, sideways), slide (penguin belly), idle (breathing, e.g. a sleeping cat). */
  gait: 'hop' | 'waddle' | 'swim' | 'scuttle' | 'slide' | 'idle';
  /** Spread of the group along the path (0..1). */
  spacing?: number;
}

/** Little animals walking/hopping/swimming along a path, each a few meshes (count stays small: ≤ 6). */
export function critters(life: Life, o: CritterOpts): Living {
  const n = Math.min(6, life.n(o.count));
  const bodies = Array.from({ length: n }, (_, i) => {
    const g = o.make(i);
    life.group.add(g);
    return g;
  });
  const spacing = o.spacing ?? 0.12;
  const at = (u: number, out: Vector3) => {
    if (o.path.kind === 'loop') {
      const [cx, cy, cz] = o.path.center;
      const a = u * Math.PI * 2;
      return out.set(cx + Math.cos(a) * o.path.rx, cy, cz + Math.sin(a) * o.path.rz);
    }
    const k = 1 - Math.abs(1 - 2 * (u % 1)); // ping-pong
    const [ax, ay, az] = o.path.from;
    const [bx, by, bz] = o.path.to;
    return out.set(ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k);
  };
  const a0 = new Vector3();
  const a1 = new Vector3();
  return life.add({
    update(t) {
      bodies.forEach((g, i) => {
        const u = ((((o.gait === 'idle' ? 0 : t * o.speed) + i * spacing) % 1) + 1) % 1;
        at(u, a0);
        at(u + 0.002, a1);
        g.position.copy(a0);
        const dir = Math.atan2(a1.x - a0.x, a1.z - a0.z);
        const ph = t * 6 + i;
        switch (o.gait) {
          case 'hop':
            g.position.y += Math.abs(Math.sin(ph * 0.6)) * 0.35;
            g.rotation.set(0, dir, 0);
            break;
          case 'waddle':
            g.rotation.set(0, dir, Math.sin(ph * 1.2) * 0.18);
            break;
          case 'swim':
            g.position.y += Math.sin(ph * 0.5) * 0.04;
            g.rotation.set(Math.sin(ph * 0.5) * 0.05, dir, 0);
            break;
          case 'scuttle':
            g.rotation.set(0, dir + Math.PI / 2, 0);
            g.position.y += Math.abs(Math.sin(ph * 2)) * 0.04;
            break;
          case 'slide':
            g.rotation.set(Math.PI / 2.4, dir, 0);
            break;
          case 'idle': {
            const b = 1 + Math.sin(t * 1.8 + i) * 0.04;
            g.scale.set(1, b, 1);
            break;
          }
        }
      });
    },
  });
}

/** Wind: props rock gently (flags, grass tufts, palm tops, lanterns). */
export function sway(life: Life, objs: readonly Object3D[], amount = 0.12, speed = 1.4): Living {
  const base = objs.map((o) => o.rotation.z);
  return life.add({
    update(t) {
      objs.forEach((o, i) => {
        o.rotation.z = (base[i] ?? 0) + Math.sin(t * speed + i * 1.7) * amount;
      });
    },
  });
}

/** Turning things (water wheels, windmills, gears, lighthouse lamps). */
export function spin(life: Life, obj: Object3D, speed: number, axis: 'x' | 'y' | 'z' = 'y'): Living {
  return life.add({
    update(_t, dt) {
      obj.rotation[axis] += dt * speed;
    },
  });
}

/** Clouds / planets / boats drifting in a loop across a wide band. */
export function drift(life: Life, objs: readonly Object3D[], span: number, speed: number): Living {
  const x0 = objs.map((o) => o.position.x);
  return life.add({
    update(t) {
      objs.forEach((o, i) => {
        o.position.x = (((((x0[i] ?? 0) + t * speed + span / 2) % span) + span) % span) - span / 2;
      });
    },
  });
}

/** Bobbing (floating things, jellyfish, lanterns on water). */
export function bob(life: Life, objs: readonly Object3D[], amount = 0.12, speed = 1.2): Living {
  const y0 = objs.map((o) => o.position.y);
  return life.add({
    update(t) {
      objs.forEach((o, i) => {
        o.position.y = (y0[i] ?? 0) + Math.sin(t * speed + i * 1.3) * amount;
      });
    },
  });
}
