/**
 * ⑧ 정답 달리기 레이스 diorama: a roller-coaster road in the sky, seen from a chase camera behind the
 * child's kart. The kart stays near the origin (so the sun's shadow box fits) and the world streams past:
 * striped planks over rolling hills, rails, numbered balloon arches every square, star coins, trees and
 * clouds, and the checkered finish gate.
 *
 * - right answer → BOOST: the kart surges a square (two on a TURBO), front wheels up, exhaust sparks, speed
 *   lines, the field of view kicks wide; a turbo also flies through a rainbow ring.
 * - wrong answer → a banana peel pops up and the kart spins for a second (stars above the driver), then the
 *   same question again. Rivals slip the same silly way on their bad turns.
 * - the two rivals drive in the side lanes at their real distance ahead / behind.
 * Everything here is decoration over the pure rules (P5); reduced motion keeps positions, drops the kicks.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  OctahedronGeometry,
  Vector3,
} from 'three/webgpu';
import { HitStop, Shake, Spring } from '../../engine/fx/juice';
import { ball, capsule, disc, ring, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { grassMaterial, metalMaterial, toyMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import { createFriend } from '../../scenes/island/friend';
import { disposeTree } from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import {
  BOOST_TICKS,
  CROSS_ID,
  FINISH_TICKS,
  placeOf,
  type RaceAction,
  type RaceState,
  RIVALS,
  SLIP_TICKS,
  STAR_SQUARES,
  START_TICKS,
} from './rules';

/** World units per track square. */
const SEG = 9;
const STEP = 1.2;
const PLANKS = 64;
const LANE = 2.9;
const BASE_Y = 0.5;
const FOV = 50;
const CAM = new Vector3(0, 4.6, 8.4);

const hill = (d: number) => Math.sin(d * 0.105) * 1.15 + Math.sin(d * 0.043 + 1.3) * 0.9;
const slope = (d: number) => (hill(d + 0.3) - hill(d - 0.3)) / 0.6;
const hash = (k: number) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const ease = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

interface Kart {
  group: Group;
  body: Group;
  wheels: Mesh[];
  spin: number;
  vis: number;
  bounce: Spring;
}

function kartModel(color: string, driver: Object3D): Kart {
  const group = new Group();
  const body = new Group();
  const shell = new Mesh(roundedBox(1.5, 0.5, 2.3, 0.22), toyMaterial(color, { rimStrength: 0.3 }));
  shell.position.y = 0.55;
  shell.castShadow = true;
  const nose = new Mesh(roundedBox(1.1, 0.34, 0.8, 0.16), toyMaterial(color, { rimStrength: 0.3 }));
  nose.position.set(0, 0.5, -1.3);
  const bumper = new Mesh(roundedBox(1.7, 0.2, 0.3, 0.1), toyMaterial(PALETTE.white, { finish: 'satin' }));
  bumper.position.set(0, 0.4, -1.75);
  const spoiler = new Mesh(roundedBox(1.6, 0.12, 0.4, 0.05), toyMaterial(PALETTE.ink, { finish: 'satin' }));
  spoiler.position.set(0, 1.15, 1.1);
  const pipe = new Mesh(new CylinderGeometry(0.13, 0.16, 0.5, 12), metalMaterial('#cfd6e4'));
  pipe.rotation.x = Math.PI / 2;
  pipe.position.set(0.45, 0.55, 1.35);
  const pipe2 = pipe.clone();
  pipe2.position.x = -0.45;
  driver.position.set(0, 0.75, 0.15);
  body.add(shell, nose, bumper, spoiler, pipe, pipe2, driver);
  const wheels: Mesh[] = [];
  const tyre = toyMaterial('#2b2f3a', { finish: 'matte' });
  const hub = toyMaterial(PALETTE.sun);
  for (const [x, z] of [
    [-0.9, -0.95],
    [0.9, -0.95],
    [-0.9, 0.85],
    [0.9, 0.85],
  ] as const) {
    const w = new Mesh(disc(0.42, 0.34, 20), tyre);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    w.castShadow = true;
    const cap = new Mesh(disc(0.2, 0.36, 12), hub);
    w.add(cap);
    wheels.push(w);
    group.add(w);
  }
  group.add(body);
  return { group, body, wheels, spin: 0, vis: 0, bounce: new Spring(0, 200, 10) };
}

