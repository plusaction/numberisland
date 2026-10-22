/**
 * Water wakes: soft foam ripples left behind moving things (fish, bobbers). One InstancedMesh of flat rings
 * (one draw call); each ripple is stretched along the swimmer's heading, expands and fades. Per-ripple
 * brightness rides in the instance colour (additive foam), transforms in the instance matrix; no per-frame allocation.
 */
import { float, smoothstep, uv } from 'three/tsl';
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three/webgpu';

export interface WakeFx {
  readonly object: InstancedMesh;
  /** Drop one ripple at (x, y, z) for a swimmer heading `angle` (radians around +Y); `strength` 0–1. */
  spawn(x: number, y: number, z: number, angle: number, strength?: number): void;
  update(dt: number): void;
  clear(): void;
  dispose(): void;
}

const MAX = 160;
const LIFE = 1.4;

export function createWake(): WakeFx {
  const geo = new RingGeometry(0.42, 0.62, 40, 1).rotateX(-Math.PI / 2);
  // additive foam: per-ripple brightness rides in the instance colour (robust on every backend)
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending });
  m.color.set('#f4fbff');
  // feathered ring edge so ripples look like foam, not plastic hoops
  // radial position across the ring (0.42–0.62) from RingGeometry's planar UVs (positionLocal is already
  // instance-transformed on InstancedMesh, so it cannot be used here)
  const r = uv().sub(0.5).length().mul(1.24);
  const soft = smoothstep(0.42, 0.52, r).mul(float(1).sub(smoothstep(0.52, 0.62, r)));
  m.opacityNode = soft;
  const mesh = new InstancedMesh(geo, m, MAX);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1; // after the (transparent) water surface, before number labels
  mesh.name = 'wake';
  mesh.raycast = () => {};

  const px = new Float32Array(MAX);
  const py = new Float32Array(MAX);
  const pz = new Float32Array(MAX);
  const ang = new Float32Array(MAX);
  const age = new Float32Array(MAX);
  const str = new Float32Array(MAX);
  let n = 0;
  const m4 = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const p = new Vector3();
  const s = new Vector3();
  const tint = new Color();
  mesh.setColorAt(0, tint.setRGB(0, 0, 0)); // allocate the instance colour buffer up front

  const kill = (i: number) => {
    const last = n - 1;
    px[i] = px[last] as number;
    py[i] = py[last] as number;
    pz[i] = pz[last] as number;
    ang[i] = ang[last] as number;
    age[i] = age[last] as number;
    str[i] = str[last] as number;
    n--;
  };

  return {
    object: mesh,
    spawn(x, y, z, angle, strength = 1) {
      if (n >= MAX) kill(0); // oldest-ish slot is recycled
      const i = n++;
      px[i] = x;
      py[i] = y;
      pz[i] = z;
      ang[i] = angle;
      age[i] = 0;
      str[i] = strength;
    },
    update(dt) {
      if (n === 0) return;
      const h = Math.min(dt, 1 / 20);
      for (let i = n - 1; i >= 0; i--) {
        age[i] = (age[i] as number) + h;
        if ((age[i] as number) >= LIFE) kill(i);
      }
      for (let i = 0; i < n; i++) {
        const u = (age[i] as number) / LIFE;
        const grow = 0.3 + Math.sqrt(u) * 1.1;
        // stretched along the heading: long trailing wake lines rather than circles
        q.setFromAxisAngle(up, ang[i] as number);
        m4.compose(p.set(px[i] as number, py[i] as number, pz[i] as number), q, s.set(grow * 1.7, 1, grow));
        mesh.setMatrixAt(i, m4);
        const a = (str[i] as number) * 0.5 * Math.min(1, u * 8) * (1 - u) ** 1.5;
        mesh.setColorAt(i, tint.setRGB(a, a, a));
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    clear() {
      n = 0;
      mesh.count = 0;
    },
    dispose() {
      n = 0;
      mesh.removeFromParent();
      geo.dispose();
      m.dispose();
      mesh.dispose();
    },
  };
}
