/** Procedural geometry kit (SPEC §7.1): everything is generated in code. */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  type BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  RingGeometry,
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
