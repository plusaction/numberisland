/**
 * Scene teardown that is safe with shared (cached) geometry and materials.
 * three's renderer subscribes every render object to `dispose` on its object, geometry and material; with
 * shared resources the geometry/material are never disposed, so we must dispatch `dispose` on each *object*
 * to release its render objects, pipelines and bindings — otherwise the shared resource keeps the whole old
 * scene alive (measured: ~20 MB heap per hub↔stage round trip before this fix).
 */
import type { Object3D } from 'three/webgpu';
import { isShared } from './shapes';

interface Disposable {
  dispose?: () => void;
  userData?: Record<string, unknown>;
}

export function releaseTree(root: Object3D, keep?: (material: unknown) => boolean) {
  const objects: Object3D[] = [];
  root.traverse((o) => objects.push(o));
  root.removeFromParent();
  for (const o of objects) {
    const mesh = o as Object3D & {
      geometry?: Disposable & { userData: Record<string, unknown> };
      material?: Disposable | Disposable[];
    };
    // Sprites share one static quad owned by three: never dispose it
    const isMesh = (o as { isMesh?: boolean }).isMesh === true;
    if (isMesh && mesh.geometry && !isShared(mesh.geometry)) mesh.geometry.dispose?.();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      if (m.userData?.shared === true || keep?.(m)) continue;
      m.dispose?.();
    }
    // releases the renderer's per-object state (InstancedMesh.dispose() also dispatches this)
    o.dispatchEvent({ type: 'dispose' } as never);
  }
}
