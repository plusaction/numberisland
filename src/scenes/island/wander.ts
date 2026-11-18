/**
 * The monster friend's little brain for strolling round the hub island — pure maths (no three.js), seeded,
 * unit-tested. It picks a place to go, walks there with "whisker" sensors that feel the way ahead, steers
 * round whatever is in the way (tree, houses, portals, decorations, bushes), stops to look at things, and
 * never walks through an object or off the island.
 *
 * Steering = seek the goal (slowing on arrival) + turn away from the nearest thing the whiskers touch +
 * a push out of any overlap (a last safety net) + a pull back from the island's edge. If it makes no
 * progress for a while it gives up on that goal and picks another one.
 */
import type { Rng } from '../../domain/rng/rng';

export interface Obstacle {
  x: number;
  z: number;
  /** Radius of the thing itself (the friend's own radius is added). */
  r: number;
  /** Something worth stopping to look at (portals, decorations, the tree). */
  interesting?: boolean;
}

export type WanderMode = 'walk' | 'look' | 'startle';

export interface WanderState {
  x: number;
  z: number;
  /** Facing (radians, 0 = +Z, like Object3D.rotation.y). */
  heading: number;
  speed: number;
  goalX: number;
  goalZ: number;
  mode: WanderMode;
  /** Seconds left in the current pause (look / startle). */
  wait: number;
  /** Where the eyes should go (world XZ, y is up to the caller), or null = straight ahead. */
  lookX: number | null;
  lookZ: number | null;
  /** Progress watchdog: the closest the friend got to its goal, and for how long it has not improved. */
  best: number;
  stuckFor: number;
  /** The way it decided to go last time (keeps it from changing its mind every frame). */
  want: number;
  /** The planned route to the goal (way points, last = goal) and the next one to reach. */
  path: { x: number; z: number }[];
  pathAt: number;
}

export interface WanderWorld {
  obstacles: readonly Obstacle[];
  /** Walkable disc: the friend's centre stays within this radius. */
  edge: number;
  /** The friend's body radius (grows when fed). */
  body: number;
  /** A place the child is looking at (the picked portal): visited now and then. */
  focus?: { x: number; z: number } | null;
}

export const WANDER = {
  maxSpeed: 0.85, // units / s
  turnRate: 2.6, // rad / s
  whisker: 1.5,
  whiskerAngle: 0.6,
  arrive: 0.35,
  stuckAfter: 2.2,
  lookMin: 1.0,
  lookMax: 2.4,
} as const;

/** Personal space kept round things while walking (the safety net only acts on real overlap). */
const CLEARANCE = 0.12;

const wrap = (a: number) => {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
};

/** Is the point free (outside every obstacle grown by the body radius plus a margin, inside the edge)? */
export function isFree(w: WanderWorld, x: number, z: number, margin = 0.15): boolean {
  if (Math.hypot(x, z) > w.edge - margin) return false;
  return w.obstacles.every((o) => Math.hypot(x - o.x, z - o.z) >= o.r + w.body + margin);
}

// ── route planning on a coarse grid (cheap: only when a new goal is chosen)
const CELL = 0.3;
type Cell = { i: number; j: number };
const toCell = (w: WanderWorld, x: number, z: number): Cell => ({
  i: Math.round((x + w.edge) / CELL),
  j: Math.round((z + w.edge) / CELL),
});
const cellX = (w: WanderWorld, i: number) => i * CELL - w.edge;
const size = (w: WanderWorld) => Math.round((w.edge * 2) / CELL) + 1;

function freeGrid(w: WanderWorld): Uint8Array {
  const n = size(w);
  const g = new Uint8Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) g[i * n + j] = isFree(w, cellX(w, i), cellX(w, j), 0.06) ? 1 : 0;
  return g;
}

/** Every cell reachable from (x, z), by flood fill. */
export function reachable(w: WanderWorld, x: number, z: number): Cell[] {
  const n = size(w);
  const g = freeGrid(w);
  const start = nearestFree(w, g, toCell(w, x, z));
  if (!start) return [];
  const seen = new Uint8Array(n * n);
  const out: Cell[] = [];
  const q: Cell[] = [start];
  seen[start.i * n + start.j] = 1;
  while (q.length) {
    const c = q.pop() as Cell;
    out.push(c);
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const i = c.i + di;
      const j = c.j + dj;
      if (i < 0 || j < 0 || i >= n || j >= n || seen[i * n + j] || !g[i * n + j]) continue;
      seen[i * n + j] = 1;
      q.push({ i, j });
    }
  }
  return out;
}

