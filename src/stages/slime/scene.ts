/** ④ 슬라임 합체 diorama: jelly tray, drag-to-merge, overshoot squash on merge (signature). */
import { float, smoothstep, uv } from 'three/tsl';
import {
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  Plane,
  PlaneGeometry,
  TorusGeometry,
  Vector3,
} from 'three/webgpu';
import { HitStop, Shake, Spring, squashScale } from '../../engine/fx/juice';
import { ball, ring, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import {
  createSoftBody,
  FRONT,
  NODE_DIRS,
  type SoftBody,
  softBallGeometry,
  softDisplacement,
} from '../../engine/physics/softbody';
import { type JellyMaterial, jellyMaterial, toyMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { baseDiorama, disposeTree, hitCylinder, hitId, stageCamera } from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import type { SlimeAction, SlimeState } from './rules';

const COLORS = [
  PALETTE.sea,
  PALETTE.leaf,
  PALETTE.sun,
  PALETTE.lavender,
  PALETTE.peach,
  PALETTE.mint,
  '#ffb3c7',
];
const SLOT_POS = (slot: number) => {
  const cols = 4;
  const row = Math.floor(slot / cols);
  const col = slot % cols;
  return new Vector3((col - 1.5) * 2.3 + (row % 2) * 1.1, 0.75, (row - 0.5) * 2.4);
};
const radiusFor = (v: number) => 0.5 + Math.min(0.55, Math.log10(v + 1) * 0.22);

type Face = 'idle' | 'happy' | 'wow' | 'wink' | 'sleepy';
const MOODS: readonly Face[] = ['happy', 'wow', 'wink', 'sleepy', 'happy'];
const UP = new Vector3(0, 1, 0);
const SMILE = new TorusGeometry(0.13, 0.032, 8, 20, Math.PI);
SMILE.userData.shared = true;

interface SlimeView {
  group: Group;
  body: Mesh;
  jelly: JellyMaterial;
  /** Soft-body shell (mass–spring) that bends the jelly; the face rides its front node. */
  soft: SoftBody;
  face: Group;
  eyes: Mesh[];
  shines: Mesh[];
  smile: Mesh;
  oMouth: Mesh;
  mood: { kind: Face; until: number; nextAt: number; blinkAt: number; blinkUntil: number; joyUntil: number };
  pokeAt: number;
  lastPos: Vector3;
  lastVel: Vector3;
  accel: Vector3;
  label: NumberLabel;
  proxy: Mesh;
  spring: Spring;
  home: Vector3;
  value: number;
}

export function createSlimeScene(world: RenderWorld, ctx: StageCtx): StageScene<SlimeState, SlimeAction> {
  const root = new Group();
  root.name = 'stage-slime';
  world.scene.add(root);
  // look a little above the tray: the board sits lower on screen, clear of the goal box
  stageCamera(world, 11, 10, 40, 1.4);
  root.add(baseDiorama(PALETTE.mint, 7.2));
  const tray = new Mesh(roundedBox(11, 0.5, 6.4, 0.4), toyMaterial(PALETTE.lavender));
  tray.position.y = 0.25;
  tray.receiveShadow = true;
  root.add(tray);
  for (let s = 0; s < 8; s++) {
    const pad = new Mesh(roundedBox(1.6, 0.06, 1.6, 0.3), toyMaterial('#d9cdfb'));
    pad.position.copy(SLOT_POS(s)).setY(0.52);
    pad.receiveShadow = true; // the sun shadow falls on the cushions too, not only on the tray
    root.add(pad);
  }

  // soft contact shadow right under each slime (grounds it on every tier, even without shadow maps)
  const contactMat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  contactMat.color.set('#3a2a66');
  contactMat.opacityNode = float(0.38).mul(float(1).sub(smoothstep(0.1, 0.5, uv().sub(0.5).length())));
  const contactGeo = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const contacts = new Map<number, Mesh>();
  const views = new Map<number, SlimeView>();
  const proxies: Mesh[] = [];
  let puzzleRef: SlimeState['puzzle'] = null;
  let dragging: number | null = null;
  const dragPos = new Vector3();
  const plane = new Plane(new Vector3(0, 1, 0), -0.9);
  const hitStop = new HitStop();
  const shake = new Shake(!ctx.reducedMotion && ctx.shakeIntensity > 0);
  let cursorId: number | null = null;
  let heldId: number | null = null;
  let glowId: number | null = null;
  let lastEventTick = -1;
  let t = 0;

  const makeView = (id: number, value: number, minus: boolean, slot: number, colorIdx: number): SlimeView => {
    const g = new Group();
    const soft = createSoftBody();
    const jelly = jellyMaterial(
      minus ? '#ff6b7f' : (COLORS[colorIdx % COLORS.length] as string),
      softDisplacement(soft),
    );
    const body = new Mesh(softBallGeometry(), jelly.material);
    body.castShadow = true;
    // friendly face: big eyes with highlights, a smile (or a little "o"), blush — expressions swap now and then
    const face = new Group();
    const eyes: Mesh[] = [];
    const shines: Mesh[] = [];
    for (const x of [-0.28, 0.28]) {
      const eye = new Mesh(ball(0.17, 16), toyMaterial(PALETTE.ink));
      eye.position.set(x, 0.22, 0.86);
      const shine = new Mesh(ball(0.06, 10), toyMaterial(PALETTE.white));
      shine.position.set(x + 0.05, 0.3, 1.0);
      const blush = new Mesh(ball(0.1, 12), toyMaterial('#ff9fb8'));
      blush.position.set(x * 1.55, 0.0, 0.84);
      blush.scale.set(1, 0.6, 0.4);
      face.add(eye, shine, blush);
      eyes.push(eye);
      shines.push(shine);
    }
    const smile = new Mesh(SMILE, toyMaterial(PALETTE.ink));
    smile.position.set(0, -0.02, 0.95);
    smile.rotation.z = Math.PI; // the arc opens upward: a smile
    const oMouth = new Mesh(ring(0.12, 0.03), toyMaterial(PALETTE.ink));
    oMouth.position.set(0, -0.08, 0.95);
    oMouth.visible = false;
    face.add(smile, oMouth);
    body.add(face);
    const label = new NumberLabel(minus ? `-${value}` : value, {
      size: 0.68,
      placeColors: !minus,
      tint: '#e8505b',
    });
    // tap column covers the slime and its number badge above it
    const proxy = hitCylinder(1.1, 3.2, id);
    proxy.position.y = 0.7;
    g.add(body, label, proxy);
    const home = SLOT_POS(slot);
    g.position.copy(home);
    root.add(g);
    proxies.push(proxy);
    const now = t + Math.random() * 3;
    return {
      group: g,
      body,
      jelly,
      soft,
      face,
      eyes,
      shines,
      smile,
      oMouth,
      mood: { kind: 'idle', until: 0, nextAt: now + 2, blinkAt: now, blinkUntil: 0, joyUntil: 0 },
      pokeAt: now,
      lastPos: home.clone(),
      lastVel: new Vector3(),
      accel: new Vector3(),
      label,
      proxy,
      spring: new Spring(0, 120, 4.2), // soft + low damping = chewy jiggle
      home,
      value,
    };
  };

  // soft-body jelly: carried inertia (drags slosh), breathing swell, and an idle wobble now and then
  const pokeDir = new Vector3();
  const updateSoft = (v: SlimeView, id: number, r: number, dt: number) => {
    if (dt <= 0) return;
    const vel = pokeDir
      .copy(v.group.position)
      .sub(v.lastPos)
      .multiplyScalar(1 / dt);
    v.accel
      .copy(vel)
      .sub(v.lastVel)
      .multiplyScalar(1 / (dt * r));
    if (v.accel.length() > 60) v.accel.setLength(60);
    v.lastVel.copy(vel);
    v.lastPos.copy(v.group.position);
    if (ctx.reducedMotion) v.accel.set(0, 0, 0);
    else if (t > v.pokeAt) {
      // a little self-wobble: as if it shifted its weight
      v.pokeAt = t + 1.6 + Math.random() * 3;
      const k = Math.floor(Math.random() * NODE_DIRS.length);
      v.soft.poke(NODE_DIRS[k] as Vector3, 1.6 + Math.random() * 1.4);
    }
    const breath = ctx.reducedMotion ? 0 : 0.055 * Math.sin(t * 2.2 + id);
    v.soft.step(dt, v.accel, breath);
    // the face rides the front of the jelly
    v.face.position.copy(v.soft.disp[FRONT] as Vector3);
  };

  // faces: blink, and now and then a new mood (happy ^^, wow "o", wink, sleepy); events override
  const updateFace = (v: SlimeView, id: number, state: SlimeState) => {
    const m = v.mood;
    if (t > m.blinkAt) {
      m.blinkUntil = t + 0.13;
      m.blinkAt = t + 2.2 + Math.random() * 2.8;
    }
    if (t > m.nextAt) {
      m.kind = MOODS[Math.floor(Math.random() * MOODS.length)] as Face;
      m.until = t + 1.3 + Math.random() * 0.8;
      m.nextAt = t + 3.5 + Math.random() * 4;
    }
    let kind: Face = t < m.until ? m.kind : 'idle';
    if (dragging === id) kind = 'wow';
    if (t < m.joyUntil || (state.phase === 'win' && state.winner === id)) kind = 'happy';
    const blink = t < m.blinkUntil && kind !== 'happy';
    const [eyeL, eyeR] = v.eyes as [Mesh, Mesh];
    const open = kind === 'happy' ? 0.3 : kind === 'sleepy' ? 0.45 : 1;
    const big = kind === 'wow' ? 1.22 : 1;
    eyeL.scale.set(big, (blink ? 0.1 : open) * big, big);
    eyeR.scale.set(big, (blink || kind === 'wink' ? 0.1 : open) * big, big);
    v.shines.forEach((sh, i) => {
      sh.visible = !blink && open > 0.5 && !(i === 1 && kind === 'wink');
    });
    v.smile.visible = kind !== 'wow' && kind !== 'sleepy';
    v.smile.scale.setScalar(kind === 'happy' ? 1.45 : kind === 'wink' ? 1.2 : 1);
    v.oMouth.visible = !v.smile.visible;
    v.oMouth.scale.setScalar(kind === 'wow' ? 1.1 : 0.6);
  };

  const rebuild = (s: SlimeState) => {
    for (const c of contacts.values()) c.removeFromParent();
    contacts.clear();
    for (const v of views.values()) disposeTree(v.group);
    views.clear();
    proxies.length = 0;
    s.slimes.forEach((sl, i) => {
      views.set(sl.id, makeView(sl.id, sl.value, sl.minus, sl.slot, i));
    });
  };

  const ghosts: { v: SlimeView; to: number; t: number }[] = [];
  const ABSORB = 0.28;
  const updateGhosts = (dt: number) => {
    for (let i = ghosts.length - 1; i >= 0; i--) {
      const g = ghosts[i] as (typeof ghosts)[number];
      g.t += dt;
      const target = views.get(g.to);
      const k = Math.min(1, g.t / ABSORB);
      if (target) g.v.group.position.lerp(target.group.position, 1 - Math.exp(-dt * 22));
      const r = radiusFor(g.v.value);
      const ease = 1 - k * k;
      // stretched toward the partner like pulled taffy, then gone
      g.v.body.scale.set(r * ease * 0.8, r * (ease + 0.35 * Math.sin(k * Math.PI)), r * ease * 0.8);
      g.v.label.visible = k < 0.3;
      if (k >= 1) {
        disposeTree(g.v.group);
        ghosts.splice(i, 1);
      }
    }
  };

  const syncSlimes = (s: SlimeState) => {
    const ids = new Set(s.slimes.map((x) => x.id));
    for (const [id, v] of views) {
      if (!ids.has(id)) {
        proxies.splice(proxies.indexOf(v.proxy), 1);
        views.delete(id);
        contacts.get(id)?.removeFromParent(); // its shadow goes with it
        contacts.delete(id);
        // merged away: the slime is sucked into its partner (stretch + shrink) instead of vanishing
        const ev = s.event;
        if (ev?.kind === 'merge' && ev.from === id) ghosts.push({ v, to: ev.to, t: 0 });
        else disposeTree(v.group);
      }
    }
    s.slimes.forEach((sl, i) => {
      const v = views.get(sl.id);
      if (!v) {
        views.set(sl.id, makeView(sl.id, sl.value, sl.minus, sl.slot, i));
        return;
      }
      if (v.value !== sl.value) {
        v.value = sl.value;
        v.label.set(sl.minus ? `-${sl.value}` : sl.value);
      }
    });
  };

  return {
    sync(state, _prev, dt) {
      const vdt = hitStop.filter(dt);
      t += vdt;
      if (state.puzzle !== puzzleRef) {
        puzzleRef = state.puzzle;
        rebuild(state);
      } else syncSlimes(state);
      const ev = state.event;
      if (ev && ev.tick !== lastEventTick) {
        lastEventTick = ev.tick;
        const v = views.get(ev.to);
        if (ev.kind === 'merge' && v) {
          // gooey squelch (bigger slimes sound a little lower)
          audio.play('slime.squish', { pitch: 1.15 - Math.min(0.35, v.value / 150) });
          audio.play('merge', { pitch: 0.9 + Math.min(0.5, v.value / 200), delay: 0.08 });
          v.spring.impulse(-11); // deep squash → chewy overshoot → long wobbly settle (signature)
          v.soft.poke(UP, 4);
          v.mood.joyUntil = t + 1.6;
          v.jelly.wobble.value = 1;
          hitStop.trigger(40);
          world.particles.emit('sparkle', v.group.position, 25);
          world.burst('drop', v.group.position, 8, ['#ff8fab', '#b9a6f2', '#a8ebd8']);
        } else if (ev.kind === 'split' && v) {
          audio.play('slime.split');
          v.spring.impulse(5);
          v.jelly.wobble.value = 0.8;
          world.particles.emit('dust', v.group.position, 30);
        } else if (ev.kind === 'bounce') {
          audio.play('wrong.boing');
          shake.add(0.3 * ctx.shakeIntensity);
          views.get(ev.from)?.spring.impulse(6);
        } else if (ev.kind === 'undo') {
          audio.play('whoosh');
        }
      }
      if (state.phase === 'win' && state.phaseLeft === 74) {
        audio.play('correct.big');
        const w = state.winner !== null ? views.get(state.winner) : undefined;
        if (w) {
          w.spring.impulse(-9);
          w.soft.poke(UP, 3);
          w.mood.joyUntil = t + 3;
        }
        celebrate(
          world,
          w ? w.group.position : { x: 0, y: 2, z: 0 },
          state.core.streak,
          !!state.core.asked?.question.tags.includes('SIX_SEVEN'),
        );
      }
      updateGhosts(vdt);
      for (const [id, v] of views) {
        const r = radiusFor(v.value);
        const sq = squashScale(v.spring.update(vdt) * 0.16);
        const breathe = 0; // breathing now lives in the soft-body shell
        // held up by the finger: hangs a little longer and thinner, like soft mochi
        const hang = dragging === id ? 1.14 + Math.sin(t * 9) * 0.03 : 1;
        const thin = 1 / Math.sqrt(hang);
        v.body.scale.set(
          r * sq.x * (1 - breathe) * thin,
          r * sq.y * (1 + breathe) * hang,
          r * sq.z * (1 - breathe) * thin,
        );
        v.jelly.wobble.value *= Math.exp(-vdt * 1.3);
        const target = dragging === id ? dragPos : v.home;
        v.group.position.lerp(target, 1 - Math.exp(-vdt * (dragging === id ? 25 : 10)));
        v.group.position.y =
          (dragging === id ? 1.6 : 0.55 + r) + (cursorId === id || heldId === id ? 0.25 : 0);
        v.label.position.y = r * 1.05 + 0.55;
        if (state.phase === 'win' && state.winner === id && !ctx.reducedMotion)
          v.group.position.y += Math.abs(Math.sin(t * 7)) * 0.4;
        if (glowId === id) {
          v.group.position.y += 0.2 + Math.abs(Math.sin(t * 4)) * 0.2;
          if (Math.floor(t * 6) % 4 === 0) world.particles.emit('sparkle', v.group.position, 2);
        }
        updateSoft(v, id, r, vdt);
        let shadow = contacts.get(id);
        if (!shadow) {
          shadow = new Mesh(contactGeo, contactMat);
          shadow.raycast = () => {};
          shadow.renderOrder = 0;
          root.add(shadow);
          contacts.set(id, shadow);
        }
        // lifted (held, hovered, hopping) → the shadow shrinks and fades
        const lift = Math.max(0, v.group.position.y - (0.55 + r));
        const k = 1 / (1 + lift * 1.4);
        shadow.visible = v.group.visible;
        shadow.position.set(v.group.position.x, 0.565, v.group.position.z);
        shadow.scale.setScalar(r * 1.15 * k);
        updateFace(v, id, state);
      }
      const sh = shake.update(dt);
      world.camera.position.x = sh.x;
      world.camera.position.y = 10 + sh.y;
    },
    pointer(p: PointerInfo, state, emit) {
      if (p.type === 'down') {
        const id = hitId(proxies, p.raycaster);
        if (id !== null && state.phase === 'play') {
          dragging = id;
          p.raycaster.ray.intersectPlane(plane, dragPos);
          audio.play('slime.grab');
          const v = views.get(id);
          if (v) {
            v.spring.impulse(4); // stretches up as it is pulled off the tray
            v.soft.kick(UP, 1.2);
            v.jelly.wobble.value = 0.7;
          }
        }
      } else if (p.type === 'move' && dragging !== null) {
        p.raycaster.ray.intersectPlane(plane, dragPos);
      } else if (p.type === 'up' && dragging !== null) {
        const from = dragging;
        dragging = null;
        // drop target: the nearest other slime within reach of the drop point
        let best: number | null = null;
        let bestD = 1.9;
        for (const [id, v] of views) {
          if (id === from) continue;
          const d = v.home.distanceTo(new Vector3(dragPos.x, v.home.y, dragPos.z));
          if (d < bestD) {
            bestD = d;
            best = id;
          }
        }
        if (best !== null) emit({ t: 'merge', from, to: best });
      }
    },
    screenPos(_s, id) {
      const v = views.get(id);
      if (!v) return null;
      const p = v.group.position.clone().project(world.camera);
      return { x: p.x, y: p.y };
    },
    setCursor(id, held) {
      cursorId = id;
      heldId = held;
    },
    setGlow(id) {
      glowId = id;
    },
    dispose() {
      disposeTree(root);
    },
  };
}
