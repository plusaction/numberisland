/**
 * Static batching: meshes that never move and share a material are merged into one geometry → one draw
 * call per material instead of one per object (the hub island drops from ~60 to ~12 static draws).
 * Only position/normal are kept (materials are procedural), so mixed primitive types merge cleanly.
 */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type BufferGeometry, type Group, InstancedMesh, type Material, Matrix4, Mesh } from 'three/webgpu';
import { isShared } from './shapes';

export function mergeStatic(root: Group): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map<Material, { geos: BufferGeometry[]; cast: boolean; receive: boolean }>();
  const victims: Mesh[] = [];
  root.traverse((o) => {
    if (!(o instanceof Mesh) || o instanceof InstancedMesh || !o.userData.static || Array.isArray(o.material))
      return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()) as BufferGeometry;
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(new Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const slot = byMat.get(o.material) ?? { geos: [], cast: false, receive: false };
    slot.geos.push(g);
    slot.cast ||= o.castShadow;
    slot.receive ||= o.receiveShadow;
    byMat.set(o.material, slot);
    victims.push(o);
  });
  for (const v of victims) {
    v.removeFromParent();
    if (!isShared(v.geometry)) v.geometry.dispose();
    v.dispatchEvent({ type: 'dispose' } as never);
  }
  for (const [mat, slot] of byMat) {
    const merged = mergeGeometries(slot.geos, false);
    for (const g of slot.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new Mesh(merged, mat);
    mesh.name = 'static-batch';
    mesh.castShadow = slot.cast;
    mesh.receiveShadow = slot.receive;
    mesh.matrixAutoUpdate = false;
    mesh.raycast = () => {};
    root.add(mesh);
  }
  return { before: victims.length, after: byMat.size };
}

/** Mark a mesh (and its children) as never moving, so `mergeStatic` may batch it. */
export function markStatic<
  T extends { traverse(cb: (o: { userData: Record<string, unknown> }) => void): void },
>(o: T): T {
  o.traverse((c) => {
    c.userData.static = true;
  });
  return o;
}
