/**
 * ② 좀비 숫자 막기 diorama: a toy yard at dusk-pink — the house on the left (the monster friend watches from
 * the window), three paths from the garden gate on the right, a picket fence at the back where the popped
 * zombies gather for a garden party, and the child's four cards in front.
 *
 * - "비틀이" zombies are soft, sleepy toys (droopy eyes, arms out, a wobbling toddle) holding a number balloon.
 * - a played card flies to the balloon: the number changes with a bounce and the sum floats up (13 − 5 = 8).
 * - exactly 0: the balloon pops into confetti, the zombie twirls and hops over to the party at the fence.
 * - a refused card (below 0) wiggles in the hand and the zombie giggles; nothing is used up.
 * - at the door: "쿵" — the house shakes, the zombie jumps in fright and hops back. No game over (P2).
 */
import { ConeGeometry, CylinderGeometry, Group, InstancedMesh, Mesh, Object3D, Vector3 } from 'three/webgpu';
import { HitStop, Shake, Spring } from '../../engine/fx/juice';
import { ball, capsule, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { toyMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { createFriend } from '../../scenes/island/friend';
import { baseDiorama, disposeTree, hitCylinder, hitId, stageCamera } from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import {
  HAND,
  HIT_TICKS,
  KNOCK_TICKS,
  POP_TICKS,
  WAVE_TICKS,
  type Zombie,
  type ZombieAction,
  type ZombieState,
} from './rules';

const LANE_Z = [-1.7, 0, 1.7];
const CAM = { z: 11.4, y: 7.4, lookY: 1.5 };
const TINTS = ['#a8e0a0', '#b6d6f2', '#f2c6de', '#f6e3a1', '#cdb8f0'];
const BALLOONS = [PALETTE.berry, '#2fb4cc', PALETTE.sun];
const MINUS = '#cfe8ff';
const PLUS = '#ffd9e6';

const ease = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};
const cardText = (d: number) => `${d < 0 ? '-' : '+'}${Math.abs(d)}`;

interface ZView {
  group: Group;
  body: Mesh;
  arms: Group[];
  balloon: Group;
  label: NumberLabel;
  spring: Spring;
}

/** A soft, sleepy toy zombie (never scary): round body, droopy eyes, a patch, arms out in front. */
function zombieModel(z: Zombie): ZView {
  const group = new Group();
  const tint = TINTS[z.id % TINTS.length] as string;
  const skin = toyMaterial(tint, { finish: 'satin' });
  const body = new Mesh(capsule(0.5, 0.45), skin);
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);
  const white = toyMaterial(PALETTE.white);
  const ink = toyMaterial(PALETTE.ink);
  [-0.2, 0.2].forEach((x, i) => {
    const w = new Mesh(ball(i ? 0.17 : 0.13, 14), white);
    w.position.set(x, 1.12, 0.42);
    const p = new Mesh(ball(0.07, 10), ink);
    p.position.set(x, 1.08, 0.55);
    // a sleepy eyelid over the top half
    const lid = new Mesh(ball(i ? 0.18 : 0.14, 12), skin);
    lid.position.set(x, 1.2, 0.4);
    lid.scale.set(1, 0.6, 1);
    group.add(w, p, lid);
  });
  const mouth = new Mesh(capsule(0.03, 0.16), ink);
  mouth.rotation.z = Math.PI / 2 + 0.2;
  mouth.position.set(0, 0.88, 0.5);
  const patch = new Mesh(roundedBox(0.22, 0.2, 0.05, 0.03), toyMaterial('#f2b077', { finish: 'matte' }));
  patch.position.set(0.25, 0.62, 0.45);
  patch.rotation.z = 0.3;
  const tuft = new Mesh(new ConeGeometry(0.12, 0.3, 8), toyMaterial('#6b5b95', { finish: 'matte' }));
  tuft.position.set(-0.08, 1.62, 0);
  tuft.rotation.z = 0.3;
  group.add(mouth, patch, tuft);
  const arms: Group[] = [];
  for (const x of [-0.42, 0.42]) {
    const arm = new Group();
    arm.position.set(x, 0.95, 0.15);
    const limb = new Mesh(capsule(0.1, 0.4), skin);
    limb.rotation.x = Math.PI / 2;
    limb.position.z = 0.3;
    arm.add(limb);
    arms.push(arm);
    group.add(arm);
    const foot = new Mesh(ball(0.17, 10), toyMaterial('#6b5b95', { finish: 'matte' }));
    foot.position.set(x * 0.6, 0.1, 0.1);
    foot.scale.set(1, 0.5, 1.3);
    group.add(foot);
  }
  if (z.boss) {
    const crown = new Mesh(
      new CylinderGeometry(0.3, 0.24, 0.26, 5, 1, true),
      toyMaterial(PALETTE.sun, { rimStrength: 0.6 }),
    );
    crown.position.y = 1.72;
    group.add(crown);
    tuft.visible = false;
  }
  // number balloon on a string
  const balloon = new Group();
  const skinB = toyMaterial(BALLOONS[z.lane % BALLOONS.length] as string, { rimStrength: 0.5 });
  const orb = new Mesh(ball(0.62, 24), skinB);
  orb.scale.set(1, 1.12, 1);
  orb.castShadow = true;
  const knot = new Mesh(new ConeGeometry(0.1, 0.14, 8), skinB);
  knot.position.y = -0.72;
  const string = new Mesh(new CylinderGeometry(0.015, 0.015, 0.9, 6), white);
  string.position.y = -1.2;
  const label = new NumberLabel(z.start, { size: 0.62, placeColors: true });
  label.position.set(0, 0, 0.75);
  balloon.add(orb, knot, string, label);
  balloon.position.set(0.2, 3.1, 0);
  group.add(balloon);
  group.scale.setScalar(z.boss ? 1.35 : 1);
  return { group, body, arms, balloon, label, spring: new Spring(0, 190, 9) };
}

