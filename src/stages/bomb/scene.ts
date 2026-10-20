/** ① 폭탄 해체반 diorama: workbench, toy bomb with N, striped/dotted wires; defuse → gift box (signature). */

import { color, float, fract, mix, step, uv } from 'three/tsl';
import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  TubeGeometry,
  Vector3,
} from 'three/webgpu';
import { HitStop, Shake, Spring, squashScale } from '../../engine/fx/juice';
import { ball, capsule, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE, PLACE_COLORS } from '../../engine/palette';
import { addOutline, toyMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { baseDiorama, disposeTree, hitId, hitSphere, stageCamera } from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import { type BombAction, type BombState, DEFUSE_TICKS } from './rules';

// green and blue are reserved for place value (일·십) — wires use other hues + patterns
export const WIRE_COLORS = ['#ff6f91', '#ffc93c', '#a77bff', '#ff9a52', '#c98a5c', '#ff8fd0'];

/** Wire material: colour + pattern (solid / stripes / dots) so colour is never the only cue (P9). */
function wireMaterial(hex: string, pattern: number) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.45 });
  const base = color(new Color(hex));
  const light = color(new Color('#ffffff'));
  if (pattern === 1) m.colorNode = mix(base, light, step(0.5, fract(uv().x.mul(18))).mul(0.55));
  else if (pattern === 2)
    m.colorNode = mix(
      base,
      light,
      step(0.75, fract(uv().x.mul(30)))
        .mul(step(0.5, fract(uv().y.mul(2))))
        .mul(0.7),
    );
  else m.colorNode = base;
  m.emissiveNode = base.mul(float(0.08));
  return m;
}

interface WireView {
  whole: Mesh;
  stubA: Mesh;
  stubB: Mesh;
  label: NumberLabel;
  post: Mesh;
  proxy: Mesh;
  end: Vector3;
}

