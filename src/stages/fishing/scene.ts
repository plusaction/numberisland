/** ③ 숫자 낚시 diorama: TSL pond, number fish, rod & line; reel = slow-mo parabola + droplets (signature). */
import { ConeGeometry, CylinderGeometry, Group, Mesh, Vector3 } from 'three/webgpu';
import { createRng } from '../../domain/rng/rng';
import { HitStop, Shake, Spring } from '../../engine/fx/juice';
import { createWake } from '../../engine/fx/wake';
import { ball, blob, capsule, disc, waterPlane } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import {
  sandMaterial,
  toyMaterial,
  waterMaterial,
  waterTime,
  woodMaterial,
} from '../../engine/tsl/materials';
import { WAVES_POND, waveHeight } from '../../engine/water/waves';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { baseDiorama, disposeTree, hitCylinder, hitId, hitSphere, stageCamera } from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import { createOddItems, oddPath } from './odd-items';
import { BOUNCE_TICKS, type FishingAction, type FishingState, REEL_TICKS } from './rules';

const FISH_COLORS = [
  PALETTE.peach,
  PALETTE.sun,
  PALETTE.berry,
  PALETTE.lavender,
  PALETTE.mint,
  '#ffb3c7',
  '#9ee6c4',
  '#ffc98a',
];
const ODD_ID = 1000;

interface FishView {
  group: Group;
  label: NumberLabel;
  body: Mesh;
  spring: Spring;
  proxy: Mesh;
  pos: Vector3;
  /** Last frame's position (wake direction/speed). */
  prev: Vector3;
  /** Seconds until the next wake ripple. */
  wakeT: number;
  jumpT: number;
}