export function createZombieScene(world: RenderWorld, ctx: StageCtx): StageScene<ZombieState, ZombieAction> {
  const root = new Group();
  root.name = 'stage-zombie';
  world.scene.add(root);
  stageCamera(world, CAM.z, CAM.y, 42, CAM.lookY);
  // Two layouts. Wide screens: a long yard, four cards in a row right of the speech bubble. Portrait (phone):
  // a short yard and the cards two by two, so everything fits the narrow view.
  const narrow = world.camera.aspect < 1;
  const L = narrow
    ? {
        gate: 3.3,
        door: -1.4,
        house: -4.0,
        camX: 0.9,
        hand: [
          [-0.05, 2.15, 5.0],
          [1.85, 2.15, 5.0],
          [-0.05, 0.85, 6.3],
          [1.85, 0.85, 6.3],
        ],
        spot0: -1.3,
        spotGap: 0.55,
      }
    : {
        gate: 5.4,
        door: -2.7,
        house: -5.0,
        camX: 1.1,
        hand: [
          [-0.3, 1.15, 4.3],
          [1.45, 1.15, 4.3],
          [3.2, 1.15, 4.3],
          [4.95, 1.15, 4.3],
        ],
        spot0: -1.9,
        spotGap: 0.95,
      };
  const GATE_X = L.gate;
  const DOOR_X = L.door;
  const handAt = (i: number) => (L.hand[i] ?? L.hand[0]) as [number, number, number];
  root.add(baseDiorama('#bfe6b0', 7.6));
  const reduced = ctx.reducedMotion;

  // yard: lawn, three paths, back fence, garden gate
  const lawn = new Mesh(roundedBox(13.4, 0.3, 8.6, 0.14), toyMaterial('#a9dc98', { finish: 'matte' }));
  lawn.position.set(0.6, 0.15, 0.2);
  lawn.receiveShadow = true;
  root.add(lawn);
  for (const z of LANE_Z) {
    const path = new Mesh(roundedBox(9.2, 0.06, 1.1, 0.03), toyMaterial('#f1e2c4', { finish: 'matte' }));
    path.position.set(1.7, 0.32, z);
    path.receiveShadow = true;
    root.add(path);
  }
  const PICKETS = 26;
  const pickets = new InstancedMesh(
    roundedBox(0.3, 1.1, 0.12, 0.05),
    toyMaterial(PALETTE.white, { finish: 'satin' }),
    PICKETS,
  );
  const dummy = new Object3D();
  for (let i = 0; i < PICKETS; i++) {
    dummy.position.set(-5.6 + i * 0.5, 0.85, -3.8);
    dummy.updateMatrix();
    pickets.setMatrixAt(i, dummy.matrix);
  }
  pickets.castShadow = true;
  const rail = new Mesh(roundedBox(13, 0.12, 0.1, 0.04), toyMaterial(PALETTE.white, { finish: 'satin' }));
  rail.position.set(0.7, 0.95, -3.86);
  root.add(pickets, rail);
  const gate = new Group();
  for (const z of [-2.9, 2.9]) {
    const post = new Mesh(capsule(0.18, 2.6), woodMaterial('#8a5a3c'));
    post.position.set(GATE_X + 0.9, 1.6, z);
    post.castShadow = true;
    gate.add(post);
  }
  const arch = new Mesh(roundedBox(0.4, 0.4, 6.3, 0.15), woodMaterial('#8a5a3c'));
  arch.position.set(GATE_X + 0.9, 3.1, 0);
  gate.add(arch);
  for (let i = 0; i < 5; i++) {
    const lantern = new Mesh(
      ball(0.2, 12),
      toyMaterial(i % 2 ? PALETTE.sun : PALETTE.berry, { rimStrength: 1 }),
    );
    lantern.position.set(GATE_X + 0.9, 2.75, -2 + i);
    gate.add(lantern);
  }
  root.add(gate);

  // house (left): body, roof, door that bumps, window with the friend
  const house = new Group();
  house.position.set(L.house, 0.3, 0);
  const wall = new Mesh(roundedBox(3.0, 2.8, 5.2, 0.15), toyMaterial('#ffe6c4', { finish: 'matte' }));
  wall.position.y = 1.4;
  wall.castShadow = wall.receiveShadow = true;
  const roof = new Mesh(new ConeGeometry(3.6, 1.9, 4), toyMaterial('#e2695a', { finish: 'satin' }));
  roof.position.y = 3.75;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(0.72, 1, 1.12);
  roof.castShadow = true;
  const door = new Mesh(roundedBox(0.16, 1.9, 1.3, 0.08), woodMaterial('#b0703f'));
  door.position.set(1.52, 0.95, 0);
  const knob = new Mesh(ball(0.09, 10), toyMaterial(PALETTE.sun, { rimStrength: 0.6 }));
  knob.position.set(1.64, 0.95, 0.4);
  const win = new Mesh(roundedBox(0.1, 0.9, 1.0, 0.06), toyMaterial('#bfe9ff', { rimStrength: 0.4 }));
  win.position.set(1.52, 1.75, 1.75);
  house.add(wall, roof, door, knob, win);
  const friend = createFriend();
  friend.group.scale.setScalar(0.55);
  friend.group.position.set(1.75, 1.2, 1.75);
  friend.group.rotation.y = Math.PI / 2;
  house.add(friend.group);
  root.add(house);
  const houseShake = new Spring(0, 240, 10);

  // the child's hand: four cards (blue = take away, pink = add; the sign is on the card too)
  const matMinus = toyMaterial(MINUS, { finish: 'satin' });
  const matPlus = toyMaterial(PLUS, { finish: 'satin' });
  const cardGeo = roundedBox(1.45, 1.8, 0.1, 0.16);
  const cards: {
    g: Group;
    face: Mesh;
    label: NumberLabel;
    spring: Spring;
    nope: Spring;
    shown: number | null;
    proxy: Mesh;
  }[] = [];
  for (let i = 0; i < HAND; i++) {
    const g = new Group();
    g.position.set(...handAt(i));
    g.rotation.x = -0.3;
    const rim = new Mesh(roundedBox(1.57, 1.92, 0.08, 0.18), toyMaterial(PALETTE.white));
    rim.position.z = -0.03;
    const face = new Mesh(cardGeo, matMinus);
    face.castShadow = true;
    const label = new NumberLabel('-1', { size: 0.66, tint: PALETTE.ink });
    label.position.set(0, -0.04, 0.45);
    const proxy = hitCylinder(0.95, 2.2, i);
    g.add(rim, face, label, proxy);
    root.add(g);
    cards.push({
      g,
      face,
      label,
      spring: new Spring(0, 220, 11),
      nope: new Spring(0, 320, 9),
      shown: null,
      proxy,
    });
  }
  // the thrown card + the floating sum
  const dart = new Mesh(roundedBox(0.7, 0.9, 0.06, 0.1), matMinus);
  dart.visible = false;
  const eq = new NumberLabel('1-1=0', { size: 0.5, tint: PALETTE.ink });
  eq.visible = false;
  root.add(dart, eq);

  let view: ZView | null = null;
  let viewId = -1;
  const party: { v: ZView; from: Vector3; to: Vector3 }[] = [];
  let shown = 0;
  let eqT = -1;
  const eqAt = new Vector3();
  const hitStop = new HitStop();
  const shake = new Shake(!reduced && ctx.shakeIntensity > 0);
  let cursorId: number | null = null;
  let glowId: number | null = null;
  let t = 0;
  const tmp = new Vector3();
  const from = new Vector3();
  const fired = new Set<string>();
  const once = (id: string, fn: () => void) => {
    if (fired.has(id)) return;
    fired.add(id);
    fn();
  };
  const spot = (i: number) => tmp.set(L.spot0 + (i % 9) * L.spotGap, 0.3, -3.0 + (i % 2) * 0.35).clone();

  return {
    sync(state, prev, dt) {
      const vdt = hitStop.filter(dt);
      t += vdt;
      const z = state.zombie;
      // a new zombie at the gate (a retry keeps the same one and just swaps its number)
      if (z && z.id !== viewId) {
        viewId = z.id;
        view = zombieModel(z);
        root.add(view.group);
        shown = z.start;
        fired.clear();
        if (!reduced) audio.play('zombie.moan', { pitch: 0.9 + (z.id % 4) * 0.08 });
      }
      if (
        z &&
        view &&
        state.phase === 'play' &&
        prev?.phase === 'play' &&
        z.used === 0 &&
        shown !== z.value
      ) {
        shown = z.value; // new numbers after hint 4
        view.label.set(shown);
      }
      // ── cards: follow the hand, pop in when dealt, wiggle when refused
      cards.forEach((c, i) => {
        const delta = state.hand[i];
        const flying = state.phase === 'hit' && state.slot === i;
        if (delta !== undefined && c.shown !== delta && !flying) {
          c.shown = delta;
          c.label.set(cardText(delta));
          c.face.material = delta < 0 ? matMinus : matPlus;
          c.spring.impulse(7);
        }
        const dealK = state.phase === 'wave' ? ease((1 - state.phaseLeft / WAVE_TICKS) * 2 - i * 0.2) : 1;
        const glowing = glowId === i ? 1 + Math.abs(Math.sin(t * 4)) * 0.1 : 1;
        const hover = cursorId === i ? 1.08 : 1;
        const s = (1 + c.spring.update(vdt) * 0.05) * glowing * hover * dealK;
        c.g.scale.setScalar(flying ? 0.001 : Math.max(0.001, s));
        const [hx, hy] = handAt(i);
        c.g.position.x = hx + c.nope.update(vdt) * 0.05;
        c.g.position.y = hy + (cursorId === i ? 0.18 : 0);
        if (glowId === i && Math.floor(t * 6) % 3 === 0)
          world.particles.emit('sparkle', tmp.copy(c.g.position).setY(hy + 1), 2);
      });
      // ── one-shot reactions
      if (prev && prev.phase !== 'nope' && state.phase === 'nope') {
        audio.play('zombie.nope');
        cards[state.slot]?.nope.impulse(26);
        view?.spring.impulse(5);
      }
      if (prev && prev.phase !== 'hit' && state.phase === 'hit') {
        fired.delete('land');
        audio.play('whoosh', { pitch: 1.4 });
        dart.material = (state.eq?.delta ?? -1) < 0 ? matMinus : matPlus;
      }
      if (prev && prev.phase !== 'knock' && state.phase === 'knock') {
        audio.play('zombie.knock');
        audio.play('wrong.boing', { delay: 0.15, pitch: 1.3 });
        houseShake.impulse(12);
        shake.add(0.3 * ctx.shakeIntensity);
        world.particles.emit('dust', tmp.set(DOOR_X - 0.6, 1.2, LANE_Z[z?.lane ?? 1] ?? 0), 20);
        friend.cheer(false);
      }
      // ── the zombie
      if (z && view) {
        const v = view;
        const g = v.group;
        const laneZ = LANE_Z[z.lane] ?? 0;
        const x = GATE_X + (DOOR_X - GATE_X) * z.walk;
        const sp = v.spring.update(vdt);
        const walking = state.phase === 'play' || state.phase === 'nope';
        if (state.phase !== 'pop') {
          g.position.set(x, 0.3 + (walking && !reduced ? Math.abs(Math.sin(t * 5)) * 0.12 : 0), laneZ);
          g.rotation.set(0, -Math.PI / 2 + 0.55, walking && !reduced ? Math.sin(t * 5) * 0.12 : 0);
          if (state.phase === 'knock' && !reduced) {
            const k = 1 - state.phaseLeft / KNOCK_TICKS;
            g.position.y += Math.sin(Math.min(1, k * 1.6) * Math.PI) * 1.3;
            g.rotation.y += Math.sin(k * 20) * 0.2;
          }
        }
        v.body.scale.set(1 - sp * 0.04, 1 + sp * 0.07, 1 - sp * 0.04);
        v.arms.forEach((a, i) => {
          a.rotation.x = reduced ? 0 : Math.sin(t * 5 + i * Math.PI) * 0.25 - 0.1;
        });
        v.balloon.position.y = 3.1 + (reduced ? 0 : Math.sin(t * 2.2) * 0.08);
        v.balloon.rotation.z = reduced ? 0 : Math.sin(t * 1.7) * 0.08;
        // a played card flies to the balloon; the number changes when it lands
        if (state.phase === 'hit') {
          const k = 1 - state.phaseLeft / HIT_TICKS;
          const u = ease(k / 0.7);
          const [fx, fy, fz] = handAt(state.slot);
          from.set(fx, fy + 0.4, fz);
          v.balloon.getWorldPosition(tmp);
          dart.visible = k < 0.7;
          dart.position.lerpVectors(from, tmp, u);
          dart.position.y += reduced ? 0 : Math.sin(u * Math.PI) * 1.4;
          dart.rotation.set(u * 9, u * 5, 0);
          if (k >= 0.7)
            once('land', () => {
              shown = z.value;
              v.label.set(shown);
              v.spring.impulse(9);
              audio.play('pop', { pitch: z.value === 0 ? 1.4 : 1 });
              world.particles.emit('sparkle', tmp, 22);
              if (state.eq) {
                eq.set(`${state.eq.from}${cardText(state.eq.delta)}=${state.eq.to}`);
                eqAt.copy(tmp);
                eqT = 0;
              }
            });
        } else dart.visible = false;
        // exactly 0: the balloon pops, the zombie twirls and hops to the garden party
        if (state.phase === 'pop') {
          const k = 1 - state.phaseLeft / POP_TICKS;
          once(`pop-${z.id}`, () => {
            v.balloon.getWorldPosition(tmp);
            v.balloon.visible = false;
            audio.play('zombie.pop');
            audio.play('correct.big', { delay: 0.12 });
            hitStop.trigger(60);
            world.particles.emit('confetti', tmp, 70);
            celebrate(world, { x: tmp.x, y: 2.4, z: tmp.z }, state.core.streak, false);
            friend.cheer(true);
            party.push({ v, from: g.position.clone(), to: spot(state.popped) });
            if (z.boss) audio.play('levelup', { delay: 0.4 });
          });
          const p = party.at(-1);
          if (p && p.v === v) {
            const u = ease((k - 0.25) / 0.7);
            g.position.lerpVectors(p.from, p.to, u);
            g.position.y += reduced
              ? 0
              : Math.sin(u * Math.PI) * 2.2 + (k < 0.25 ? Math.sin(k * 4 * Math.PI) * 0.5 : 0);
            g.rotation.y =
              -Math.PI / 2 + 0.55 + (reduced ? 0 : ease(k / 0.9) * Math.PI * 4) + u * (Math.PI / 2 - 0.55);
            g.scale.setScalar((z.boss ? 1.35 : 1) * (1 - u * 0.4));
          }
        }
      }
      // party guests bob happily at the fence
      party.forEach((p, i) => {
        if (p.v === view && state.phase === 'pop') return;
        p.v.group.position.y = 0.3 + (reduced ? 0 : Math.abs(Math.sin(t * 3 + i)) * 0.14);
        p.v.group.rotation.z = reduced ? 0 : Math.sin(t * 3 + i) * 0.1;
        p.v.arms.forEach((a) => {
          a.rotation.x = -2.2 + (reduced ? 0 : Math.sin(t * 6 + i) * 0.3);
        });
      });
      // the floating sum
      if (eqT >= 0) {
        eqT += vdt;
        const k = Math.min(1, eqT / 1.5);
        eq.visible = k < 1;
        eq.position.set(eqAt.x, eqAt.y + 0.9 + k * 0.9, eqAt.z + 0.3);
        eq.scale.setScalar(k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1);
        if (k >= 1) eqT = -1;
      }
      // house: shake on a knock, friend in the window
      const hs = houseShake.update(vdt);
      house.rotation.z = reduced ? 0 : hs * 0.012;
      door.position.x = 1.52 - Math.max(0, hs) * 0.02;
      friend.update(vdt, t, reduced);
      const sh = shake.update(dt);
      world.camera.position.set(L.camX + sh.x, CAM.y + sh.y, CAM.z);
      // portrait: look lower so the yard sits in the upper half and the cards below it
      world.camera.lookAt(L.camX, narrow ? -0.9 : CAM.lookY, narrow ? 1.2 : 0);
    },
    pointer(p: PointerInfo, state, emit) {
      if (p.type !== 'down' || state.phase !== 'play') return;
      const id = hitId(
        cards.map((c) => c.proxy),
        p.raycaster,
      );
      if (id !== null) emit({ t: 'card', id });
    },
    screenPos(_s, id) {
      const c = cards[id];
      if (!c) return null;
      const v = c.g.getWorldPosition(tmp).project(world.camera);
      return { x: v.x, y: v.y };
    },
    setCursor(id) {
      cursorId = id;
    },
    setGlow(id) {
      glowId = id;
    },
    dispose() {
      disposeTree(root);
    },
  };
}