function nearestFree(w: WanderWorld, g: Uint8Array, c: Cell): Cell | null {
  const n = size(w);
  for (let r = 0; r < 6; r++)
    for (let di = -r; di <= r; di++)
      for (let dj = -r; dj <= r; dj++) {
        const i = c.i + di;
        const j = c.j + dj;
        if (i >= 0 && j >= 0 && i < n && j < n && g[i * n + j]) return { i, j };
      }
  return null;
}

/** Straight line from a to b keeps clear of everything (for shortening the route). */
function clearLine(w: WanderWorld, ax: number, az: number, bx: number, bz: number): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(len / 0.15));
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    if (!isFree(w, ax + (bx - ax) * t, az + (bz - az) * t, 0.04)) return false;
  }
  return true;
}

/** A* over the grid (8 directions), then pulled tight: the fewest way points with clear lines between. */
export function planPath(
  w: WanderWorld,
  fx: number,
  fz: number,
  tx: number,
  tz: number,
): { x: number; z: number }[] {
  if (clearLine(w, fx, fz, tx, tz)) return [{ x: tx, z: tz }];
  const n = size(w);
  const g = freeGrid(w);
  const a = nearestFree(w, g, toCell(w, fx, fz));
  const b = nearestFree(w, g, toCell(w, tx, tz));
  if (!a || !b) return [];
  const key = (c: Cell) => c.i * n + c.j;
  const cost = new Float32Array(n * n).fill(Number.POSITIVE_INFINITY);
  const from = new Int32Array(n * n).fill(-1);
  const open: { k: number; f: number }[] = [{ k: key(a), f: 0 }];
  cost[key(a)] = 0;
  const goal = key(b);
  while (open.length) {
    let bi = 0;
    for (let q = 1; q < open.length; q++)
      if ((open[q] as { f: number }).f < (open[bi] as { f: number }).f) bi = q;
    const { k } = open.splice(bi, 1)[0] as { k: number };
    if (k === goal) break;
    const ci = Math.floor(k / n);
    const cj = k % n;
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= n || j >= n || !g[i * n + j]) continue;
        // no corner cutting past a blocked cell
        if (di && dj && (!g[(ci + di) * n + cj] || !g[ci * n + cj + dj])) continue;
        const nk = i * n + j;
        const c = (cost[k] as number) + (di && dj ? Math.SQRT2 : 1);
        if (c < (cost[nk] as number)) {
          cost[nk] = c;
          from[nk] = k;
          open.push({ k: nk, f: c + Math.hypot(i - b.i, j - b.j) });
        }
      }
  }
  if (from[goal] === -1 && goal !== key(a)) return [];
  const cells: { x: number; z: number }[] = [];
  for (let k = goal; k !== -1; k = from[k] as number)
    cells.push({ x: cellX(w, Math.floor(k / n)), z: cellX(w, k % n) });
  cells.reverse();
  cells.push({ x: tx, z: tz });
  // string pulling
  const out: { x: number; z: number }[] = [];
  let ax = fx;
  let az = fz;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clearLine(w, ax, az, (cells[j] as { x: number }).x, (cells[j] as { z: number }).z)) j--;
    const p = cells[j] as { x: number; z: number };
    out.push(p);
    ax = p.x;
    az = p.z;
    i = j + 1;
  }
  return out;
}

/** A goal: mostly a random free spot; sometimes next to something interesting or the child's portal. */
export function pickGoal(w: WanderWorld, s: WanderState, rng: Rng): { x: number; z: number } {
  const near = (o: { x: number; z: number }, r: number) => {
    for (let i = 0; i < 12; i++) {
      const a = rng.float() * Math.PI * 2;
      const d = r + w.body + 0.35 + rng.float() * 0.4;
      const x = o.x + Math.cos(a) * d;
      const z = o.z + Math.sin(a) * d;
      if (isFree(w, x, z, 0.2) && ok(x, z)) return { x, z };
    }
    return null;
  };
  const area = reachable(w, s.x, s.z);
  const canReach = new Set(area.map((c) => `${c.i},${c.j}`));
  const ok = (x: number, z: number) => {
    const c = toCell(w, x, z);
    return canReach.has(`${c.i},${c.j}`);
  };
  const roll = rng.float();
  if (w.focus && roll < 0.3) {
    const g = near(w.focus, 1.0);
    if (g) return g;
  }
  const sights = w.obstacles.filter((o) => o.interesting);
  if (sights.length && roll < 0.65) {
    const o = sights[Math.floor(rng.float() * sights.length)] as Obstacle;
    const g = near(o, o.r);
    if (g) return g;
  }
  // anywhere it can actually get to, a little way off
  for (let i = 0; i < 40 && area.length; i++) {
    const c = area[Math.floor(rng.float() * area.length)] as Cell;
    const x = cellX(w, c.i);
    const z = cellX(w, c.j);
    if (isFree(w, x, z, 0.2) && Math.hypot(x - s.x, z - s.z) > 1.2) return { x, z };
  }
  return { x: s.x, z: s.z };
}

