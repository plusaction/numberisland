/**
 * GPU particles with TSL compute (WebGPU tiers). Each emit() becomes one spawn dispatch next frame;
 * an integrate dispatch runs every frame. Rendering is an instanced Sprite reading the storage buffers.
 */

import {
  Fn,
  float,
  hash,
  If,
  instancedArray,
  instanceIndex,
  mix,
  select,
  uint,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import { Color, Sprite, SpriteNodeMaterial, type Vector3Like } from 'three/webgpu';
import { KIND_INDEX, KINDS, type ParticleKind, type ParticleSystem } from './particles';

const KIND_ORDER: ParticleKind[] = ['confetti', 'sparkle', 'dust', 'droplet'];
const MAX_BURST = 512;

export function createGpuParticles(capacity: number): ParticleSystem {
  const position = instancedArray(capacity, 'vec3');
  const velocity = instancedArray(capacity, 'vec3');
  const tint = instancedArray(capacity, 'vec3');
  // x = life left, y = max life, z = size, w = kind
  const state = instancedArray(capacity, 'vec4');

  const spawnStart = uniform(0, 'uint');
  const spawnCount = uniform(0, 'uint');
  const spawnOrigin = uniform(vec3(0, 0, 0));
  const spawnKind = uniform(0, 'uint');
  const spawnSeed = uniform(0);
  const dtU = uniform(1 / 60);

  // Per-kind parameters: tiny select-chains (4 kinds) keep the shader portable and typed.
  const kindsArr = KIND_ORDER.map((k) => KINDS[k]);
  const perKind = (k: ReturnType<typeof uint>, values: number[]) =>
    select(
      k.equal(uint(0)),
      float(values[0] ?? 0),
      select(
        k.equal(uint(1)),
        float(values[1] ?? 0),
        select(k.equal(uint(2)), float(values[2] ?? 0), float(values[3] ?? 0)),
      ),
    );
  const perKindColor = (k: ReturnType<typeof uint>, pickIdx: (n: number) => number) => {
    const cs = kindsArr.map((kk) => new Color(kk.colors[pickIdx(kk.colors.length)]));
    return select(
      k.equal(uint(0)),
      vec3((cs[0] as Color).r, (cs[0] as Color).g, (cs[0] as Color).b),
      select(
        k.equal(uint(1)),
        vec3((cs[1] as Color).r, (cs[1] as Color).g, (cs[1] as Color).b),
        select(
          k.equal(uint(2)),
          vec3((cs[2] as Color).r, (cs[2] as Color).g, (cs[2] as Color).b),
          vec3((cs[3] as Color).r, (cs[3] as Color).g, (cs[3] as Color).b),
        ),
      ),
    );
  };
  const speedMin = kindsArr.map((k) => k.speed[0]);
  const speedMax = kindsArr.map((k) => k.speed[1]);
  const upV = kindsArr.map((k) => k.up);
  const gravityV = kindsArr.map((k) => k.gravity);
  const lifeV = kindsArr.map((k) => k.life);
  const sizeV = kindsArr.map((k) => k.size);
  const dragV = kindsArr.map((k) => k.drag);

  const spawn = Fn(() => {
    If(instanceIndex.lessThan(spawnCount), () => {
      const i = spawnStart.add(instanceIndex).mod(uint(capacity));
      const seed = float(instanceIndex).mul(4).add(spawnSeed);
      const r1 = hash(seed);
      const r2 = hash(seed.add(1));
      const r3 = hash(seed.add(2));
      const r4 = hash(seed.add(3));
      const k = uint(spawnKind);
      const ang = r1.mul(Math.PI * 2);
      const sp = mix(perKind(k, speedMin), perKind(k, speedMax), r2);
      position.element(i).assign(spawnOrigin);
      velocity
        .element(i)
        .assign(vec3(ang.cos().mul(sp), perKind(k, upV).mul(r3.mul(0.6).add(0.6)), ang.sin().mul(sp)));
      const life = perKind(k, lifeV).mul(r4.mul(0.6).add(0.7));
      state.element(i).assign(vec4(life, life, perKind(k, sizeV).mul(r2.mul(0.6).add(0.7)), float(k)));
      tint.element(i).assign(
        mix(
          perKindColor(k, () => 0),
          perKindColor(k, (n) => n - 1),
          r3,
        ),
      );
    });
  })().compute(MAX_BURST);

  const integrate = Fn(() => {
    const st = state.element(instanceIndex);
    If(st.x.greaterThan(0), () => {
      const k = uint(st.w);
      const v = velocity.element(instanceIndex);
      const drag = perKind(k, dragV).mul(dtU).negate().exp();
      v.assign(vec3(v.x.mul(drag), v.y.mul(drag).sub(perKind(k, gravityV).mul(dtU)), v.z.mul(drag)));
      position.element(instanceIndex).addAssign(v.mul(dtU));
      st.x.subAssign(dtU);
    });
  })().compute(capacity);

  const mat = new SpriteNodeMaterial({ transparent: true, depthWrite: false });
  const st = state.toAttribute();
  mat.positionNode = position.toAttribute();
  mat.colorNode = tint.toAttribute();
  mat.scaleNode = st.z
    .mul(st.x.div(st.y).mul(3).clamp(0, 1))
    .mul(st.x.greaterThan(0).select(float(1), float(0)));
  const sprite = new Sprite(mat);
  sprite.count = capacity;
  sprite.frustumCulled = false;
  sprite.name = 'particles-gpu';

  const queue: { kind: ParticleKind; pos: Vector3Like; count: number }[] = [];
  let head = 0;
  let seedCounter = 1;

  return {
    object: sprite,
    gpu: true,
    get active() {
      return capacity;
    },
    emit(kind, pos, count) {
      let left = count;
      while (left > 0) {
        const n = Math.min(left, MAX_BURST);
        queue.push({ kind, pos: { x: pos.x, y: pos.y, z: pos.z }, count: n });
        left -= n;
      }
    },
    update(dt, renderer) {
      dtU.value = dt;
      const burst = queue.shift();
      if (burst) {
        spawnStart.value = head;
        spawnCount.value = burst.count;
        spawnKind.value = KIND_INDEX[burst.kind];
        spawnOrigin.value.set(burst.pos.x, burst.pos.y, burst.pos.z);
        spawnSeed.value = ((seedCounter++ * 2654435761) % 1_000_003) * 4 + MAX_BURST * 8;
        head = (head + burst.count) % capacity;
        renderer.compute(spawn);
      }
      renderer.compute(integrate);
    },
    dispose() {
      mat.dispose();
      spawn.dispose?.();
      integrate.dispose?.();
    },
  };
}
