/**
 * Volumetric-looking smoke: soft billboard puffs drawn as ONE instanced Sprite (one draw call).
 * Each puff is a radial falloff broken up by the shared noise texture (no image files, P1), turns slowly,
 * grows, is lit warm by the blast at first, then cools to a soft grey while buoyancy carries it upward and it
 * fades out. CPU updates a few small typed arrays per frame; nothing is allocated while it runs.
 */
import { float, instancedBufferAttribute, mix, smoothstep, texture, uv, vec2, vec3, vec4 } from 'three/tsl';
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  Sprite,
  SpriteNodeMaterial,
  type Vector3Like,
} from 'three/webgpu';
import { noiseTexture } from '../tsl/noise-texture';

export interface SmokeFx {
  readonly object: Sprite;
  /** Puff out `count` smoke particles from `at`; `heat` (0–1) = how fire-lit they start. */
  emit(at: Vector3Like, count: number, opts?: { heat?: number; spread?: number; size?: number }): void;
  update(dt: number): void;
  clear(): void;
  dispose(): void;
  readonly live: number;
}

const MAX = 96;

export function createSmoke(): SmokeFx {
  const pos = new InstancedBufferAttribute(new Float32Array(MAX * 3), 3).setUsage(DynamicDrawUsage);
  // size, rotation, opacity, heat
  const look = new InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(DynamicDrawUsage);
  const seed = new InstancedBufferAttribute(new Float32Array(MAX * 2), 2);
  const vel = new Float32Array(MAX * 3);
  const age = new Float32Array(MAX);
  const life = new Float32Array(MAX);
  const size0 = new Float32Array(MAX);
  const spin = new Float32Array(MAX);
  const heat0 = new Float32Array(MAX);
  for (let i = 0; i < MAX; i++) seed.setXY(i, Math.random(), Math.random());

  const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false });
  const l = vec4(instancedBufferAttribute(look) as never);
  const sd = vec2(instancedBufferAttribute(seed) as never);
  m.positionNode = instancedBufferAttribute(pos);
  m.scaleNode = vec2(l.x, l.x);
  m.rotationNode = l.y;
  const c = uv().sub(0.5);
  const r = c.length().mul(2);
  // two noise octaves, offset per puff, so every puff has its own cauliflower edge
  const n1 = texture(noiseTexture(), uv().mul(0.35).add(sd)).g;
  const n2 = texture(noiseTexture(), uv().mul(0.9).add(sd.yx)).r;
  const body = smoothstep(1, 0.15, r.add(n1.sub(0.5).mul(0.55)).add(n2.sub(0.5).mul(0.25)));
  const cool = mix(vec3(0.78, 0.76, 0.74), vec3(0.93, 0.92, 0.9), n2); // soft light grey, a little uneven
  const fire = mix(vec3(1, 0.45, 0.12), vec3(0.32, 0.28, 0.3), smoothstep(0.35, 1, l.w.oneMinus()));
  // self-shadowing hint: puff centres slightly darker than rims lit by the sky
  const shade = mix(float(0.82), float(1.05), r);
  m.colorNode = mix(cool, fire, l.w).mul(shade);
  m.opacityNode = body.mul(l.z);
  const sprite = new Sprite(m);
  sprite.count = 0;
  sprite.frustumCulled = false;
  sprite.renderOrder = 0; // before number labels (renderOrder 1–2): digits always stay readable over smoke (P9)
  sprite.name = 'smoke';

  let n = 0;
  const kill = (i: number) => {
    const last = n - 1;
    if (i !== last) {
      pos.setXYZ(i, pos.getX(last), pos.getY(last), pos.getZ(last));
      vel.copyWithin(i * 3, last * 3, last * 3 + 3);
      age[i] = age[last] as number;
      life[i] = life[last] as number;
      size0[i] = size0[last] as number;
      spin[i] = spin[last] as number;
      heat0[i] = heat0[last] as number;
      look.setXYZW(i, look.getX(last), look.getY(last), look.getZ(last), look.getW(last));
    }
    n--;
  };

  return {
    object: sprite,
    get live() {
      return n;
    },
    emit(at, count, opts = {}) {
      const spread = opts.spread ?? 1;
      for (let k = 0; k < count && n < MAX; k++) {
        const i = n++;
        const a = Math.random() * Math.PI * 2;
        const out = (0.6 + Math.random() * 1.6) * spread;
        pos.setXYZ(i, at.x + Math.cos(a) * 0.3, at.y + Math.random() * 0.4, at.z + Math.sin(a) * 0.3);
        vel[i * 3] = Math.cos(a) * out;
        vel[i * 3 + 1] = 0.4 + Math.random() * 1.2;
        vel[i * 3 + 2] = Math.sin(a) * out * 0.7;
        age[i] = 0;
        life[i] = 4.2 + Math.random() * 2;
        size0[i] = (0.9 + Math.random() * 0.9) * (opts.size ?? 1);
        spin[i] = (Math.random() - 0.5) * 0.6;
        heat0[i] = (opts.heat ?? 0) * (0.6 + Math.random() * 0.4);
        look.setXYZW(i, size0[i] as number, Math.random() * 6.28, 0, heat0[i] as number);
      }
      sprite.count = n;
    },
    update(dt) {
      if (n === 0) return;
      const h = Math.min(dt, 1 / 20);
      for (let i = n - 1; i >= 0; i--) {
        age[i] = (age[i] as number) + h;
        const t = age[i] as number;
        const L = life[i] as number;
        if (t >= L) {
          kill(i);
          continue;
        }
        const o = i * 3;
        // drag on the outward burst, buoyancy that builds up: the smoke slows, then climbs
        const drag = Math.exp(-h * 1.6);
        vel[o] = (vel[o] as number) * drag;
        vel[o + 2] = (vel[o + 2] as number) * drag;
        vel[o + 1] = (vel[o + 1] as number) * Math.exp(-h * 0.6) + h * 0.55;
        pos.setXYZ(
          i,
          pos.getX(i) + (vel[o] as number) * h + Math.sin(t * 0.9 + i) * 0.05 * h,
          pos.getY(i) + (vel[o + 1] as number) * h,
          pos.getZ(i) + (vel[o + 2] as number) * h,
        );
        const u = t / L;
        const size = (size0[i] as number) * (1 + Math.sqrt(t) * 1.25);
        const alpha = Math.min(1, t / 0.18) * (1 - smooth(0.45, 1, u)) * 0.85;
        const heat = (heat0[i] as number) * Math.max(0, 1 - t / 0.7);
        look.setXYZW(i, size, look.getY(i) + (spin[i] as number) * h, alpha, heat);
      }
      sprite.count = n;
      pos.needsUpdate = true;
      look.needsUpdate = true;
    },
    clear() {
      n = 0;
      sprite.count = 0;
    },
    dispose() {
      n = 0;
      sprite.removeFromParent();
      m.dispose();
      sprite.dispatchEvent({ type: 'dispose' } as never);
    },
  };
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
