/** Shared diorama pieces for stage scenes: table base, camera, hit proxies, disposal. */
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Object3D,
  SphereGeometry,
} from 'three/webgpu';
import { disc } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { toyMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';

export function stageCamera(world: RenderWorld, dist = 12, height = 9, fov = 38, lookY = 0.4) {
  world.camera.fov = fov;
  world.camera.updateProjectionMatrix();
  world.camera.position.set(0, height, dist);
  world.camera.lookAt(0, lookY, 0);
}

export function baseDiorama(color: string = PALETTE.sand, radius = 7): Group {
  const g = new Group();
  const base = new Mesh(disc(radius, 0.9, 64), toyMaterial(color));
  base.position.y = -0.45;
  base.receiveShadow = true;
  g.add(base);
  const rim = new Mesh(disc(radius + 0.25, 0.4, 64), toyMaterial(PALETTE.cocoa));
  rim.position.y = -0.95;
  g.add(rim);
  return g;
}

const proxyMat = new MeshBasicNodeMaterial({ transparent: true, opacity: 0, depthWrite: false });
/** Invisible generous tap target (≥ 64 px at 1080p). */
export function hitSphere(radius: number, id: number): Mesh {
  const m = new Mesh(new SphereGeometry(radius, 8, 6), proxyMat);
  m.userData.hit = id;
  return m;
}
export function hitCylinder(radius: number, height: number, id: number): Mesh {
  const m = new Mesh(new CylinderGeometry(radius, radius, height, 8), proxyMat);
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
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      const m = o.material as { dispose?: () => void };
      if (m !== proxyMat) m.dispose?.();
    }
  });
  root.removeFromParent();
}
