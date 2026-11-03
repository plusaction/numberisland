/**
 * ⑤ 이상한 자물쇠 방탈출 diorama: a toy room (back wall + side wall + floor) with five things that may hide a
 * number, and a door with a chunky two-wheel number lock. Tap things → clue numbers pop up; ▲▼ turn the
 * wheels; "열어요!" tries the code: the door swings open with light pouring out (the last room frees the
 * trapped monster friend), or the lock rattles with a funny boing (nothing lost).
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, PointLight, Vector3 } from 'three/webgpu';
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
  DIAL_DOWN,
  DIAL_UP,
  type EscapeAction,
  type EscapeState,
  HANDLE,
  OPEN_TICKS,
  type RoomTheme,
  WHEELS,
} from './rules';

/** Where the five things stand (clear of the door in the middle of the back wall). */
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

interface ThingView {
  group: Group;
  label: NumberLabel | null;
  spring: Spring;
  proxy: Mesh;
  pop: number;
}

export function createEscapeScene(world: RenderWorld, ctx: StageCtx): StageScene<EscapeState, EscapeAction> {
  const root = new Group();
  root.name = 'stage-escape';
  world.scene.add(root);
  stageCamera(world, 11, 6.4, 42, 1.7);
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

  // the lock on the door: a chunky body, two number wheels, ▲▼ keys
  const lock = new Group();
  lock.position.set(DOOR_W / 2, 1.7, 0.2);
  lock.scale.setScalar(1.45); // big wheels and keys: easy to see and tap
  hinge.add(lock);
  const body = new Mesh(roundedBox(1.5, 1.05, 0.34, 0.14), toyMaterial(PALETTE.sun));
  body.castShadow = true;
  const shackle = new Mesh(new CylinderGeometry(0.06, 0.06, 0.5, 10), metalMaterial('#cfd6e4'));
  shackle.position.set(-0.45, 0.72, 0);
  const shackle2 = shackle.clone();
  shackle2.position.x = 0.45;
  lock.add(body, shackle, shackle2);
  const wheelLabels: NumberLabel[] = [];
  const wheelSprings: Spring[] = [];
  const dialProxies: Mesh[] = [];
  const arrowMat = toyMaterial(PALETTE.berry);
  const cone = new ConeGeometry(0.22, 0.3, 16);
  for (let w = 0; w < WHEELS; w++) {
    const x = (w - 0.5) * 0.62;
    const wheel = new Mesh(new CylinderGeometry(0.27, 0.27, 0.42, 20), toyMaterial(PALETTE.white));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0, 0.2);
    lock.add(wheel);
    const lab = new NumberLabel(0, { size: 0.5, placeColors: true });
    lab.position.set(x, 0, 0.52);
    lock.add(lab);
    wheelLabels.push(lab);
    wheelSprings.push(new Spring(0, 220, 12));
    const up = new Mesh(cone, arrowMat);
    up.position.set(x, 0.74, 0.22);
    const down = new Mesh(cone, arrowMat);
    down.rotation.z = Math.PI;
    down.position.set(x, -0.74, 0.22);
    lock.add(up, down);
    const pu = hitSphere(0.3, DIAL_UP(w));
    pu.position.copy(up.position);
    const pd = hitSphere(0.3, DIAL_DOWN(w));
    pd.position.copy(down.position);
    lock.add(pu, pd);
    dialProxies.push(pu, pd);
  }
  const handleProxy = hitSphere(0.55, HANDLE);
  handleProxy.position.set(0, 0, 0.3);
  lock.add(handleProxy);
  dialProxies.push(handleProxy);

  // the trapped friend, freed by the treasure-room lock
  const friend = createFriend();
  friend.group.position.set(0, 0.3, WALL_Z - 0.4);
  friend.group.visible = false;
  root.add(friend.group);

  const things = new Map<number, ThingView>();
  const proxies: Mesh[] = [];
  let roomRef: EscapeState['room'] = null;
  let theme: RoomTheme = 'kitchen';
  const hitStop = new HitStop();
  const shake = new Shake(!ctx.reducedMotion && ctx.shakeIntensity > 0);
  const lockShake = new Spring(0, 260, 9);
  let cursorId: number | null = null;
  let glowId: number | null = null;
  let t = 0;
  let doorT = 0;
  let friendT = -1;
  const tmp = new Vector3();

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
    theme = room.theme;
    paint(theme);
    doorT = 0;
    room.things.forEach((th) => {
      const [x, z] = SPOTS[th.id % SPOTS.length] as [number, number];
      const g = new Group();
      const model = propModel(room.theme, th.kind);
      model.scale.setScalar(1.25);
      g.add(model);
      g.position.set(x, 0.3, z);
      g.rotation.y = -x * 0.12;
      const proxy = hitCylinder(0.85, 2.2, th.id);
      proxy.position.y = 0.9;
      g.add(proxy);
      root.add(g);
      proxies.push(proxy);
      things.set(th.id, { group: g, label: null, spring: new Spring(0, 200, 10), proxy, pop: 0 });
    });
  };

  const reveal = (s: EscapeState, id: number) => {
    const v = things.get(id);
    const th = s.room?.things.find((x) => x.id === id);
    if (!v || !th) return;
    v.spring.impulse(6);
    if (th.clue !== null) {
      // a number pops out of it and stays floating above
      const lab = new NumberLabel(th.clue, { size: 0.7, placeColors: true });
      lab.position.set(0, 1.85, 0);
      v.group.add(lab);
      v.label = lab;
      v.pop = 0;
      audio.play('coin');
      audio.play('correct', { delay: 0.08 });
      world.particles.emit('sparkle', tmp.copy(v.group.position).setY(2), 30);
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
      // one-shot effects
      if (prev && state.found.length > prev.found.length) {
        for (const id of state.found) if (!prev.found.includes(id)) reveal(state, id);
      }
      if (prev) {
        for (let w = 0; w < WHEELS; w++) {
          const before = prev.dial[w] ?? 0;
          const now = state.dial[w] ?? 0;
          if (now !== before) {
            audio.play('ui.tap', { pitch: 0.8 + now * 0.06 });
            wheelSprings[w]?.impulse(now === (before + 1) % 10 ? 5 : -5);
          }
        }
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
        if (state.room?.boss) {
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
      // wheels show the dial
      wheelLabels.forEach((lab, w) => {
        lab.set(state.dial[w] ?? 0);
        const s = 1 + (wheelSprings[w]?.update(vdt) ?? 0) * 0.08;
        lab.scale.setScalar(s);
      });
      // lock rattle
      lock.position.x = DOOR_W / 2 + lockShake.update(vdt) * 0.03;
      lock.rotation.z = ctx.reducedMotion ? 0 : lockShake.value * 0.01;
      // door swings open (light pours out); closes again for the next room
      const opening = state.phase === 'open' ? 1 - state.phaseLeft / OPEN_TICKS : 0;
      doorT += ((opening > 0.15 ? 1 : 0) - doorT) * (1 - Math.exp(-vdt * 5));
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
      // things: wobble on tap, clue numbers bob gently, cursor/glow lift
      for (const [id, v] of things) {
        const sp = v.spring.update(vdt);
        const lift = cursorId === id ? 0.12 + Math.sin(t * 6) * 0.05 : 0;
        v.group.position.y = 0.3 + lift;
        v.group.scale.set(1 - sp * 0.04, 1 + sp * 0.06, 1 - sp * 0.04);
        if (v.label) {
          v.pop = Math.min(1, v.pop + vdt * 3);
          v.label.position.y = 1.85 + (ctx.reducedMotion ? 0 : Math.sin(t * 2 + id) * 0.06);
          v.label.scale.setScalar(v.pop < 1 ? 0.4 + v.pop * 0.7 + Math.sin(v.pop * Math.PI) * 0.25 : 1.1);
        }
        if (glowId === id) {
          v.group.scale.multiplyScalar(1 + Math.abs(Math.sin(t * 4)) * 0.12);
          if (Math.floor(t * 6) % 3 === 0)
            world.particles.emit('sparkle', tmp.copy(v.group.position).setY(1.2), 2);
        }
      }
      const sh = shake.update(dt);
      world.camera.position.x = sh.x;
      world.camera.position.y = 6.4 + sh.y;
    },
    pointer(p: PointerInfo, state, emit) {
      if (p.type !== 'down' || state.phase !== 'play') return;
      const id = hitId([...proxies, ...dialProxies], p.raycaster);
      if (id === null) return;
      if (id === HANDLE) emit({ t: 'open' });
      else if (id >= 100) {
        const wheel = Math.floor((id - 100) / 2);
        emit({ t: 'dial', wheel, dir: (id - 100) % 2 === 0 ? 1 : -1 });
      } else emit({ t: 'tap', id });
    },
    screenPos(_s, id) {
      let obj: { getWorldPosition(v: Vector3): Vector3 } | undefined;
      if (id < 100) obj = things.get(id)?.proxy;
      else obj = dialProxies.find((m) => m.userData.hit === id);
      if (!obj) return null;
      obj.getWorldPosition(tmp);
      if (id < 100) tmp.y = 1.2;
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
