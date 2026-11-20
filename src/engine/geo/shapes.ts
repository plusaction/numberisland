/** Procedural geometry kit (SPEC §7.1): everything is generated in code. */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  type BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  RingGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three/webgpu';
import type { Rng } from '../../domain/rng/rng';

/**
 * Geometry cache: identical primitives share one GPU buffer (memory + upload time). Shared geometry is
 * flagged `userData.shared` and is never disposed by scene teardown (`isShared`).
 */
const geoCache = new Map<string, BufferGeometry>();
function cached<T extends BufferGeometry>(key: string, make: () => T): T {
  const hit = geoCache.get(key);
  if (hit) return hit as T;
  const g = make();
  g.userData.shared = true;
  geoCache.set(key, g);
  return g;
}
export const sharedGeometryCount = () => geoCache.size;
export const isShared = (o: { userData: Record<string, unknown> }) => o.userData.shared === true;

export const roundedBox = (w: number, h: number, d: number, r = Math.min(w, h, d) * 0.25) =>
  cached(`rb|${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 4, r));
export const capsule = (radius: number, length: number) =>
  cached(`cap|${radius}|${length}`, () => new CapsuleGeometry(radius, length, 8, 16));
export const ball = (radius: number, detail = 32) =>
  cached(`ball|${radius}|${detail}`, () => new SphereGeometry(radius, detail, Math.max(12, detail / 2)));
export const disc = (radius: number, height: number, segments = 48) =>
  cached(
    `disc|${radius}|${height}|${segments}`,
    () => new CylinderGeometry(radius, radius * 1.04, height, segments),
  );
export const ring = (radius: number, tube: number) =>
  cached(`ring|${radius}|${tube}`, () => new TorusGeometry(radius, tube, 12, 48));

/**
 * Horizontal round water surface: a polar grid (rings × segments) so the wave shader gets even vertex density
 * and the edge is exactly circular (no square corners overlapping the far ring).
 */
export const waterPlane = (radius: number, segments = 96) =>
  cached(`water|${radius}|${segments}`, () => {
    const rings = Math.max(8, Math.round(segments / 2));
    const segs = segments;
    const pos: number[] = [0, 0, 0];
    const nrm: number[] = [0, 1, 0];
    const idx: number[] = [];
    for (let r = 1; r <= rings; r++) {
      const rad = (r / rings) * radius;
      for (let a = 0; a < segs; a++) {
        const t = (a / segs) * Math.PI * 2;
        pos.push(Math.cos(t) * rad, 0, Math.sin(t) * rad);
        nrm.push(0, 1, 0);
      }
    }
    const v = (r: number, a: number) => (r === 0 ? 0 : 1 + (r - 1) * segs + (a % segs));
    for (let a = 0; a < segs; a++) idx.push(0, v(1, a + 1), v(1, a));
    for (let r = 1; r < rings; r++) {
      for (let a = 0; a < segs; a++) {
        idx.push(v(r, a), v(r, a + 1), v(r + 1, a + 1), v(r, a), v(r + 1, a + 1), v(r + 1, a));
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  });

/** Far water out to the horizon: a coarse flat ring (LOD — distant water needs no wave vertices). */
export const waterRing = (inner: number, outer: number) =>
  cached(`waterRing|${inner}|${outer}`, () => new RingGeometry(inner, outer, 64, 3).rotateX(-Math.PI / 2));

/** Lumpy blob: icosphere with smooth seeded displacement (rocks, bushes, clouds). */
export function blob(radius: number, rng: Rng, amount = 0.18, detail = 4) {
  // merge duplicated vertices so displacement + normals stay smooth (no faceting)
  const g = mergeVertices(new IcosahedronGeometry(radius, detail));
  const pos = g.getAttribute('position') as BufferAttribute;
  const k = [rng.float() * 6, rng.float() * 6, rng.float() * 6];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const f =
      1 +
      amount *
        (Math.sin((x / len) * 3.1 + (k[0] as number)) * 0.5 +
          Math.sin((y / len) * 2.7 + (k[1] as number)) * 0.3 +
          Math.sin((z / len) * 3.7 + (k[2] as number)) * 0.2);
    pos.setXYZ(i, x * f, y * f, z * f);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A cut gem (the game's currency): flat table on top, sloped crown, wide girdle, pointed pavilion below.
 * Non-indexed so every facet gets its own flat normal — the sparkle comes from the facets catching light.
 */
export const gemGeo = (radius: number, sides = 8) =>
  cached(`gem|${radius}|${sides}`, () => {
    const table = { r: radius * 0.55, y: radius * 0.42 };
    const girdle = { r: radius, y: radius * 0.1 };
    const culet = -radius * 0.85;
    const pts: number[] = [];
    const at = (r: number, a: number, y: number) => [Math.cos(a) * r, y, Math.sin(a) * r];
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const t0 = at(table.r, a0, table.y);
      const t1 = at(table.r, a1, table.y);
      const g0 = at(girdle.r, a0, girdle.y);
      const g1 = at(girdle.r, a1, girdle.y);
      // table (fan), crown (two triangles), pavilion (to the point) — counter-clockwise seen from outside
      pts.push(0, table.y, 0, ...t1, ...t0);
      pts.push(...t0, ...t1, ...g1, ...t0, ...g1, ...g0);
      pts.push(...g0, ...g1, 0, culet, 0);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    g.computeVertexNormals();
    return g;
  });

/** A chunky five-point star badge (front face toward +Z), for trophies and score marks. */
export const starGeo = (radius: number, depth: number) =>
  cached(`star|${radius}|${depth}`, () => {
    const s = new Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? radius * 0.48 : radius;
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.closePath();
    const g = new ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.35,
      bevelSize: radius * 0.08,
      bevelSegments: 2,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  });