export function initWander(w: WanderWorld, rng: Rng, x: number, z: number): WanderState {
  const s: WanderState = {
    x,
    z,
    heading: 0,
    speed: 0,
    goalX: x,
    goalZ: z,
    mode: 'look',
    wait: 0.5,
    lookX: null,
    lookZ: null,
    best: Number.POSITIVE_INFINITY,
    stuckFor: 0,
    want: 0,
    path: [],
    pathAt: 0,
  };
  // start on the biggest stretch of open ground, at the spot nearest to where it was asked to be (the
  // caller may ask for a place off the island, inside a thing, or in a tiny corner it could never leave)
  const n = size(w);
  const g = freeGrid(w);
  const comp = new Int32Array(n * n).fill(-1);
  const sizes: number[] = [];
  for (let k = 0; k < n * n; k++) {
    if (!g[k] || comp[k] !== -1) continue;
    const id = sizes.length;
    let count = 0;
    const q = [k];
    comp[k] = id;
    while (q.length) {
      const c = q.pop() as number;
      count++;
      const ci = Math.floor(c / n);
      const cj = c % n;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const i = ci + di;
        const j = cj + dj;
        const nk = i * n + j;
        if (i < 0 || j < 0 || i >= n || j >= n || !g[nk] || comp[nk] !== -1) continue;
        comp[nk] = id;
        q.push(nk);
      }
    }
    sizes.push(count);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const here = toCell(w, x, z);
  const inMain = here.i >= 0 && here.j >= 0 && here.i < n && here.j < n && comp[here.i * n + here.j] === main;
  if (main >= 0 && !(inMain && isFree(w, x, z, 0.1))) {
    let best = Number.POSITIVE_INFINITY;
    for (let k = 0; k < n * n; k++) {
      if (comp[k] !== main) continue;
      const cx = cellX(w, Math.floor(k / n));
      const cz = cellX(w, k % n);
      const d = Math.hypot(cx - x, cz - z);
      if (d < best && isFree(w, cx, cz, 0.1)) {
        best = d;
        s.x = cx;
        s.z = cz;
      }
    }
  }
  void rng;
  return s;
}

function setGoal(s: WanderState, w: WanderWorld, g: { x: number; z: number }) {
  s.goalX = g.x;
  s.goalZ = g.z;
  s.path = planPath(w, s.x, s.z, g.x, g.z);
  if (!s.path.length) s.path = [{ x: g.x, z: g.z }];
  s.pathAt = 0;
  s.best = Math.hypot(g.x - s.x, g.z - s.z);
  s.stuckFor = 0;
}

/** The first obstacle a ray from (x, z) along angle `a` hits within `len` (distance, or Infinity). */
function feel(
  w: WanderWorld,
  x: number,
  z: number,
  a: number,
  len: number,
): { d: number; o: Obstacle | null } {
  const dx = Math.sin(a);
  const dz = Math.cos(a);
  let best = Number.POSITIVE_INFINITY;
  let hit: Obstacle | null = null;
  for (const o of w.obstacles) {
    const R = o.r + w.body + CLEARANCE;
    // ray-circle: |p + t·d − c| = R
    const px = x - o.x;
    const pz = z - o.z;
    const b = px * dx + pz * dz;
    const c = px * px + pz * pz - R * R;
    if (c <= 0) {
      // already within its personal space: heading into it is blocked right away, heading out is free
      if (b < 0) {
        best = 0;
        hit = o;
      }
      continue;
    }
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t >= 0 && t < len && t < best) {
      best = t;
      hit = o;
    }
  }
  // the island's edge feels like a wall too
  const ex = x + dx * len;
  const ez = z + dz * len;
  if (Math.hypot(ex, ez) > w.edge && best === Number.POSITIVE_INFINITY) best = len * 0.9;
  return { d: best, o: hit };
}

