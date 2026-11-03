/**
 * ⑤ 이상한 자물쇠 방탈출 diorama: a toy room (back wall + side wall + floor) with five things that may hide a
 * number, and a door with a chunky lock carrying three big number keys.
 * - Things not opened yet wear a bouncing "?" badge. Opening one: a clue number pops out and flies into the
 *   sentence at the top (DOM, `flyToGoal`); the thing keeps a little ★. Empties puff dust.
 * - The lock keys show "?" until every clue is found, then flip to numbers; a wrong key dims and rattles.
 * - Room cut: the camera swoops in at the start of each room; when the door opens, light pours out and the
 *   camera glides into the doorway (the HUD closes an iris over it). The treasure room frees the friend.
 */
import { CylinderGeometry, Group, Mesh, PointLight, Vector3 } from 'three/webgpu';
import { HitStop, Shake, Spring } from '../../engine/fx/juice';
import { roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { createFriend } from '../../scenes/island/friend';
import { baseDiorama, disposeTree, hitCylinder, hitId, hitSphere, stageCamera } from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import { propModel, ROOM_COLORS } from './props';
import {
  allFound,
  ENTER_TICKS,
  type EscapeAction,
  type EscapeState,
  KEY,
  KEYS,
  OPEN_TICKS,
  type RoomTheme,
} from './rules';

/** Where the five things stand: spread out so no two line up from the camera. */
const SPOTS: readonly [number, number][] = [
  [-3.4, -1.1],
  [3.4, -1.3],
  [-2.6, 1.5],
  [2.5, 1.6],
  [0.9, 2.3],
];
const WALL_Z = -2.6;
const DOOR_W = 2.5;
const DOOR_H = 3.3;
const CAM = { z: 11, y: 6.4, lookY: 1.7 };

interface ThingView {
  group: Group;
  badge: NumberLabel;
  star: NumberLabel | null;
  spring: Spring;
  proxy: Mesh;
}

const ease = (x: number) => x * x * (3 - 2 * x);

export function createEscapeScene(world: RenderWorld, ctx: StageCtx): StageScene<EscapeState, EscapeAction> {
  const root = new Group();
  root.name = 'stage-escape';
  world.scene.add(root);
  stageCamera(world, CAM.z, CAM.y, 42, CAM.lookY);
  root.add(baseDiorama(PALETTE.cream, 7));

  // room shell (recoloured per theme)
  const floor = new Mesh(roundedBox(9.6, 0.3, 6.4, 0.12), toyMaterial('#f6c9a0', { finish: 'satin' }));
  floor.position.set(0, 0.15, -0.2);
  floor.receiveShadow = true;
  const back = new Mesh(roundedBox(9.6, 4.2, 0.3, 0.1), toyMaterial('#fff0d6', { finish: 'matte' }));
  back.position.set(0, 2.25, WALL_Z - 0.15);
  back.receiveShadow = true;
  const side = new Mesh(roundedBox(0.3, 4.2, 6.4, 0.1), toyMaterial('#fff0d6', { finish: 'matte' }));
  side.position.set(-4.95, 2.25, -0.2);
  side.receiveShadow = true;
  const trim = new Mesh(roundedBox(9.6, 0.22, 0.36, 0.06), toyMaterial(PALETTE.berry));
  trim.position.set(0, 0.42, WALL_Z - 0.1);
  root.add(floor, back, side, trim);

  // door: frame + panel hinged on its left edge, glowing doorway behind it
  const frame = new Mesh(roundedBox(DOOR_W + 0.4, DOOR_H + 0.25, 0.35, 0.08), woodMaterial('#8a5a3c'));
  frame.position.set(0, 0.3 + DOOR_H / 2, WALL_Z);
  const glow = new Mesh(roundedBox(DOOR_W, DOOR_H, 0.05, 0.02), toyMaterial('#fff6c8', { rimStrength: 1 }));
  glow.position.set(0, 0.3 + DOOR_H / 2, WALL_Z + 0.1);
  const hinge = new Group();
  hinge.position.set(-DOOR_W / 2, 0.3, WALL_Z + 0.2);
  const panel = new Mesh(roundedBox(DOOR_W, DOOR_H, 0.16, 0.06), woodMaterial('#c98a5c'));
  panel.position.set(DOOR_W / 2, DOOR_H / 2, 0);
  panel.castShadow = true;
  hinge.add(panel);
  root.add(frame, glow, hinge);
  const light = new PointLight('#ffd98a', 0, 9, 1.6); // always present (intensity 0): no shader recompiles
  light.position.set(0, 1.8, WALL_Z + 0.8);
  root.add(light);

  // the lock: a chunky body with three big number keys
  const lock = new Group();
  lock.position.set(DOOR_W / 2, 1.75, 0.2);
  lock.scale.setScalar(1.15);
  hinge.add(lock);
  const body = new Mesh(roundedBox(2.0, 1.1, 0.34, 0.16), toyMaterial(PALETTE.sun));
  body.castShadow = true;
  const shackle = new Mesh(new CylinderGeometry(0.07, 0.07, 0.55, 10), metalMaterial('#cfd6e4'));
  shackle.position.set(-0.55, 0.75, 0);
  const shackle2 = shackle.clone();
  shackle2.position.x = 0.55;
  lock.add(body, shackle, shackle2);
  const keyMat = toyMaterial(PALETTE.white);
  const keyMatDim = toyMaterial('#c9c4d6', { finish: 'matte' });
  const keys: { mesh: Mesh; label: NumberLabel; spring: Spring; shown: string }[] = [];
  const keyProxies: Mesh[] = [];
  for (let i = 0; i < KEYS; i++) {
    const x = (i - 1) * 0.62;
    const mesh = new Mesh(roundedBox(0.54, 0.6, 0.2, 0.1), keyMat);
    mesh.position.set(x, -0.02, 0.22);
    mesh.castShadow = true;
    const label = new NumberLabel('?', { size: 0.42, tint: '#9a93b0' });
    label.position.set(x, -0.02, 0.5);
    lock.add(mesh, label);
    const proxy = hitSphere(0.36, KEY(i));
    proxy.position.copy(mesh.position);
    lock.add(proxy);
    keyProxies.push(proxy);
    keys.push({ mesh, label, spring: new Spring(0, 240, 12), shown: '?' });
  }

  // the trapped friend, freed by the treasure-room lock
  const friend = createFriend();
  friend.group.position.set(0, 0.3, WALL_Z - 0.4);
  friend.group.visible = false;
  root.add(friend.group);

  const things = new Map<number, ThingView>();
  const proxies: Mesh[] = [];
  let roomRef: EscapeState['room'] = null;
  const hitStop = new HitStop();
  const shake = new Shake(!ctx.reducedMotion && ctx.shakeIntensity > 0);
  const lockShake = new Spring(0, 260, 9);
  let cursorId: number | null = null;
  let glowId: number | null = null;
  let t = 0;
  let doorT = 0;
  let friendT = -1;
  const tmp = new Vector3();
  const look = new Vector3();

  const paint = (th: RoomTheme) => {
    const c = ROOM_COLORS[th];
    floor.material = toyMaterial(c.floor, { finish: 'satin' });
    back.material = side.material = toyMaterial(c.wall, { finish: 'matte' });
    trim.material = toyMaterial(c.trim);
  };

  const build = (s: EscapeState) => {
    for (const v of things.values()) disposeTree(v.group);
    things.clear();
    proxies.length = 0;
    const room = s.room;
    if (!room) return;
    paint(room.theme);
    doorT = 0;
    friend.group.visible = false;
    friendT = -1;
    for (const k of keys) k.shown = '';
    room.things.forEach((th) => {
      const [x, z] = SPOTS[th.id % SPOTS.length] as [number, number];
      const g = new Group();
      const model = propModel(room.theme, th.kind);
      model.scale.setScalar(1.25);
      g.add(model);
      g.position.set(x, 0.3, z);
      g.rotation.y = -x * 0.12;
      // "tap me": a bouncing ? badge until it is opened
      const badge = new NumberLabel('?', { size: 0.55, tint: PALETTE.berry });
      badge.position.set(0, 1.85, 0);
      g.add(badge);
      const proxy = hitCylinder(0.85, 2.2, th.id);
      proxy.position.y = 0.9;
      g.add(proxy);
      root.add(g);
      proxies.push(proxy);
      things.set(th.id, { group: g, badge, star: null, spring: new Spring(0, 200, 10), proxy });
    });
  };

  const reveal = (s: EscapeState, id: number) => {
    const v = things.get(id);
    const th = s.room?.things.find((x) => x.id === id);
    if (!v || !th) return;
    v.spring.impulse(6);
    v.badge.visible = false;
    if (th.clue !== null) {
      // the number itself flies up into the sentence (HUD); the thing keeps a little gold star
      const star = new NumberLabel('★', { size: 0.42, tint: '#f2b632' });
      star.position.set(0, 1.25, 0);
      v.group.add(star);
      v.star = star;
      audio.play('coin');
      audio.play('correct', { delay: 0.08 });
      world.particles.emit('sparkle', tmp.copy(v.group.position).setY(1.6), 30);
    } else {
      // empty: a dusty "nothing here!" wobble
      audio.play('pop');
      audio.play('wrong.boing', { pitch: 1.6, delay: 0.05 });
      world.particles.emit('dust', tmp.copy(v.group.position).setY(1), 14);
    }
  };

  return {
    sync(state, prev, dt) {
      const vdt = hitStop.filter(dt);
      t += vdt;
      if (state.room !== roomRef) {
        roomRef = state.room;
        build(state);
      }
      const room = state.room;
      const ready = !!room && allFound(room, state.found);
      // one-shot effects
      if (prev && state.found.length > prev.found.length) {
        for (const id of state.found) if (!prev.found.includes(id)) reveal(state, id);
      }
      if (prev && prev.phase !== 'open' && state.phase === 'open') {
        audio.play('snip', { pitch: 0.7 });
        audio.play('gift', { delay: 0.25 });
        audio.play('correct.big', { delay: 0.45 });
        hitStop.trigger(60);
        celebrate(
          world,
          { x: 0, y: 2.5, z: WALL_Z + 0.6 },
          state.core.streak,
          !!state.core.asked?.question.tags.includes('SIX_SEVEN'),
        );
        if (room?.boss) {
          friendT = 0;
          audio.play('levelup', { delay: 0.9 });
        }
      }
      if (prev && prev.phase !== 'jam' && state.phase === 'jam') {
        audio.play('wrong.boing');
        audio.play('wrong.duck', { delay: 0.25 });
        lockShake.impulse(14);
        shake.add(0.3 * ctx.shakeIntensity);
        world.particles.emit('dust', tmp.set(0, 1.9, WALL_Z + 0.6), 18);
      }
      // lock keys: "?" until every clue is found, then the three numbers pop in; tried ones dim
      keys.forEach((k, i) => {
        const value = room?.options[i];
        const want = ready && value !== undefined ? String(value) : '?';
        if (k.shown !== want) {
          if (k.shown && want !== '?') {
            k.spring.impulse(7);
            audio.play('pop', { delay: i * 0.08, pitch: 1 + i * 0.15 });
          }
          k.label.set(want);
          k.shown = want;
        }
        const tried = value !== undefined && state.tried.includes(value);
        k.mesh.material = ready && !tried ? keyMat : keyMatDim;
        const glowing = glowId === KEY(i) ? 1 + Math.abs(Math.sin(t * 4)) * 0.15 : 1;
        const hover = cursorId === KEY(i) ? 1.12 : 1;
        const s = (1 + k.spring.update(vdt) * 0.06) * (tried ? 0.86 : 1) * glowing * hover;
        k.mesh.scale.setScalar(s);
        k.label.scale.setScalar(s);
      });
      // lock rattle
      lock.position.x = DOOR_W / 2 + lockShake.update(vdt) * 0.03;
      lock.rotation.z = ctx.reducedMotion ? 0 : lockShake.value * 0.01;
      // door swings open, light pours out
      const opening = state.phase === 'open' ? 1 - state.phaseLeft / OPEN_TICKS : 0;
      doorT += ((opening > 0.12 ? 1 : 0) - doorT) * (1 - Math.exp(-vdt * 5));
      hinge.rotation.y = -doorT * 1.75;
      light.intensity = doorT * 30;
      if (doorT > 0.3 && !ctx.reducedMotion && Math.floor(t * 12) % 2 === 0)
        world.particles.emit(
          'sparkle',
          tmp.set((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 2.6, WALL_Z + 0.3),
          2,
        );
      // freed friend hops out of the treasure door
      if (friendT >= 0) {
        friendT += vdt;
        friend.group.visible = true;
        const k = Math.min(1, friendT / 1.4);
        friend.group.position.set(0.3, 0.3 + Math.sin(k * Math.PI) * 1.2, WALL_Z - 0.4 + k * 2.6);
        friend.update(vdt, t, ctx.reducedMotion);
        if (k >= 1 && friendT < 1.45) friend.cheer(true);
      }
      // things: wobble on tap, "?" badges bob, cursor / glow lift
      for (const [id, v] of things) {
        const sp = v.spring.update(vdt);
        const lift = cursorId === id ? 0.12 + Math.sin(t * 6) * 0.05 : 0;
        v.group.position.y = 0.3 + lift;
        v.group.scale.set(1 - sp * 0.04, 1 + sp * 0.06, 1 - sp * 0.04);
        if (v.badge.visible)
          v.badge.position.y = 1.85 + (ctx.reducedMotion ? 0 : Math.abs(Math.sin(t * 3 + id * 1.3)) * 0.18);
        if (glowId === id) {
          v.group.scale.multiplyScalar(1 + Math.abs(Math.sin(t * 4)) * 0.12);
          if (Math.floor(t * 6) % 3 === 0)
            world.particles.emit('sparkle', tmp.copy(v.group.position).setY(1.2), 2);
        }
      }
      // camera: swoop into a new room; glide into the open doorway before the next one
      // (one continuous move: into the old room's doorway … out of the new room's doorway)
      let push = 0;
      if (!ctx.reducedMotion) {
        if (state.phase === 'enter') push = 1 - ease(Math.min(1, (1 - state.phaseLeft / ENTER_TICKS) * 1.15));
        if (state.phase === 'open' && !room?.boss)
          push = ease(Math.max(0, (1 - state.phaseLeft / OPEN_TICKS - 0.55) / 0.45));
      }
      const sh = shake.update(dt);
      world.camera.position.set(sh.x, CAM.y + sh.y - push * 3.6, CAM.z - push * (CAM.z - WALL_Z - 3.2));
      look.set(0, CAM.lookY + push * 0.4, push * WALL_Z);
      world.camera.lookAt(look);
    },
    pointer(p: PointerInfo, state, emit) {
      if (p.type !== 'down' || state.phase !== 'play') return;
      const id = hitId([...proxies, ...keyProxies], p.raycaster);
      if (id === null) return;
      if (id >= KEY(0)) emit({ t: 'pick', id });
      else emit({ t: 'tap', id });
    },
    screenPos(_s, id) {
      let obj: { getWorldPosition(v: Vector3): Vector3 } | undefined;
      if (id < KEY(0)) obj = things.get(id)?.proxy;
      else obj = keyProxies[id - KEY(0)];
      if (!obj) return null;
      obj.getWorldPosition(tmp);
      if (id < KEY(0)) tmp.y = 1.4;
      const v = tmp.project(world.camera);
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