export function createFishingScene(
  world: RenderWorld,
  ctx: StageCtx,
): StageScene<FishingState, FishingAction> {
  const root = new Group();
  root.name = 'stage-fishing';
  world.scene.add(root);
  stageCamera(world, 11.5, 10, 38);
  root.add(baseDiorama(PALETTE.leaf, 7));
  const rng = createRng('fishing-deco');
  const sand = new Mesh(disc(5.2, 0.12, 64), sandMaterial(PALETTE.sand, true));
  sand.position.y = 0.02;
  root.add(sand);
  const pond = new Mesh(waterPlane(4.6, 96), waterMaterial());
  pond.position.y = 0.16;
  pond.receiveShadow = true;
  root.add(pond);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const rock = new Mesh(
      blob(0.35 + rng.float() * 0.25, rng, 0.25),
      toyMaterial(i % 3 ? '#d8cfc4' : PALETTE.mint),
    );
    rock.position.set(Math.cos(a) * 5.4, 0.2, Math.sin(a) * 5.4);
    rock.castShadow = true;
    root.add(rock);
  }
  // rod on the near-left shore
  const rod = new Group();
  const pole = new Mesh(new CylinderGeometry(0.06, 0.09, 4.2, 10), woodMaterial('#8a5a3c'));
  pole.rotation.z = -0.75;
  pole.position.set(0.9, 1.5, 0);
  const reel = new Mesh(disc(0.25, 0.18, 20), toyMaterial(PALETTE.berry));
  reel.rotation.x = Math.PI / 2;
  reel.position.set(0.15, 0.7, 0.1);
  rod.add(pole, reel);
  rod.position.set(-5.2, 0.2, 3.4);
  rod.rotation.y = 0.5;
  root.add(rod);
  const tip = new Vector3();
  const line = new Mesh(new CylinderGeometry(0.015, 0.015, 1, 6), toyMaterial(PALETTE.white));
  line.visible = false;
  root.add(line);
  const bucket = new Mesh(disc(0.55, 0.7, 24), toyMaterial('#7cc8e0'));
  bucket.position.set(-4.6, 0.35, 4.6);
  root.add(bucket);

  const fishViews = new Map<number, FishView>();
  let puzzleRef: FishingState['puzzle'] = null;
  const proxies: Mesh[] = [];
  let cursorId: number | null = null;
  let glowId: number | null = null;
  const hitStop = new HitStop();
  const shake = new Shake(!ctx.reducedMotion && ctx.shakeIntensity > 0);
  let t = 0;
  let slowmo = 0;

  // bonus thing drifting by (boot / duck / key) with a coin hint above it
  const oddItems = createOddItems();
  const odd = oddItems.group;
  let oddWakeT = 0;
  const oddProxy = hitSphere(0.9, ODD_ID);
  oddProxy.position.y = 0.4;
  odd.add(oddProxy);
  odd.visible = false;
  root.add(odd);
  const wake = createWake();
  root.add(wake.object);

  const buildFish = (state: FishingState) => {
    for (const v of fishViews.values()) {
      disposeTree(v.group);
      disposeTree(v.label);
    }
    fishViews.clear();
    proxies.length = 0;
    const p = state.puzzle;
    if (!p) return;
    p.fish.forEach((f, i) => {
      const g = new Group();
      const color = FISH_COLORS[i % FISH_COLORS.length] as string;
      const body = new Mesh(capsule(0.32, 0.6), toyMaterial(color));
      body.rotation.z = Math.PI / 2;
      body.castShadow = true;
      const tail = new Mesh(new ConeGeometry(0.3, 0.45, 14), toyMaterial(color));
      tail.rotation.z = -Math.PI / 2;
      tail.position.x = -0.75;
      const eye = new Mesh(ball(0.08, 12), toyMaterial(PALETTE.ink));
      eye.position.set(0.45, 0.12, 0.25);
      const label = new NumberLabel(f.value, { size: 0.7, placeColors: true });
      label.position.set(0, 1.0, 0);
      // tall tap column: the fish body and the number badge above it both count
      const proxy = hitCylinder(0.85, 2.4, f.id);
      proxy.position.y = 0.5;
      // the number badge is NOT a child of the turning fish: it follows the fish but never rotates,
      // so "70" can never read "07" when the fish swims the other way
      g.add(body, tail, eye, proxy);
      root.add(g, label);
      proxies.push(proxy);
      fishViews.set(f.id, {
        group: g,
        label,
        body,
        spring: new Spring(0, 200, 11),
        proxy,
        pos: new Vector3(),
        prev: new Vector3(Number.NaN, 0, 0),
        wakeT: Math.random() * 0.1,
        jumpT: -1,
      });
    });
  };

  const fishPos = (state: FishingState, id: number, time: number, out: Vector3) => {
    const p = state.puzzle;
    const f = p?.fish.find((x) => x.id === id);
    if (!p || !f) return out.set(0, 0, 0);
    // fish share a ring per lane, evenly spaced, same speed and direction ⇒ they never overlap
    const ringIdx = f.lane % 2;
    const onRing = p.fish.filter((x) => x.lane % 2 === ringIdx);
    const k = onRing.findIndex((x) => x.id === id);
    const ring = ringIdx === 0 ? 2.0 : 3.7;
    const dir = ringIdx === 0 ? 1 : -1;
    const a =
      (k / Math.max(1, onRing.length)) * Math.PI * 2 +
      (ctx.reducedMotion ? 0 : time * 0.18 * dir) +
      ringIdx * 0.4;
    return out.set(Math.cos(a) * ring, 0.42 + Math.sin(time * 2 + f.phase) * 0.05, Math.sin(a) * ring * 0.78);
  };

  const scene: StageScene<FishingState, FishingAction> = {
    sync(state, prev, dt) {
      const vdt = hitStop.filter(dt) * (slowmo > 0 ? 0.3 : 1);
      wake.update(vdt);
      slowmo = Math.max(0, slowmo - dt);
      t += vdt;
      if (state.puzzle !== puzzleRef) {
        puzzleRef = state.puzzle;
        buildFish(state);
      }
      // one-shot effects on transitions
      if (prev && prev.phase !== 'reel' && state.phase === 'reel') {
        audio.play('reel');
        audio.play('correct.big', { delay: 0.2 });
        slowmo = 0.35; // signature: slow-motion jump
        hitStop.trigger(45);
        for (const id of state.reeled) {
          const v = fishViews.get(id);
          if (v) {
            v.jumpT = 0;
            world.particles.emit('droplet', v.group.position, 60);
            world.burst('drop', v.group.position, 12);
            for (let r = 0; r < 3; r++) wake.spawn(v.pos.x, pond.position.y + 0.02, v.pos.z, r * 1.1, 1);
          }
        }
        celebrate(
          world,
          { x: 0, y: 2, z: 0 },
          state.core.streak,
          !!state.core.asked?.question.tags.includes('SIX_SEVEN'),
        );
      }
      if (prev && prev.phase !== 'bounce' && state.phase === 'bounce') {
        audio.play('wrong.boing');
        shake.add(0.4 * ctx.shakeIntensity);
        for (const id of prev.picked.concat(state.picked)) {
          const v = fishViews.get(id);
          if (v) {
            v.spring.impulse(-6);
            world.particles.emit('droplet', v.group.position, 25);
          }
        }
      }
      if (prev && state.picked.length > prev.picked.length) {
        audio.play('ui.tap', { pitch: 1.2 });
        const id = state.picked[state.picked.length - 1] as number;
        fishViews.get(id)?.spring.impulse(5);
      }
      if (prev?.odd && !state.odd && state.oddCaught > prev.oddCaught) {
        audio.play('coin');
        audio.play('correct', { delay: 0.1 });
        world.particles.emit('sparkle', odd.position, 60);
        world.burst('coin', { x: odd.position.x, y: odd.position.y + 0.8, z: odd.position.z }, 8);
        for (let r = 0; r < 2; r++)
          wake.spawn(odd.position.x, pond.position.y + 0.05, odd.position.z, r * 1.4, 1);
      }
      // fish motion
      for (const [id, v] of fishViews) {
        const f = state.puzzle?.fish.find((x) => x.id === id);
        if (!f) continue;
        fishPos(state, id, t, v.pos);
        if (v.jumpT >= 0) {
          // parabola from the pond to the bucket
          v.jumpT = Math.min(1, v.jumpT + vdt / (REEL_TICKS / 60 - 0.2));
          const k = v.jumpT;
          const from = v.pos;
          const to = bucket.position;
          v.group.position.set(
            from.x + (to.x - from.x) * k,
            from.y + Math.sin(k * Math.PI) * 3 + (to.y - from.y) * k,
            from.z + (to.z - from.z) * k,
          );
          v.group.rotation.z = -k * Math.PI * 1.5;
          v.group.scale.setScalar(1 - k * 0.5);
          v.label.visible = k < 0.6;
        } else if (f.caught) {
          v.group.visible = false;
          v.label.visible = false;
        } else {
          v.group.position.copy(v.pos);
          // ride the visible waves (same Gerstner set and clock as the water shader)
          v.group.position.y += waveHeight(WAVES_POND, v.pos.x, v.pos.z, waterTime.value);
          const ahead = fishPos(state, id, t + 0.05, new Vector3());
          v.group.lookAt(ahead.x, v.group.position.y, ahead.z);
          v.group.rotateY(-Math.PI / 2);
          const s = 1 + v.spring.update(vdt) * 0.06;
          const picked = state.picked.includes(id);
          v.group.scale.setScalar((picked ? 1.2 : 1) * s);
          v.group.position.y += picked ? 0.35 : 0;
          v.group.visible = true;
          if (cursorId === id && !picked) v.group.position.y += 0.15 + Math.sin(t * 6) * 0.08;
          if (glowId === id && !picked) {
            v.group.scale.multiplyScalar(1 + Math.abs(Math.sin(t * 4)) * 0.25);
            if (Math.floor(t * 6) % 4 === 0) world.particles.emit('sparkle', v.group.position, 2);
          }
          // wake: foam ripples trail behind a swimming fish (stronger when it swims faster)
          if (!Number.isNaN(v.prev.x) && vdt > 0) {
            const dx = v.pos.x - v.prev.x;
            const dz = v.pos.z - v.prev.z;
            const speed = Math.hypot(dx, dz) / vdt;
            v.wakeT -= vdt;
            if (speed > 0.15 && v.wakeT <= 0 && !picked) {
              v.wakeT = 0.11;
              const len = Math.hypot(dx, dz) || 1;
              const bx = v.pos.x - (dx / len) * 0.55;
              const bz = v.pos.z - (dz / len) * 0.55;
              const wy = pond.position.y + waveHeight(WAVES_POND, bx, bz, waterTime.value) + 0.05;
              wake.spawn(bx, wy, bz, Math.atan2(-dz, dx), Math.min(1, 0.45 + speed * 0.35));
            }
          }
          v.prev.copy(v.pos);
        }
        // badge follows the fish upright (world space), scaled with it
        v.label.position.set(
          v.group.position.x,
          v.group.position.y + 1.0 * v.group.scale.y,
          v.group.position.z,
        );
        v.label.scale.setScalar(v.group.scale.y);
        if (!f.caught && v.jumpT < 0) v.label.visible = v.group.visible;
      }
      // fishing line to the picked fish
      const pickedId = state.phase === 'reel' ? state.reeled[0] : state.picked[0];
      const pv = pickedId !== undefined ? fishViews.get(pickedId) : undefined;
      if (pv) {
        pole.updateWorldMatrix(true, false);
        tip.set(0, 2.1, 0).applyMatrix4(pole.matrixWorld);
        const end = pv.group.position;
        const mid = tip.clone().add(end).multiplyScalar(0.5);
        line.position.copy(mid);
        line.scale.set(1, tip.distanceTo(end), 1);
        line.lookAt(end);
        line.rotateX(Math.PI / 2);
        line.visible = true;
      } else line.visible = false;
      // odd fish crossing
      if (state.odd) {
        odd.visible = true;
        const k = Math.min(1, (state.core.tick - state.odd.born) / state.odd.life);
        // a different, gently curving way across the pond every time (from the rules' seeded id/lane)
        const p = oddPath(state.odd.id, state.odd.lane, k);
        const y = pond.position.y + waveHeight(WAVES_POND, p.x, p.z, waterTime.value);
        odd.position.set(p.x, y, p.z);
        odd.rotation.set(0, p.heading + Math.sin(t * 2) * 0.12, Math.sin(t * 2.6) * 0.08);
        oddItems.update(state.odd.kind, t);
        oddWakeT -= vdt;
        if (oddWakeT <= 0) {
          oddWakeT = 0.13;
          wake.spawn(p.x, y + 0.05, p.z, p.heading, 0.7);
        }
        if (!ctx.reducedMotion && Math.floor(t * 5) % 3 === 0)
          world.particles.emit('sparkle', { x: p.x, y: y + 1.2, z: p.z }, 1);
      } else odd.visible = false;
      const sh = shake.update(dt);
      world.camera.position.x = sh.x;
      world.camera.position.y = 10 + sh.y;
      void BOUNCE_TICKS;
    },
    pointer(p: PointerInfo, state, emit) {
      if (p.type !== 'down') return;
      const objs = [...proxies, ...(state.odd ? [oddProxy] : [])];
      const id = hitId(objs, p.raycaster);
      if (id === null) return;
      if (id === ODD_ID) emit({ t: 'odd' });
      else emit({ t: 'tap', id });
    },
    screenPos(_state, id) {
      const v = fishViews.get(id);
      if (!v) return null;
      const p = v.group.position
        .clone()
        .setY(v.group.position.y + 0.4)
        .project(world.camera);
      return { x: p.x, y: p.y };
    },
    setCursor(id) {
      cursorId = id;
    },
    setGlow(id) {
      glowId = id;
    },
    dispose() {
      for (const v of fishViews.values()) disposeTree(v.group);
      disposeTree(root);
      world.camera.position.set(0, 10, 11.5);
    },
  };
  return scene;
}