/** One step of the friend's brain. Mutates and returns `s`. */
export function stepWander(s: WanderState, w: WanderWorld, dt: number, rng: Rng): WanderState {
  if (dt <= 0) return s;
  if (s.mode !== 'walk') {
    s.speed = Math.max(0, s.speed - dt * 2.5);
    s.wait -= dt;
    if (s.wait <= 0) {
      setGoal(s, w, pickGoal(w, s, rng));
      s.mode = 'walk';
      s.lookX = s.lookZ = null;
    }
  } else {
    const gx = s.goalX - s.x;
    const gz = s.goalZ - s.z;
    const dist = Math.hypot(gx, gz);
    if (dist < WANDER.arrive) {
      // arrived: stop and look at the nearest interesting thing (or round about)
      s.mode = 'look';
      s.wait = WANDER.lookMin + rng.float() * (WANDER.lookMax - WANDER.lookMin);
      let near: Obstacle | null = null;
      let nd = 2.6;
      for (const o of w.obstacles) {
        if (!o.interesting) continue;
        const d = Math.hypot(o.x - s.x, o.z - s.z) - o.r;
        if (d < nd) {
          nd = d;
          near = o;
        }
      }
      s.lookX = near ? near.x : s.x + Math.sin(s.heading + (rng.float() - 0.5) * 2) * 2;
      s.lookZ = near ? near.z : s.z + Math.cos(s.heading + (rng.float() - 0.5) * 2) * 2;
    } else {
      // judge the way: feel along 16 directions round about and score each one — towards the goal is
      // good, open ground ahead is good, a sharp turn costs a little, something right in front is bad
      // follow the planned route: head for the next way point (skip it once reached)
      let wp = s.path[s.pathAt];
      while (wp && s.pathAt < s.path.length - 1 && Math.hypot(wp.x - s.x, wp.z - s.z) < 0.45)
        wp = s.path[++s.pathAt];
      const toGoal = wp ? Math.atan2(wp.x - s.x, wp.z - s.z) : Math.atan2(gx, gz);
      const len = WANDER.whisker;
      let want = toGoal;
      let bestScore = Number.NEGATIVE_INFINITY;
      let blocked = Number.POSITIVE_INFINITY;
      for (let k = -8; k < 8; k++) {
        const a = toGoal + (k * Math.PI) / 8;
        const d = feel(w, s.x, s.z, a, len).d;
        const room = Math.min(d, len) / len;
        // stick with the way it chose before unless another is clearly better (no dithering in circles)
        const change = Math.abs(wrap(a - s.want));
        let score = Math.cos(wrap(a - toGoal)) * 1.2 - (1 - room) * 2.2 - change * 0.35;
        if (d < 0.35) score -= 5;
        if (score > bestScore) {
          bestScore = score;
          want = a;
          blocked = d;
        }
      }
      s.want = want;
      // the chosen way is also blocked close by: everything round is tight — a little startle
      if (blocked < 0.25 && s.speed > WANDER.maxSpeed * 0.5) {
        s.mode = 'startle';
        s.wait = 0.4;
        s.lookX = s.x + Math.sin(s.heading) * 1.5;
        s.lookZ = s.z + Math.cos(s.heading) * 1.5;
      }
      const turn = wrap(want - s.heading);
      const maxTurn = WANDER.turnRate * dt;
      s.heading = wrap(s.heading + Math.max(-maxTurn, Math.min(maxTurn, turn)));
      // slow down to turn sharply or arrive; never faster than the way ahead allows
      const arriveSlow = Math.min(1, dist / 1.2);
      // a big turn: nearly stop and turn round on the spot first (no tight spirals)
      const turnSlow = Math.max(0.08, Math.cos(Math.min(Math.abs(turn), Math.PI / 2)));
      const roomSlow = blocked < Number.POSITIVE_INFINITY ? Math.max(0.25, blocked / len) : 1;
      const target = WANDER.maxSpeed * Math.min(arriveSlow, turnSlow, roomSlow);
      s.speed += (target - s.speed) * Math.min(1, dt * 3);
      // progress watchdog
      if (dist < s.best - 0.05) {
        s.best = dist;
        s.stuckFor = 0;
      } else s.stuckFor += dt;
      if (s.stuckFor > WANDER.stuckAfter) setGoal(s, w, pickGoal(w, s, rng));
    }
  }
  // move, then the safety net: never inside a thing, never off the island
  s.x += Math.sin(s.heading) * s.speed * dt;
  s.z += Math.cos(s.heading) * s.speed * dt;
  // (a few passes: leaving one thing must not leave it inside a neighbour or over the edge)
  for (let pass = 0; pass < 4; pass++) {
    for (const o of w.obstacles) {
      const R = o.r + w.body;
      const dx = s.x - o.x;
      const dz = s.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d < R) {
        const k = d > 1e-6 ? R / d : 1;
        s.x = o.x + (d > 1e-6 ? dx * k : R);
        s.z = o.z + (d > 1e-6 ? dz * k : 0);
      }
    }
    const r = Math.hypot(s.x, s.z);
    if (r > w.edge) {
      s.x *= w.edge / r;
      s.z *= w.edge / r;
    }
  }
  return s;
}
