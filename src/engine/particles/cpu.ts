/** CPU particle fallback: one InstancedMesh, ring-buffer allocation (WebGL2 / low tiers). */
import {
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Vector3Like,
} from 'three/webgpu';
import type { Rng } from '../../domain/rng/rng';
import { KINDS, type ParticleKind, type ParticleSystem } from './particles';

export function createCpuParticles(capacity: number, rng: Rng): ParticleSystem {
  const geo = new PlaneGeometry(1, 1);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const mesh = new InstancedMesh(geo, mat, capacity);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.name = 'particles-cpu';
  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const maxLife = new Float32Array(capacity).fill(1);
  const size = new Float32Array(capacity);
  const spin = new Float32Array(capacity);
  const kindOf = new Uint8Array(capacity);
  const kinds: ParticleKind[] = ['confetti', 'sparkle', 'dust', 'droplet'];
  let head = 0;
  let alive = 0;
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const axis = new Vector3(0, 0, 1);
  const c = new Color();
  const zero = new Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < capacity; i++) {
    mesh.setMatrixAt(i, zero);
    mesh.setColorAt(i, c.set('#ffffff'));
  }

  return {
    object: mesh,
    gpu: false,
    get active() {
      return alive;
    },
    emit(kind: ParticleKind, at: Vector3Like, count: number) {
      const k = KINDS[kind];
      for (let n = 0; n < count; n++) {
        const i = head;
        head = (head + 1) % capacity;
        const a = rng.float() * Math.PI * 2;
        const sp = k.speed[0] + rng.float() * (k.speed[1] - k.speed[0]);
        pos[i * 3] = at.x;
        pos[i * 3 + 1] = at.y;
        pos[i * 3 + 2] = at.z;
        vel[i * 3] = Math.cos(a) * sp;
        vel[i * 3 + 1] = k.up * (0.6 + rng.float() * 0.6);
        vel[i * 3 + 2] = Math.sin(a) * sp;
        maxLife[i] = k.life * (0.7 + rng.float() * 0.6);
        life[i] = maxLife[i] as number;
        size[i] = k.size * (0.7 + rng.float() * 0.6);
        spin[i] = (rng.float() - 0.5) * 12;
        kindOf[i] = kinds.indexOf(kind);
        mesh.setColorAt(i, c.set(rng.pick(k.colors)));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    update(dt: number) {
      alive = 0;
      for (let i = 0; i < capacity; i++) {
        if ((life[i] as number) <= 0) continue;
        const k = KINDS[kinds[kindOf[i] as number] as ParticleKind];
        life[i] = (life[i] as number) - dt;
        if ((life[i] as number) <= 0) {
          mesh.setMatrixAt(i, zero);
          continue;
        }
        alive++;
        const drag = Math.exp(-k.drag * dt);
        vel[i * 3] = (vel[i * 3] as number) * drag;
        vel[i * 3 + 1] = (vel[i * 3 + 1] as number) * drag - k.gravity * dt;
        vel[i * 3 + 2] = (vel[i * 3 + 2] as number) * drag;
        pos[i * 3] = (pos[i * 3] as number) + (vel[i * 3] as number) * dt;
        pos[i * 3 + 1] = (pos[i * 3 + 1] as number) + (vel[i * 3 + 1] as number) * dt;
        pos[i * 3 + 2] = (pos[i * 3 + 2] as number) + (vel[i * 3 + 2] as number) * dt;
        const t = (life[i] as number) / (maxLife[i] as number);
        const sc = (size[i] as number) * Math.min(1, t * 3);
        p.set(pos[i * 3] as number, pos[i * 3 + 1] as number, pos[i * 3 + 2] as number);
        q.setFromAxisAngle(axis, (spin[i] as number) * (1 - t));
        s.set(sc, sc * (kindOf[i] === 0 ? 0.6 : 1), sc);
        mesh.setMatrixAt(i, m.compose(p, q, s));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}