/** A rival driver: a round toy monster (not jelly: cheap), told apart by colour and hat. */
function rivalDriver(i: number): Group {
  const g = new Group();
  const tint = i === 0 ? '#ff8fc8' : '#8fd3ff';
  const head = new Mesh(ball(0.5, 24), toyMaterial(tint, { rimStrength: 0.4 }));
  head.position.y = 0.45;
  head.castShadow = true;
  g.add(head);
  for (const x of [-0.18, 0.18]) {
    // eyes look back at the camera (the karts drive away from it)
    const w = new Mesh(ball(0.13, 12), toyMaterial(PALETTE.white));
    w.position.set(x, 0.55, 0.42);
    const p = new Mesh(ball(0.07, 8), toyMaterial(PALETTE.ink));
    p.position.set(x, 0.55, 0.52);
    g.add(w, p);
  }
  if (i === 0) {
    const fin = new Mesh(new ConeGeometry(0.2, 0.5, 12), toyMaterial(PALETTE.berry));
    fin.position.y = 1.1;
    g.add(fin);
  } else {
    for (const x of [-0.3, 0, 0.3]) {
      const puff = new Mesh(ball(0.24, 12), toyMaterial(PALETTE.white, { finish: 'satin' }));
      puff.position.set(x, 0.98 + (x === 0 ? 0.1 : 0), 0);
      g.add(puff);
    }
  }
  return g;
}

