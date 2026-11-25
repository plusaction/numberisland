/** Shared diorama pieces for stage scenes: table base, camera, hit proxies, disposal. */
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Object3D,
  SphereGeometry,
} from 'three/webgpu';
import { releaseTree } from '../../engine/geo/release';
import { disc, roundedBox } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { sandMaterial, tableMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';

export function stageCamera(world: RenderWorld, dist = 12, height = 9, fov = 38, lookY = 0.4) {
  world.camera.fov = fov;
  world.camera.updateProjectionMatrix();
  world.camera.position.set(0, height, dist);
  world.camera.lookAt(0, lookY, 0);
  world.setGround(0, 7); // diorama top (bodies roll off the edge onto the table)
}

/**
 * Diorama on a polished wooden play table: felt-like top (grainy, coloured), wooden rim, and a glossy table
 * that reflects the toys (environment reflections everywhere, screen-space reflections on the ultra tier).
 * All parts are static and share cached geometry/materials.
 */
export function baseDiorama(color: string = PALETTE.sand, radius = 7): Group {
  const g = new Group();
  const base = new Mesh(disc(radius, 0.9, 96), sandMaterial(color));
  base.position.y = -0.45;
  base.receiveShadow = true;
  g.add(base);
  const rim = new Mesh(disc(radius + 0.25, 0.4, 96), woodMaterial('#9a6a48'));
  rim.position.y = -0.95;
  rim.castShadow = true;
  g.add(rim);
  const table = new Mesh(disc(30, 0.3, 64), tableMaterial('#c4936a'));
  table.position.y = -1.3;
  table.receiveShadow = true;
  g.add(table);
  return g;
}

export type GroundShape = 'round' | 'square' | 'hex' | 'blob' | 'flower';

/**
 * A map's diorama (D62): the same play table, but the felt top takes the map's shape — round, rounded
 * square, hexagon, a soft blob or a five-petal flower — with a matching wooden rim underneath.
 */
export function mapDiorama(shape: GroundShape, color: string, radius = 7, rimColor = '#9a6a48'): Group {
  if (shape === 'round') return baseDiorama(color, radius);
  const g = new Group();
  const top = (r: number, h: number, mat: ReturnType<typeof sandMaterial>) => {
    let m: Mesh;
    if (shape === 'square') m = new Mesh(roundedBox(r * 1.8, h, r * 1.8, 0.6), mat);
    else if (shape === 'hex') m = new Mesh(new CylinderGeometry(r * 1.06, r * 1.06, h, 6), mat);
    else if (shape === 'blob') {
      m = new Mesh(disc(r, h, 96), mat);
      m.scale.set(1.14, 1, 0.9);
    } else {
      // flower: a round middle and five round petals around it
      m = new Mesh(disc(r * 0.82, h, 64), mat);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
        const petal = new Mesh(disc(r * 0.42, h, 48), mat);
        petal.position.set(Math.cos(a) * r * 0.62, 0, Math.sin(a) * r * 0.62);
        m.add(petal);
      }
    }
    return m;
  };
  const base = top(radius, 0.9, sandMaterial(color));
  base.position.y = -0.45;
  base.receiveShadow = true;
  base.traverse((o) => {
    (o as Mesh).receiveShadow = true;
  });
  g.add(base);
  const rim = top(radius + 0.25, 0.4, woodMaterial(rimColor));
  rim.position.y = -0.95;
  rim.castShadow = true;
  g.add(rim);
  const table = new Mesh(disc(30, 0.3, 64), tableMaterial('#c4936a'));
  table.position.y = -1.3;
  table.receiveShadow = true;
  g.add(table);
  return g;
}

const proxyMat = new MeshBasicNodeMaterial({ transparent: true, opacity: 0, depthWrite: false });
proxyMat.userData.shared = true;
/**
 * Hit proxies live on their own layer: the camera never renders them (no invisible draw calls, no ghost
 * shapes in the depth/normal buffers used by contact shadows), but the pointer raycaster tests it.
 */
export const HIT_LAYER = 1;
/** Invisible generous tap target (≥ 64 px at 1080p). */
export function hitSphere(radius: number, id: number): Mesh {
  const m = new Mesh(new SphereGeometry(radius, 8, 6), proxyMat);
  m.layers.set(HIT_LAYER);
  m.userData.hit = id;
  return m;
}
export function hitCylinder(radius: number, height: number, id: number): Mesh {
  const m = new Mesh(new CylinderGeometry(radius, radius, height, 8), proxyMat);
  m.layers.set(HIT_LAYER);
  m.userData.hit = id;
  return m;
}

/** Is this object (and every parent) shown? Hidden things must not catch taps meant for others. */
export function shown(o: Object3D | null): boolean {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

/**
 * The id under the pointer: nearest hit first, but hidden proxies (a caught fish, a cut wire, an opened
 * thing) are skipped, and so are ids `accept` refuses — those must never swallow a tap meant for something
 * behind them (user report: "one number per round can't be tapped").
 */
export function hitId(
  objects: Object3D[],
  raycaster: { intersectObjects(o: Object3D[], r: boolean): { object: Object3D }[] },
  accept?: (id: number) => boolean,
): number | null {
  for (const h of raycaster.intersectObjects(objects, false)) {
    const id = h.object.userData.hit;
    if (typeof id !== 'number' || !shown(h.object)) continue;
    if (accept && !accept(id)) continue;
    return id;
  }
  return null;
}

/**
 * Screen-space pick (for small things that move and crowd together, like fish): the candidate whose
 * on-screen points (body, number badge) are nearest the finger, within `reach` (fraction of screen height).
 */
export function nearestOnScreen(
  px: number,
  py: number,
  aspect: number,
  candidates: { id: number; points: { x: number; y: number }[] }[],
  reach = 0.17,
): number | null {
  let best: number | null = null;
  let bestD = reach * 2; // NDC spans 2 units of height
  for (const c of candidates)
    for (const p of c.points) {
      const d = Math.hypot((p.x - px) * aspect, p.y - py);
      if (d < bestD) {
        bestD = d;
        best = c.id;
      }
    }
  return best;
}

export function disposeTree(root: Object3D) {
  releaseTree(root);
}
