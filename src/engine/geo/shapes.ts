/** Procedural geometry kit (SPEC §7.1): everything is generated in code. */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  type BufferAttribute,
  CapsuleGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three/webgpu';
import type { Rng } from '../../domain/rng/rng';

export const roundedBox = (w: number, h: number, d: number, r = Math.min(w, h, d) * 0.25) =>
  new RoundedBoxGeometry(w, h, d, 4, r);
export const capsule = (radius: number, length: number) => new CapsuleGeometry(radius, length, 8, 16);
export const ball = (radius: number, detail = 32) =>
  new SphereGeometry(radius, detail, Math.max(12, detail / 2));
export const disc = (radius: number, height: number, segments = 48) =>
  new CylinderGeometry(radius, radius * 1.04, height, segments);
export const ring = (radius: number, tube: number) => new TorusGeometry(radius, tube, 12, 48);

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