export function createRaceScene(world: RenderWorld, ctx: StageCtx): StageScene<RaceState, RaceAction> {
  const root = new Group();
  root.name = 'stage-race';
  world.scene.add(root);
  world.camera.fov = FOV;
  world.camera.updateProjectionMatrix();
  world.camera.position.copy(CAM);
  world.camera.lookAt(0, -0.6, -5);
  world.setGround(-40, 1); // no table here: decorative bodies just fall away
  const reduced = ctx.reducedMotion;

  // far ground under the sky road
  const land = new Mesh(disc(90, 0.4, 48), grassMaterial('#8fd17a'));
  land.position.y = -7;
  land.receiveShadow = true;
  root.add(land);

  // road planks (two colours alternate → the stripes make speed readable), rails, trees, clouds
  const plankGeo = roundedBox(LANE * 3 + 0.6, 0.22, STEP * 0.96, 0.06);
  const planksA = new InstancedMesh(plankGeo, toyMaterial('#5b6178', { finish: 'satin' }), PLANKS / 2);
  const planksB = new InstancedMesh(plankGeo, toyMaterial('#6f7691', { finish: 'satin' }), PLANKS / 2);
  planksA.receiveShadow = planksB.receiveShadow = true;
  const kerbGeo = roundedBox(0.34, 0.3, STEP * 0.96, 0.08);
  const kerbA = new InstancedMesh(kerbGeo, toyMaterial(PALETTE.berry, { finish: 'satin' }), PLANKS);
  const kerbB = new InstancedMesh(kerbGeo, toyMaterial(PALETTE.white, { finish: 'satin' }), PLANKS);
  const dashes = new InstancedMesh(
    roundedBox(0.12, 0.04, STEP * 0.5, 0.02),
    toyMaterial(PALETTE.white, { finish: 'satin' }),
    PLANKS,
  );
  const TREES = 20;
  const trees = new InstancedMesh(
    new ConeGeometry(0.9, 2.6, 10),
    toyMaterial('#3fae6a', { finish: 'matte' }),
    TREES,
  );
  const CLOUDS = 10;
  const clouds = new InstancedMesh(
    ball(1.4, 12),
    toyMaterial(PALETTE.white, { finish: 'matte' }),
    CLOUDS * 2,
  );
  const LINES = 22;
  const lines = new InstancedMesh(
    roundedBox(0.05, 0.05, 3.2, 0.02),
    toyMaterial(PALETTE.white, { rimStrength: 1 }),
    LINES,
  );
  lines.frustumCulled = false;
  for (const m of [planksA, planksB, kerbA, kerbB, dashes, trees, clouds]) m.frustumCulled = false;
  root.add(planksA, planksB, kerbA, kerbB, dashes, trees, clouds, lines);

  // square arches (a pool of three, re-used for the next squares) + the finish gate
  const ARCH_COLORS = [PALETTE.sun, PALETTE.berry, '#2fb4cc'];
  const arches = ARCH_COLORS.map((c) => {
    const g = new Group();
    for (const x of [-LANE * 1.5 - 0.6, LANE * 1.5 + 0.6]) {
      const post = new Mesh(capsule(0.14, 3.4), toyMaterial(PALETTE.white, { finish: 'satin' }));
      post.position.set(x, 1.9, 0);
      const balloon = new Mesh(ball(0.5, 16), toyMaterial(c, { rimStrength: 0.5 }));
      balloon.position.set(x, 4.3, 0);
      g.add(post, balloon);
    }
    const beam = new Mesh(roundedBox(LANE * 3 + 1.4, 0.4, 0.3, 0.14), toyMaterial(c));
    beam.position.y = 3.8;
    const label = new NumberLabel(1, { size: 0.7, placeColors: true });
    label.position.set(0, 3.8, 0.3);
    g.add(beam, label);
    root.add(g);
    return { g, label };
  });
  const gate = new Group();
  for (const x of [-LANE * 1.5 - 0.6, LANE * 1.5 + 0.6]) {
    const post = new Mesh(capsule(0.2, 4.2), toyMaterial(PALETTE.ink, { finish: 'satin' }));
    post.position.set(x, 2.3, 0);
    gate.add(post);
  }
  const CHECK = 14;
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < CHECK; i++) {
      const sq = new Mesh(
        roundedBox(0.58, 0.5, 0.2, 0.03),
        toyMaterial((i + r) % 2 ? PALETTE.ink : PALETTE.white, { finish: 'satin' }),
      );
      sq.position.set((i - (CHECK - 1) / 2) * 0.58, 4.2 + r * 0.5, 0);
      gate.add(sq);
    }
  root.add(gate);
  const stars = STAR_SQUARES.map((sq) => {
    const m = new Mesh(new OctahedronGeometry(0.55), metalMaterial('#f2b632', 0.2));
    m.scale.set(1, 1, 0.45);
    root.add(m);
    return { sq, m };
  });

  // start lights: three bulbs on a little gantry over the start line
  const gantry = new Group();
  const bar = new Mesh(roundedBox(3.2, 0.9, 0.4, 0.2), toyMaterial(PALETTE.ink, { finish: 'satin' }));
  bar.position.y = 4.4;
  gantry.add(bar);
  const red = toyMaterial('#ff4b4b', { rimStrength: 1 });
  const green = toyMaterial('#4be07a', { rimStrength: 1 });
  const dark = toyMaterial('#4a4f63', { finish: 'matte' });
  const bulbs = [-0.95, 0, 0.95].map((x) => {
    const b = new Mesh(ball(0.3, 16), dark);
    b.position.set(x, 4.4, 0.25);
    gantry.add(b);
    return b;
  });
  root.add(gantry);

  // karts: the child (friend monster driving) in the middle lane, rivals left and right
  const friend = createFriend();
  friend.group.scale.setScalar(0.72);
  friend.group.rotation.y = Math.PI; // facing down the road
  const me = kartModel('#ff5d5d', friend.group);
  const rivals = Array.from({ length: RIVALS }, (_, i) =>
    kartModel(i === 0 ? '#b48cff' : '#ffd23f', rivalDriver(i)),
  );
  root.add(me.group);
  rivals.forEach((r, i) => {
    r.group.position.x = (i === 0 ? -1 : 1) * LANE;
    root.add(r.group);
  });
  // banana peel + turbo ring + place number over the kart at the finish
  const banana = new Group();
  for (let i = 0; i < 3; i++) {
    const leaf = new Mesh(capsule(0.1, 0.55), toyMaterial('#ffe14d'));
    leaf.rotation.set(0.9, (i / 3) * Math.PI * 2, 0, 'YXZ');
    leaf.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.25, 0.15, Math.cos((i / 3) * Math.PI * 2) * 0.25);
    banana.add(leaf);
  }
  banana.visible = false;
  const turboRing = new Mesh(ring(2.2, 0.16), toyMaterial('#ff9bd6', { rimStrength: 1 }));
  turboRing.visible = false;
  const placeLabel = new NumberLabel(1, { size: 1.1, tint: '#f2b632' });
  placeLabel.visible = false;
  root.add(banana, turboRing, placeLabel);

  const dummy = new Object3D();
  const tmp = new Vector3();
  const hitStop = new HitStop();
  const shake = new Shake(!reduced && ctx.shakeIntensity > 0);
  let t = 0;
  let speed = 0; // smoothed, world units / s
  let fov = FOV;
  let slipT = -1;
  let ringT = -1;
  let started = false;
  const rivalSlip = rivals.map(() => -1);

  /** Place an object that sits on the road at distance d (lane x), relative to the child's kart. */
  const onRoad = (o: Object3D, d: number, x: number, yOff = 0) => {
    o.position.set(x, BASE_Y + hill(d) - hill(me.vis) + yOff, -(d - me.vis));
    o.rotation.x = Math.atan(slope(d));
  };

  return {
    sync(state, prev, dt) {
      const vdt = hitStop.filter(dt);
      t += vdt;
      const length = state.core.puzzles;
      if (!started) {
        started = true;
        if (state.phase === 'start') audio.play('race.go', { delay: 0.2 });
      }
      // ── one-shot reactions
      if (prev && prev.phase !== 'boost' && state.phase === 'boost') {
        const turbo = state.gain > 1;
        audio.play(turbo ? 'race.turbo' : 'race.boost');
        me.bounce.impulse(turbo ? 9 : 6);
        shake.add((turbo ? 0.3 : 0.18) * ctx.shakeIntensity);
        friend.cheer(true);
        if (turbo) {
          ringT = 0;
          world.particles.emit('confetti', tmp.set(0, 2, -2), 60);
        }
      }
      if (prev && prev.phase !== 'slip' && state.phase === 'slip') {
        audio.play('race.slip');
        audio.play('wrong.boing', { delay: 0.1 });
        slipT = 0;
        friend.cheer(false);
        world.particles.emit('dust', tmp.set(0, 0.8, 0.5), 20);
      }
      // rivals drive by themselves: a seeded boost (exhaust sparks) or a banana spin now and then
      state.rivalFx.forEach((fx, i) => {
        const r = rivals[i];
        if (!r || !prev || prev.rivalFx[i]?.kind === fx.kind) return;
        if (fx.kind === 'slip') rivalSlip[i] = 0;
        else if (fx.kind === 'boost') {
          r.bounce.impulse(6);
          world.particles.emit(
            'sparkle',
            tmp
              .copy(r.group.position)
              .setY(1)
              .setZ(r.group.position.z + 1.5),
            14,
          );
        }
      });
      // overtaking (either way) whooshes
      if (prev && state.phase !== 'finish' && prev.phase !== 'start') {
        const was = placeOf(prev.me, prev.rivals);
        const now = placeOf(state.me, state.rivals);
        if (now !== was) {
          audio.play('whoosh', { pitch: now < was ? 1.3 : 0.8 });
          if (now < was) audio.play('star', { delay: 0.05 });
        }
      }
      if (prev && state.stars.length > prev.stars.length) {
        audio.play('coin');
        audio.play('star', { delay: 0.1 });
        world.particles.emit('sparkle', tmp.set(0, 2, -1), 40);
      }
      if (prev && prev.phase !== 'finish' && state.phase === 'finish') {
        audio.play('correct.big');
        audio.play('levelup', { delay: 0.35 });
        hitStop.trigger(80);
        celebrate(world, { x: 0, y: 2.5, z: -2 }, 4, false);
        placeLabel.set(state.place ?? 1);
        placeLabel.visible = true;
      }

      // ── positions: each kart eases toward its square (the finish rolls a bit past the line)
      const past = state.phase === 'finish' ? (1 - state.phaseLeft / FINISH_TICKS) * 9 : 0;
      const target = state.me * SEG + past;
      const before = me.vis;
      // the rules already move every kart smoothly each tick: only a light smoothing here
      me.vis += (target - me.vis) * (1 - Math.exp(-vdt * 10));
      const v = vdt > 0 ? (me.vis - before) / vdt : 0;
      speed += (v - speed) * (1 - Math.exp(-vdt * 8));
      const fast = Math.min(1, Math.max(0, speed / 16));
      rivals.forEach((r, i) => {
        r.vis += ((state.rivals[i] ?? 0) * SEG - r.vis) * (1 - Math.exp(-vdt * 10));
      });

      // ── road pieces stream past
      const k0 = Math.floor(me.vis / STEP) - 7;
      for (let i = 0; i < PLANKS; i++) {
        const k = k0 + i;
        const d = k * STEP;
        onRoad(dummy, d, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        ((k & 1) === 0 ? planksA : planksB).setMatrixAt(i >> 1, dummy.matrix);
        // kerbs: alternating red / white on both sides (one side per mesh, colours swap every plank)
        onRoad(dummy, d, -LANE * 1.5 - 0.45, 0.05);
        dummy.updateMatrix();
        ((k & 1) === 0 ? kerbA : kerbB).setMatrixAt(i, dummy.matrix);
        onRoad(dummy, d, LANE * 1.5 + 0.45, 0.05);
        dummy.updateMatrix();
        ((k & 1) === 0 ? kerbB : kerbA).setMatrixAt(i, dummy.matrix);
        // lane dashes on every other plank, one lane line per plank (left / right alternate)
        onRoad(dummy, d, ((k & 2) === 0 ? -1 : 1) * LANE * 0.5, 0.13);
        dummy.scale.setScalar((k & 1) === 0 ? 1 : 0.001);
        dummy.updateMatrix();
        dashes.setMatrixAt(i, dummy.matrix);
      }
      for (const m of [planksA, planksB, kerbA, kerbB, dashes]) m.instanceMatrix.needsUpdate = true;
      const TREE_GAP = 6;
      const tk0 = Math.floor(me.vis / TREE_GAP) - 1;
      for (let i = 0; i < TREES; i++) {
        const k = tk0 + (i >> 1);
        const side = i & 1 ? 1 : -1;
        const d = k * TREE_GAP + hash(k * 2 + (i & 1)) * 3;
        dummy.position.set(
          side * (LANE * 1.5 + 3 + hash(k + 50 * (i & 1)) * 5),
          BASE_Y + hill(d) - hill(me.vis) - 1.2 + hash(k * 7) * 0.6,
          -(d - me.vis),
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.8 + hash(k * 3 + i) * 0.7);
        dummy.updateMatrix();
        trees.setMatrixAt(i, dummy.matrix);
      }
      trees.instanceMatrix.needsUpdate = true;
      const CLOUD_GAP = 14;
      const ck0 = Math.floor(me.vis / CLOUD_GAP);
      for (let i = 0; i < CLOUDS; i++) {
        const k = ck0 + (i >> 1);
        const side = i & 1 ? 1 : -1;
        const d = k * CLOUD_GAP + hash(k * 5 + i) * 8;
        for (let j = 0; j < 2; j++) {
          dummy.position.set(
            side * (9 + hash(k * 11 + i) * 9) + j * 1.5,
            3 + hash(k * 13 + i) * 5 - j * 0.3 - hill(me.vis) * 0.3,
            -(d - me.vis) - 6,
          );
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1.2 - j * 0.35, 0.7 - j * 0.15, 1);
          dummy.updateMatrix();
          clouds.setMatrixAt(i * 2 + j, dummy.matrix);
        }
      }
      clouds.instanceMatrix.needsUpdate = true;

      // arches for the next three squares; the last square wears the finish gate instead
      const next = Math.max(1, Math.floor(me.vis / SEG - 0.4) + 1);
      for (const a of arches) a.g.visible = false;
      for (let n = next; n < next + arches.length; n++) {
        // each square keeps its own arch (slot by n), so colours never jump as the pool is re-used
        const slot = arches[n % arches.length];
        if (!slot || n >= length) continue;
        slot.g.visible = true;
        slot.label.set(n);
        onRoad(slot.g, n * SEG, 0);
        slot.g.rotation.x = 0;
      }
      onRoad(gate, length * SEG, 0);
      gate.rotation.x = 0;
      onRoad(gantry, 7, 0);
      gantry.rotation.x = 0;
      // the start lights sit ahead of the line and are gone as soon as the karts roll under them
      gantry.visible = state.phase === 'start' || me.vis < 3.5;
      const lit = state.phase === 'start' ? Math.floor((1 - state.phaseLeft / START_TICKS) * 3.6) : 4;
      bulbs.forEach((b, i) => {
        b.material = lit >= 3 ? green : i <= lit ? red : dark;
      });
      for (const s of stars) {
        s.m.visible = !state.stars.includes(s.sq);
        onRoad(s.m, s.sq * SEG, 0, 1.6 + (reduced ? 0 : Math.sin(t * 3) * 0.2));
        s.m.rotation.set(0, t * 2.5, 0);
      }

      // ── my kart: pitch with the hill, wheelie on boost, spin on a banana
      const boostK = state.phase === 'boost' ? 1 - state.phaseLeft / BOOST_TICKS : 1;
      const wheelie = reduced
        ? 0
        : Math.sin(Math.min(1, boostK * 1.4) * Math.PI) * (state.gain > 1 ? 0.3 : 0.2);
      const mb = me.bounce.update(vdt);
      me.group.position.set(0, BASE_Y + 0.12, 0);
      me.group.rotation.set(Math.atan(slope(me.vis)), 0, 0);
      me.body.rotation.x = wheelie + (reduced ? 0 : Math.sin(t * 30) * 0.004 * (1 + fast * 3));
      me.body.position.y = mb * 0.04 + (state.phase === 'start' && !reduced ? Math.sin(t * 40) * 0.015 : 0);
      if (slipT >= 0) {
        slipT += vdt;
        const k = Math.min(1, slipT / (SLIP_TICKS / 60));
        me.group.rotation.y = reduced ? 0 : ease(k) * Math.PI * 4;
        banana.visible = k < 1;
        banana.position.set(0.9 + k * 1.5, BASE_Y + 0.2 + Math.sin(k * Math.PI) * 1.6, 0.6 - k);
        banana.rotation.set(k * 9, k * 7, 0);
        if (!reduced && Math.floor(t * 10) % 2 === 0) world.particles.emit('sparkle', tmp.set(0, 2.4, 0), 2);
        if (k >= 1) slipT = -1;
      }
      for (const w of me.wheels) w.rotation.x += vdt * (2 + speed * 2.2);
      friend.update(vdt, t, reduced);
      if (fast > 0.25 && !reduced)
        world.particles.emit('sparkle', tmp.set((Math.random() - 0.5) * 0.9, 0.9, 1.6), 3);
      // nearly out of booster fuel: the exhaust coughs little smoke puffs
      if (state.phase === 'play' && state.fuel < 0.25 && !reduced && Math.floor(t * 5) % 2 === 0)
        world.particles.emit('dust', tmp.set(0.45, 0.9, 1.7), 1);

      // ── rivals at their real distance
      rivals.forEach((r, i) => {
        const x = (i === 0 ? -1 : 1) * LANE;
        onRoad(r.group, r.vis, x, 0.12);
        const rb = r.bounce.update(vdt);
        r.body.position.y = rb * 0.04;
        r.body.rotation.x = reduced ? 0 : -Math.max(0, rb) * 0.02;
        let spin = 0;
        const st = rivalSlip[i] ?? -1;
        if (st >= 0) {
          const k = Math.min(1, st + vdt / 0.9);
          rivalSlip[i] = k >= 1 ? -1 : k;
          spin = reduced ? 0 : ease(k) * Math.PI * 2;
          if (st === 0) world.particles.emit('dust', tmp.copy(r.group.position).setY(1), 10);
        }
        r.group.rotation.y = spin;
        const home = (state.rivals[i] ?? 0) >= length;
        for (const w of r.wheels)
          w.rotation.x += vdt * (home ? 0 : state.rivalFx[i]?.kind === 'boost' ? 14 : 6);
        r.group.visible = r.group.position.z < 9 && r.group.position.z > -75;
      });

      // ── turbo ring flies past, speed lines, finish place number
      if (ringT >= 0) {
        ringT += vdt;
        const k = Math.min(1, ringT / 0.6);
        turboRing.visible = k < 1;
        turboRing.position.set(0, BASE_Y + 1.4, -14 + k * 24);
        turboRing.rotation.z = t * 4;
        if (k >= 1) ringT = -1;
      }
      for (let i = 0; i < LINES; i++) {
        const a = hash(i * 3.1) * Math.PI * 2;
        const rad = 3.2 + hash(i * 1.7) * 3.5;
        const z = -30 + ((hash(i) * 40 + t * (30 + fast * 60)) % 40);
        dummy.position.set(Math.cos(a) * rad, 1.6 + Math.sin(a) * rad * 0.7, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, reduced ? 0.001 : Math.max(0.001, (fast - 0.2) * 1.6));
        dummy.updateMatrix();
        lines.setMatrixAt(i, dummy.matrix);
      }
      lines.instanceMatrix.needsUpdate = true;
      if (placeLabel.visible)
        placeLabel.position.set(0, BASE_Y + 2.1 + (reduced ? 0 : Math.sin(t * 4) * 0.15), 0);

      // ── chase camera: FOV kicks with speed; at the finish it swings round to see the driver
      const wantFov = FOV + (reduced ? 0 : fast * 14);
      fov += (wantFov - fov) * (1 - Math.exp(-vdt * 6));
      if (Math.abs(world.camera.fov - fov) > 0.05) {
        world.camera.fov = fov;
        world.camera.updateProjectionMatrix();
      }
      const sh = shake.update(dt);
      const fin = state.phase === 'finish' && !reduced ? ease((1 - state.phaseLeft / FINISH_TICKS) * 1.3) : 0;
      const orbit = fin * 2.5;
      const pull = reduced ? 0 : fast * 0.9;
      world.camera.position.set(
        Math.sin(orbit) * (CAM.z + pull) + sh.x,
        CAM.y - fin * 2.2 + sh.y - (reduced ? 0 : Math.atan(slope(me.vis)) * 1.2),
        Math.cos(orbit) * (CAM.z + pull),
      );
      world.camera.lookAt(0, -0.6 + fin * 2.2, -5 * Math.cos(orbit));
    },
    pointer() {
      // answers are the HUD's cross (touch / mouse) or the arrow keys / pad
    },
    screenPos(_s, id) {
      // the answers are HUD keys: the tutorial hand points at the key in that slot of the cross
      const el = document.querySelectorAll('.hud-cross button')[id - CROSS_ID];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: ((r.left + r.width / 2) / window.innerWidth) * 2 - 1,
        y: 1 - ((r.top + r.height / 2) / window.innerHeight) * 2,
      };
    },
    setCursor() {},
    setGlow() {},
    dispose() {
      // the next stage sets its own camera; put the field of view back for safety
      world.camera.fov = FOV;
      world.camera.updateProjectionMatrix();
      disposeTree(root);
    },
  };
}