export function createBombScene(world: RenderWorld, ctx: StageCtx): StageScene<BombState, BombAction> {
  const root = new Group();
  root.name = 'stage-bomb';
  world.scene.add(root);
  stageCamera(world, 13, 6.6, 42, 2.2);
  root.add(baseDiorama(PALETTE.lavender, 7));
  const bench = new Mesh(roundedBox(11, 0.6, 7, 0.25), toyMaterial('#e8c9a0'));
  bench.position.y = 0.3;
  bench.receiveShadow = true;
  root.add(bench);

  const bombG = new Group();
  bombG.position.set(0, 2.05, -1.6);
  const bomb = new Mesh(ball(1.25), toyMaterial('#5b5f8f', { rimStrength: 0.35 }));
  bomb.castShadow = true;
  addOutline(bomb, 0.04);
  const cap = new Mesh(new CylinderGeometry(0.35, 0.4, 0.4, 16), toyMaterial('#8a8fb8'));
  cap.position.y = 1.25;
  const fuse = new Mesh(capsule(0.06, 0.6), toyMaterial(PALETTE.cocoa));
  fuse.position.set(0.25, 1.65, 0);
  fuse.rotation.z = -0.5;
  bombG.add(bomb, cap, fuse);
  root.add(bombG);
  const gift = new Group();
  const box = new Mesh(roundedBox(1.8, 1.6, 1.8, 0.2), toyMaterial(PALETTE.berry));
  const ribbonA = new Mesh(roundedBox(0.3, 1.65, 1.85, 0.05), toyMaterial(PALETTE.sun));
  const ribbonB = new Mesh(roundedBox(1.85, 1.65, 0.3, 0.05), toyMaterial(PALETTE.sun));
  const bow = new Mesh(ball(0.3), toyMaterial(PALETTE.sun));
  bow.position.y = 0.95;
  gift.add(box, ribbonA, ribbonB, bow);
  gift.position.copy(bombG.position);
  gift.scale.setScalar(0.001);
  root.add(gift);
  const label = new NumberLabel(0, { size: 1.1, placeColors: true });
  label.position.set(0, 2.2, -0.15);
  root.add(label);

  const wires = new Map<number, WireView>();
  const proxies: Mesh[] = [];
  let puzzleRef: BombState['puzzle'] = null;
  const spring = new Spring(0, 160, 8);
  const hitStop = new HitStop();
  const shake = new Shake(!ctx.reducedMotion && ctx.shakeIntensity > 0);
  let cursorId: number | null = null;
  let glowId: number | null = null;
  let giftT = 0;
  let slowmo = 0;
  let t = 0;

  const build = (s: BombState) => {
    for (const w of wires.values()) for (const m of [w.whole, w.stubA, w.stubB, w.post]) disposeTree(m);
    for (const w of wires.values()) w.label.removeFromParent();
    wires.clear();
    proxies.length = 0;
    const p = s.puzzle;
    if (!p) return;
    label.set(p.target);
    const n = p.wires.length;
    p.wires.forEach((w, i) => {
      const x = (i - (n - 1) / 2) * Math.min(1.5, 9 / n);
      const start = new Vector3((i - (n - 1) / 2) * 0.35, 1.3, -0.9);
      const end = new Vector3(x, 0.75, 2.4);
      const curve = new CatmullRomCurve3([
        start,
        new Vector3((start.x + end.x) / 2, 1.6 + (i % 2) * 0.4, 0.6),
        end,
      ]);
      const mat = wireMaterial(WIRE_COLORS[w.color] ?? '#ffffff', w.pattern);
      const whole = new Mesh(new TubeGeometry(curve, 40, 0.11, 10), mat);
      whole.castShadow = true;
      const stubCurveA = new CatmullRomCurve3(curve.getPoints(20).slice(0, 8));
      const stubCurveB = new CatmullRomCurve3(curve.getPoints(20).slice(13));
      const stubA = new Mesh(new TubeGeometry(stubCurveA, 12, 0.11, 10), mat);
      const stubB = new Mesh(new TubeGeometry(stubCurveB, 12, 0.11, 10), mat);
      stubA.visible = stubB.visible = false;
      const groupColor =
        w.group !== undefined ? (PLACE_COLORS[Math.min(3, w.group)] as string) : PALETTE.peach;
      const post = new Mesh(roundedBox(0.9, 0.5, 0.7, 0.12), toyMaterial(groupColor));
      post.position.set(end.x, 0.85, end.z + 0.2);
      post.castShadow = true;
      addOutline(post, 0.03);
      const lab = new NumberLabel(w.value, { size: 0.6, placeColors: true });
      lab.position.set(end.x, 1.65, end.z + 0.4);
      const proxy = hitSphere(0.8, w.id);
      proxy.position.copy(curve.getPoint(0.75));
      proxies.push(proxy);
      root.add(whole, stubA, stubB, post, lab, proxy);
      wires.set(w.id, { whole, stubA, stubB, label: lab, post, proxy, end });
    });
  };

  return {
    sync(state, prev, dt) {
      const vdt = hitStop.filter(dt) * (slowmo > 0 ? 0.25 : 1);
      slowmo = Math.max(0, slowmo - dt);
      t += vdt;
      if (state.puzzle !== puzzleRef) {
        puzzleRef = state.puzzle;
        build(state);
        giftT = 0;
      }
      if (prev && state.cut.length > prev.cut.length) {
        audio.play('snip', { pitch: 1 + state.cut.length * 0.08 });
        hitStop.trigger(35);
      }
      if (prev && prev.phase !== 'defuse' && state.phase === 'defuse') {
        slowmo = 0.3; // signature: 0.3 s slow motion on the last snip, then gift box
        audio.play('gift', { delay: 0.3 });
        audio.play('correct.big', { delay: 0.45 });
        celebrate(
          world,
          { x: 0, y: 3, z: -1.6 },
          state.core.streak,
          !!state.core.asked?.question.tags.includes('SIX_SEVEN'),
        );
      }
      if (prev && prev.phase !== 'puff' && state.phase === 'puff') {
        audio.play('wrong.duck');
        spring.impulse(9);
        shake.add(0.5 * ctx.shakeIntensity);
        world.particles.emit('confetti', { x: 0, y: 2.5, z: -1.6 }, 70);
      }
      for (const [id, w] of wires) {
        const cut = state.cut.includes(id) || state.phase === 'defuse';
        w.whole.visible = !cut;
        w.stubA.visible = w.stubB.visible = cut;
        const lift = cursorId === id && !cut ? 0.15 + Math.sin(t * 6) * 0.06 : 0;
        w.label.position.y = 1.65 + lift;
        const glow = glowId === id && !cut ? 1 + Math.abs(Math.sin(t * 4)) * 0.25 : 1;
        w.post.scale.setScalar((cursorId === id ? 1.12 : 1) * glow);
        if (glow > 1 && Math.floor(t * 6) % 4 === 0) world.particles.emit('sparkle', w.post.position, 2);
      }
      // bomb puff / defuse
      const s = squashScale(spring.update(vdt) * 0.08);
      const breathe = ctx.reducedMotion ? 1 : 1 + Math.sin(t * 2) * 0.015;
      if (state.phase === 'defuse') {
        giftT = Math.min(1, giftT + vdt / (DEFUSE_TICKS / 60 / 2));
        bombG.scale.setScalar(Math.max(0.001, 1 - giftT));
        gift.scale.setScalar(Math.max(0.001, giftT * (1 + Math.sin(giftT * Math.PI) * 0.15)));
        label.visible = giftT < 0.5;
      } else {
        bombG.scale.set(s.x * breathe, s.y * breathe, s.z * breathe);
        gift.scale.setScalar(0.001);
        label.visible = true;
      }
      if (!ctx.reducedMotion && Math.floor(t * 8) % 3 === 0)
        world.particles.emit('sparkle', { x: 0.55, y: 3.95, z: -1.6 }, 1);
      const sh = shake.update(dt);
      world.camera.position.x = sh.x;
      world.camera.position.y = 6.6 + sh.y;
    },
    pointer(p: PointerInfo, _state, emit) {
      if (p.type !== 'down') return;
      const id = hitId(proxies, p.raycaster);
      if (id !== null) emit({ t: 'cut', id });
    },
    screenPos(_s, id) {
      const w = wires.get(id);
      if (!w) return null;
      const v = w.proxy.position.clone().project(world.camera);
      return { x: v.x, y: v.y };
    },
    setCursor(id) {
      cursorId = id;
    },
    setGlow(id) {
      glowId = id;
    },
    dispose() {
      for (const w of wires.values()) w.label.removeFromParent();
      disposeTree(root);
    },
  };
}
