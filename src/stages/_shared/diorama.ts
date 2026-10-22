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
import { disc } from '../../engine/geo/shapes';
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

export function hitId(
  objects: Object3D[],
  raycaster: { intersectObjects(o: Object3D[], r: boolean): { object: Object3D }[] },
): number | null {
  const h = raycaster.intersectObjects(objects, false)[0];
  const id = h?.object.userData.hit;
  return typeof id === 'number' ? id : null;
}

export function disposeTree(root: Object3D) {
  releaseTree(root);
}
