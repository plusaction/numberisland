/** ④ 슬라임 합체 diorama: jelly tray, drag-to-merge, overshoot squash on merge (signature). */
import { Group, Mesh, Plane, Vector3 } from 'three/webgpu';
import { HitStop, Shake, Spring, squashScale } from '../../engine/fx/juice';
import { ball, ring, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { addOutline, type JellyMaterial, jellyMaterial, toyMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { baseDiorama, disposeTree, hitId, hitSphere, stageCamera } from '../_shared/diorama';
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

interface SlimeView {
  group: Group;
  body: Mesh;
  jelly: JellyMaterial;
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
  stageCamera(world, 11, 10, 40);
  root.add(baseDiorama(PALETTE.mint, 7.2));
  const tray = new Mesh(roundedBox(11, 0.5, 6.4, 0.4), toyMaterial(PALETTE.lavender));
  tray.position.y = 0.25;
  tray.receiveShadow = true;
  addOutline(tray, 0.04);
  root.add(tray);
  for (let s = 0; s < 8; s++) {
    const pad = new Mesh(roundedBox(1.6, 0.06, 1.6, 0.3), toyMaterial('#d9cdfb'));
    pad.position.copy(SLOT_POS(s)).setY(0.52);
    root.add(pad);
  }

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
  let lastEventTick = -1;
  let t = 0;

  const makeView = (id: number, value: number, minus: boolean, slot: number, colorIdx: number): SlimeView => {
    const g = new Group();
    const jelly = jellyMaterial(minus ? '#ff6b7f' : (COLORS[colorIdx % COLORS.length] as string));
    const body = new Mesh(ball(1, 40), jelly.material);
    body.castShadow = true;
    addOutline(body, 0.035);
    // friendly face: big eyes with highlights, small smile, blush
    const face = new Group();
    for (const x of [-0.28, 0.28]) {
      const eye = new Mesh(ball(0.17, 16), toyMaterial(PALETTE.ink));
      eye.position.set(x, 0.22, 0.86);
      const shine = new Mesh(ball(0.06, 10), toyMaterial(PALETTE.white));
      shine.position.set(x + 0.05, 0.3, 1.0);
      const blush = new Mesh(ball(0.1, 12), toyMaterial('#ff9fb8'));
      blush.position.set(x * 1.55, 0.0, 0.84);
      blush.scale.set(1, 0.6, 0.4);
      face.add(eye, shine, blush);
    }
    const mouth = new Mesh(ring(0.12, 0.03), toyMaterial(PALETTE.ink));
    mouth.position.set(0, -0.05, 0.95);
    mouth.scale.set(1, 0.7, 1);
    face.add(mouth);
    body.add(face);
    const label = new NumberLabel(minus ? `-${value}` : value, {
      size: 0.68,
      placeColors: !minus,
      tint: '#e8505b',
    });
    const proxy = hitSphere(1.15, id);
    g.add(body, label, proxy);
    const home = SLOT_POS(slot);
    g.position.copy(home);
    root.add(g);
    proxies.push(proxy);
    return { group: g, body, jelly, label, proxy, spring: new Spring(0, 180, 9), home, value };
  };

  const rebuild = (s: SlimeState) => {
    for (const v of views.values()) disposeTree(v.group);
    views.clear();
    proxies.length = 0;
    s.slimes.forEach((sl, i) => {
      views.set(sl.id, makeView(sl.id, sl.value, sl.minus, sl.slot, i));
    });
  };

  const syncSlimes = (s: SlimeState) => {
    const ids = new Set(s.slimes.map((x) => x.id));
    for (const [id, v] of views) {
      if (!ids.has(id)) {
        proxies.splice(proxies.indexOf(v.proxy), 1);
        disposeTree(v.group);
        views.delete(id);
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
          audio.play('merge', { pitch: 0.9 + Math.min(0.5, v.value / 200) });
          v.spring.impulse(-7); // big squash → overshoot → settle (signature)
          v.jelly.wobble.value = 1;
          hitStop.trigger(40);
          world.particles.emit('sparkle', v.group.position, 25);
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
        if (w) w.spring.impulse(-9);
        celebrate(
          world,
          w ? w.group.position : { x: 0, y: 2, z: 0 },
          state.core.streak,
          !!state.core.asked?.question.tags.includes('SIX_SEVEN'),
        );
      }
      for (const [id, v] of views) {
        const r = radiusFor(v.value);
        const sq = squashScale(v.spring.update(vdt) * 0.12);
        const breathe = ctx.reducedMotion ? 0 : Math.sin(t * 2.2 + id) * 0.02;
        v.body.scale.set(r * sq.x * (1 - breathe), r * sq.y * (1 + breathe), r * sq.z * (1 - breathe));
        v.jelly.wobble.value *= Math.exp(-vdt * 2.2);
        const target = dragging === id ? dragPos : v.home;
        v.group.position.lerp(target, 1 - Math.exp(-vdt * (dragging === id ? 25 : 10)));
        v.group.position.y =
          (dragging === id ? 1.6 : 0.55 + r) + (cursorId === id || heldId === id ? 0.25 : 0);
        v.label.position.y = r * 1.05 + 0.55;
        if (state.phase === 'win' && state.winner === id && !ctx.reducedMotion)
          v.group.position.y += Math.abs(Math.sin(t * 7)) * 0.4;
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
          audio.play('pop');
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
    dispose() {
      disposeTree(root);
    },
  };
}
