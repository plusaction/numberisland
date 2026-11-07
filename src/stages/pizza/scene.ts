/**
 * ⑥ 피자 가게 둘이서 diorama: a toy pizza shop — striped awning, string lights, a brick oven, a conveyor to
 * the packing table, the front counter where numbers lie as pizza (a box = ten slices, a slice = one), and
 * three big pizza keys in front.
 *
 * One order, start to finish:
 * - enter: the customer bounces in through the side door (the VIP walks a red carpet in a crown).
 * - play: bake = two piles (🍄 a, 🧀 b) on the counter; pack = the box with b slices, the customer wants a.
 * - jam (wrong key): bake → the oven coughs smoke and spits out a burnt pizza with a silly face; pack → the
 *   box spills. The key dims; nothing is lost.
 * - serve: bake → the piles slide together, the dough is tossed, into the oven, *ding*, along the conveyor,
 *   피자랑 boxes it; pack → 피자랑 bakes, the missing slices hop one by one into the box (counting up), the lid
 *   shuts. Then the box slides to the customer (a happy bite, hearts) and 피자랑 and a big glove HIGH-FIVE.
 */
import { Group, InstancedMesh, Mesh, Object3D, Vector3 } from 'three/webgpu';
import { HitStop, Shake, Spring } from '../../engine/fx/juice';
import { ball, capsule, disc, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { toyMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { baseDiorama, disposeTree, hitCylinder, hitId, stageCamera } from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import {
  boxModel,
  COLORS,
  crownModel,
  customerModel,
  keyModel,
  type Monster,
  NumberPile,
  ovenModel,
  partnerModel,
  pizzaModel,
} from './props';
import { ENTER_TICKS, KEY, KEYS, type Order, type PizzaAction, type PizzaState, SERVE_TICKS } from './rules';

const WALL_Z = -3.2;
const COUNTER = { z: 0.7, top: 1.15 };
const OVEN = new Vector3(-2.7, 0.3, -1.9);
const MOUTH = new Vector3(-2.7, 1.45, -0.95);
const PACK = new Vector3(2.9, 1.2, -1.3);
const SPOT = new Vector3(-4.0, 0.3, 1.1); // where the customer stands
const DOOR = new Vector3(-7.2, 0.3, 1.0);
const PARTNER_HOME = new Vector3(3.95, 0.3, -0.2);
const FIVE_AT = new Vector3(1.3, 0.9, 1.9); // 피자랑 hops here for the high-five
const KEY_X = [-1.7, 0, 1.7];
const KEY_Y = 0.75;
const KEY_Z = 2.9;
const PILE_A = new Vector3(-1.75, COUNTER.top, COUNTER.z);
const PILE_B = new Vector3(1.15, COUNTER.top, COUNTER.z);
const CAM = { z: 11.6, y: 6.6, lookY: 1.3 };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
/** 0..1 inside [a, b] of the serve timeline. */
const seg = (k: number, a: number, b: number) => clamp01((k - a) / (b - a));

export function createPizzaScene(world: RenderWorld, ctx: StageCtx): StageScene<PizzaState, PizzaAction> {
  const root = new Group();
  root.name = 'stage-pizza';
  world.scene.add(root);
  stageCamera(world, CAM.z, CAM.y, 42, CAM.lookY);
  root.add(baseDiorama(PALETTE.cream, 7.4));
  const reduced = ctx.reducedMotion;

  // ── shop shell: tiled floor, back wall, side wall with the door, awning, string lights, rating stars
  const floor = new Mesh(roundedBox(11, 0.3, 7.2, 0.12), toyMaterial('#f7dcb4', { finish: 'satin' }));
  floor.position.set(0, 0.15, -0.3);
  floor.receiveShadow = true;
  const back = new Mesh(roundedBox(11, 4.4, 0.3, 0.1), toyMaterial('#fff1d9', { finish: 'matte' }));
  back.position.set(0, 2.35, WALL_Z - 0.15);
  back.receiveShadow = true;
  const wainscot = new Mesh(roundedBox(11, 1.0, 0.36, 0.08), toyMaterial('#7cc6a4', { finish: 'satin' }));
  wainscot.position.set(0, 0.8, WALL_Z - 0.05);
  root.add(floor, back, wainscot);
  for (let i = 0; i < 11; i++) {
    const stripe = new Mesh(
      roundedBox(0.98, 0.6, 0.5, 0.12),
      toyMaterial(i % 2 ? PALETTE.white : COLORS.stripe, { finish: 'satin' }),
    );
    stripe.position.set(-5 + i, 4.3, WALL_Z + 0.25);
    stripe.rotation.x = 0.35;
    stripe.castShadow = true;
    root.add(stripe);
  }
  const bulbs: Mesh[] = [];
  const bulbColors = [PALETTE.sun, PALETTE.berry, '#2fb4cc', '#7ee08a'];
  for (let i = 0; i < 14; i++) {
    const b = new Mesh(ball(0.09, 10), toyMaterial(bulbColors[i % 4] as string, { rimStrength: 1 }));
    const x = -5 + (i / 13) * 10;
    b.position.set(x, 3.75 - Math.sin((i / 13) * Math.PI * 3) ** 2 * 0.25, WALL_Z + 0.35);
    bulbs.push(b);
    root.add(b);
  }
  // a pizza sign on the wall + the shop rating: five stars that light up order by order
  const sign = pizzaModel(0.9);
  sign.rotation.x = Math.PI / 2;
  sign.position.set(0.2, 2.75, WALL_Z + 0.12);
  root.add(sign);
  const starsOff: NumberLabel[] = [];
  const starsOn: NumberLabel[] = [];
  for (let i = 0; i < 5; i++) {
    const off = new NumberLabel('★', { size: 0.42, tint: '#cfc6dc', badge: false });
    const on = new NumberLabel('★', { size: 0.5, tint: '#f2b632', badge: false });
    for (const l of [off, on]) l.position.set(1.7 + i * 0.55, 2.75, WALL_Z + 0.3);
    on.visible = false;
    starsOff.push(off);
    starsOn.push(on);
    root.add(off, on);
  }
  // side door the customers come through
  const doorWood = woodMaterial('#8a5a3c');
  for (const z of [0.05, 1.95]) {
    const post = new Mesh(roundedBox(0.3, 3.0, 0.3, 0.08), doorWood);
    post.position.set(-5.5, 1.8, z);
    post.castShadow = true;
    root.add(post);
  }
  const lintel = new Mesh(roundedBox(0.36, 0.34, 2.3, 0.08), doorWood);
  lintel.position.set(-5.5, 3.3, 1.0);
  root.add(lintel);
  const carpet = new Mesh(roundedBox(3.6, 0.04, 1.1, 0.03), toyMaterial('#d8304a', { finish: 'matte' }));
  carpet.position.set(-5.4, 0.32, 1.0);
  carpet.visible = false;
  root.add(carpet);

  // ── oven, conveyor (moving slats), packing table
  const oven = ovenModel();
  oven.group.position.copy(OVEN);
  root.add(oven.group);
  const belt = new Mesh(roundedBox(4.4, 0.16, 0.9, 0.06), toyMaterial('#4b4f63', { finish: 'satin' }));
  belt.position.set(0.25, 1.0, -1.3);
  const beltLegs = new Mesh(roundedBox(4.2, 0.7, 0.6, 0.05), toyMaterial('#9aa3b5', { finish: 'satin' }));
  beltLegs.position.set(0.25, 0.6, -1.3);
  root.add(belt, beltLegs);
  const SLATS = 10;
  const slats = new InstancedMesh(roundedBox(0.12, 0.04, 0.86, 0.02), toyMaterial('#c8cede'), SLATS);
  root.add(slats);
  const packTable = new Mesh(roundedBox(1.9, 0.9, 1.6, 0.08), woodMaterial('#c98a5c'));
  packTable.position.set(PACK.x, 0.75, PACK.z);
  packTable.castShadow = packTable.receiveShadow = true;
  root.add(packTable);

  // ── front counter with the work area, and the key board in front
  const counter = new Mesh(roundedBox(6.2, 0.85, 1.7, 0.1), woodMaterial('#d79a62'));
  counter.position.set(-0.2, 0.72, COUNTER.z);
  counter.castShadow = counter.receiveShadow = true;
  const counterTop = new Mesh(roundedBox(6.4, 0.08, 1.8, 0.04), toyMaterial('#fff7ea', { finish: 'satin' }));
  counterTop.position.set(-0.2, COUNTER.top + 0.0, COUNTER.z);
  counterTop.receiveShadow = true;
  root.add(counter, counterTop);
  const pileA = new NumberPile(1.15);
  const pileB = new NumberPile(1.15);
  pileA.label.position.set(0.2, 1.15, 0.45);
  pileB.label.position.set(0.2, 1.15, 0.45);
  pileA.group.position.copy(PILE_A);
  pileB.group.position.copy(PILE_B);
  const sign2 = new NumberLabel('+', { size: 0.55, tint: PALETTE.ink });
  sign2.position.set(-0.15, COUNTER.top + 0.75, COUNTER.z + 0.5);
  root.add(pileA.group, pileB.group, sign2);
  // the box being filled (pack) / closed (both): an open tray + a hinged lid
  const tray = new Mesh(roundedBox(1.9, 0.12, 1.5, 0.04), toyMaterial(COLORS.box, { finish: 'matte' }));
  tray.position.set(-0.2, COUNTER.top + 0.06, COUNTER.z);
  tray.receiveShadow = true;
  root.add(tray);
  const board = new Mesh(roundedBox(5.6, 0.3, 1.4, 0.1), woodMaterial('#a86f45'));
  board.position.set(0, 0.45, KEY_Z);
  board.receiveShadow = true;
  root.add(board);
  const keys: { group: Group; top: Mesh; label: NumberLabel; spring: Spring; proxy: Mesh }[] = [];
  const keyTop = toyMaterial(COLORS.cheese);
  const keyTopDim = toyMaterial('#d9d2c4', { finish: 'matte' });
  for (let i = 0; i < KEYS; i++) {
    const k = keyModel();
    k.group.position.set(KEY_X[i] as number, KEY_Y, KEY_Z);
    k.group.rotation.x = 0.55;
    const label = new NumberLabel(0, { size: 0.62, placeColors: true });
    label.position.set(0, 0.5, 0.15);
    k.group.add(label);
    const proxy = hitCylinder(0.75, 0.8, KEY(i));
    k.group.add(proxy);
    root.add(k.group);
    keys.push({ group: k.group, top: k.top, label, spring: new Spring(0, 240, 12), proxy });
  }

  // ── the travelling pizza / box, the burnt pizza, partner, glove, customer
  const hero = pizzaModel(0.8);
  hero.visible = false;
  root.add(hero);
  const heroBox = boxModel();
  heroBox.scale.setScalar(1.25);
  heroBox.visible = false;
  root.add(heroBox);
  const burnt = new Group();
  const burntDisc = new Mesh(disc(0.55, 0.1, 28), toyMaterial('#4a2a1c', { finish: 'matte' }));
  burnt.add(burntDisc);
  for (const x of [-0.18, 0.18]) {
    const eye = new Mesh(ball(0.12, 12), toyMaterial(PALETTE.white));
    eye.position.set(x, 0.08, 0.1);
    const pupil = new Mesh(ball(0.05, 8), toyMaterial(PALETTE.ink));
    pupil.position.set(x, 0.12, 0.2);
    burnt.add(eye, pupil);
  }
  burnt.rotation.x = Math.PI / 2 - 0.3;
  burnt.visible = false;
  root.add(burnt);
  const partner = partnerModel();
  partner.group.position.copy(PARTNER_HOME);
  partner.group.rotation.y = -0.5;
  root.add(partner.group);
  const glove = new Group();
  const palm = new Mesh(ball(0.42, 24), toyMaterial(PALETTE.white, { finish: 'satin' }));
  palm.scale.set(1, 1.1, 0.6);
  const cuff = new Mesh(capsule(0.3, 0.5), toyMaterial('#2fb4cc', { finish: 'satin' }));
  cuff.position.y = -0.7;
  glove.add(palm, cuff);
  for (let f = 0; f < 4; f++) {
    const finger = new Mesh(capsule(0.09, 0.28), toyMaterial(PALETTE.white, { finish: 'satin' }));
    finger.position.set(-0.27 + f * 0.18, 0.5, 0);
    glove.add(finger);
  }
  glove.visible = false;
  root.add(glove);

  let customer: Monster | null = null;
  let crown: Group | null = null;
  const bubble = new NumberLabel('?', { size: 0.5, placeColors: true });
  root.add(bubble);

  let orderRef: Order | null = null;
  const hitStop = new HitStop();
  const shake = new Shake(!reduced && ctx.shakeIntensity > 0);
  const pileSpring = new Spring(0, 200, 9);
  const custSpring = new Spring(0, 180, 9);
  const partnerSpring = new Spring(0, 180, 9);
  let cursorId: number | null = null;
  let glowId: number | null = null;
  let t = 0;
  let burntT = -1;
  let counted = 0;
  const fired = new Set<string>();
  const tmp = new Vector3();
  const tmp2 = new Vector3();
  const dummy = new Object3D();
  const once = (id: string, fn: () => void) => {
    if (fired.has(id)) return;
    fired.add(id);
    fn();
  };

  const build = (o: Order) => {
    if (customer) disposeTree(customer.group);
    if (crown) crown = null;
    customer = customerModel(o.customer);
    customer.group.position.copy(DOOR);
    root.add(customer.group);
    if (o.vip) {
      crown = crownModel();
      crown.position.set(0, 1.55, 0);
      customer.group.add(crown);
    }
    carpet.visible = o.vip;
    fired.clear();
    counted = 0;
    burntT = -1;
    hero.visible = heroBox.visible = glove.visible = false;
    pileA.group.position.copy(PILE_A);
    pileB.group.position.copy(PILE_B);
    if (o.role === 'bake') {
      pileA.set(o.a);
      pileB.set(o.b);
      pileA.group.visible = pileB.group.visible = sign2.visible = true;
      tray.visible = false;
      pileA.group.position.copy(PILE_A);
    } else {
      // pack: the box on the counter already holds b slices; the customer asked for a
      pileA.set(o.b);
      pileA.group.position.set(-0.2, COUNTER.top + 0.1, COUNTER.z);
      pileA.group.visible = tray.visible = true;
      pileB.group.visible = sign2.visible = false;
    }
    bubble.set(o.role === 'pack' ? o.a : '?');
  };

  /** The serve show, k = 0..1 over SERVE_TICKS. */
  const serve = (o: Order, k: number, streak: number, sixSeven: boolean) => {
    const bake = o.role === 'bake';
    const deliverFrom = bake ? 0.62 : 0.5;
    if (bake) {
      // the two piles slide together into one
      const m = ease(seg(k, 0, 0.1));
      pileA.group.position.lerpVectors(PILE_A, tmp.set(-0.2, COUNTER.top, COUNTER.z), m);
      pileB.group.position.lerpVectors(PILE_B, tmp.set(-0.2, COUNTER.top, COUNTER.z), m);
      if (k >= 0.1)
        once('merge', () => {
          pileB.group.visible = sign2.visible = false;
          pileA.set(o.answer);
          pileSpring.impulse(8);
          audio.play('merge');
          world.particles.emit('sparkle', tmp.set(-0.2, COUNTER.top + 1, COUNTER.z), 24);
        });
      // dough toss → into the oven → ding → along the belt to the packing table
      if (k >= 0.14) {
        once('toss', () => {
          hero.visible = true;
          audio.play('pizza.toss');
        });
        const u = seg(k, 0.14, 0.3);
        const v = ease(seg(k, 0.3, 0.4));
        const w = ease(seg(k, 0.44, 0.58));
        if (k < 0.3) {
          hero.position.set(-0.2, COUNTER.top + 0.9 + (reduced ? 0 : Math.sin(u * Math.PI) * 1.8), COUNTER.z);
          hero.rotation.set(reduced ? 0 : Math.sin(u * Math.PI) * 0.5, u * Math.PI * 6, 0);
        } else if (k < 0.44) {
          hero.position.lerpVectors(tmp.set(-0.2, COUNTER.top + 0.9, COUNTER.z), MOUTH, v);
          hero.rotation.set(0, 0, 0);
          hero.scale.setScalar(0.8 - v * 0.2);
        } else {
          hero.scale.setScalar(0.8);
          hero.position.lerpVectors(tmp.set(-1.7, 1.2, -1.3), tmp2.set(PACK.x, PACK.y + 0.1, PACK.z), w);
        }
        if (k >= 0.4)
          once('ding', () => {
            audio.play('pizza.ding');
            world.particles.emit('sparkle', MOUTH, 30);
            oven.fire.scale.setScalar(1.6);
          });
      }
      if (k >= 0.56)
        once('boxit', () => {
          partnerSpring.impulse(10);
        });
    } else {
      // 피자랑 bakes (arm toss + ding), then the missing slices hop into the box, counting up
      if (k >= 0.02)
        once('pbake', () => {
          partnerSpring.impulse(8);
          audio.play('pizza.toss');
        });
      if (k >= 0.1) once('pding', () => audio.play('pizza.ding'));
      const tens = Math.floor(o.answer / 10);
      const steps = tens + (o.answer % 10);
      const want = Math.min(steps, Math.floor(seg(k, 0.12, 0.42) * (steps + 0.999)));
      while (counted < want) {
        counted++;
        const add = counted <= tens ? 10 : 1;
        const now = pileA.value + add;
        pileA.set(now);
        pileSpring.impulse(4);
        audio.play('pop', { pitch: 1 + Math.min(counted, 12) * 0.06 });
        world.particles.emit('sparkle', tmp.set(-0.2, COUNTER.top + 0.8, COUNTER.z), 6);
      }
      // a slice flying from the oven to the box (one at a time, purely decorative)
      if (k >= 0.12 && k < 0.42) {
        hero.visible = true;
        const f = (seg(k, 0.12, 0.42) * (steps + 0.999)) % 1;
        hero.scale.setScalar(0.35);
        hero.position.lerpVectors(MOUTH, tmp.set(-0.2, COUNTER.top + 0.3, COUNTER.z), f);
        hero.position.y += reduced ? 0 : Math.sin(f * Math.PI) * 1.4;
      } else if (k >= 0.42) {
        hero.visible = false;
      }
    }
    // the lid shuts over the pizza (bake: at the packing table; pack: on the counter)
    const lidAt = bake ? 0.58 : 0.44;
    const from = bake
      ? tmp2.set(PACK.x, PACK.y + 0.15, PACK.z)
      : tmp2.set(-0.2, COUNTER.top + 0.15, COUNTER.z);
    if (k >= lidAt) {
      once('lid', () => {
        heroBox.visible = true;
        hero.visible = false;
        if (!bake) pileA.group.visible = tray.visible = false;
        audio.play('pizza.box');
        world.particles.emit('dust', from, 10);
      });
      const d = ease(seg(k, deliverFrom, deliverFrom + 0.16));
      const to = tmp
        .copy(SPOT)
        .setY(1.2)
        .setX(SPOT.x + 0.9);
      heroBox.position.lerpVectors(from, to, d);
      heroBox.position.y += reduced ? 0 : Math.sin(d * Math.PI) * 1.2;
      heroBox.rotation.y = d * Math.PI * 2;
      const pop = seg(k, lidAt, lidAt + 0.04);
      heroBox.scale.setScalar(1.25 * (0.4 + 0.6 * ease(pop)) * (d >= 1 ? 1 - ease(seg(k, 0.84, 0.9)) : 1));
    }
    // the customer gets it: a happy hop, hearts, a cheer
    if (k >= deliverFrom + 0.16)
      once('got', () => {
        custSpring.impulse(10);
        bubble.set(o.answer);
        audio.play('correct.big');
        world.particles.emit('sparkle', tmp.copy(SPOT).setY(2.2), 40);
        world.particles.emit('confetti', tmp.copy(SPOT).setY(2.4), 50);
        if (o.vip) audio.play('levelup', { delay: 0.2 });
      });
    // high-five! 피자랑 hops to the front, the glove comes up from below
    const h = ease(seg(k, 0.78, 0.86));
    const back2 = ease(seg(k, 0.94, 1));
    if (k >= 0.76) {
      partner.group.position.lerpVectors(PARTNER_HOME, FIVE_AT, h * (1 - back2));
      if (!reduced) partner.group.position.y += Math.sin(h * Math.PI) * 0.8;
      partner.group.rotation.y = -0.5 * (1 - h) + 0.3 * h;
      partner.arm.rotation.z = -0.4 - h * 2.2 * (1 - back2);
      glove.visible = k < 0.97;
      glove.position.set(0.25, -0.6 + h * 3.0 - back2 * 3.3, 3.7);
      glove.rotation.set(-0.5, 0, -0.35);
    }
    if (k >= 0.86)
      once('five', () => {
        audio.play('pizza.five');
        hitStop.trigger(70);
        shake.add(0.25 * ctx.shakeIntensity);
        world.particles.emit('sparkle', tmp.set(0.55, 2.4, 3.1), 50);
        celebrate(world, { x: 0.55, y: 2.4, z: 3.1 }, streak, sixSeven);
      });
    // the customer waves goodbye and leaves through the door
    if (customer && k >= 0.9) {
      const l = ease(seg(k, 0.9, 1));
      customer.group.position.lerpVectors(SPOT, DOOR, l);
      customer.group.rotation.y = (-Math.PI / 2) * l + 0.6 * (1 - l);
    }
  };

  return {
    sync(state, prev, dt) {
      const vdt = hitStop.filter(dt);
      t += vdt;
      const o = state.order;
      // 피자랑 stands at home unless the serve show moves it (set fresh every frame)
      partner.group.position.copy(PARTNER_HOME);
      partner.group.rotation.y = -0.5;
      partner.arm.rotation.z = -0.4 + (reduced ? 0 : Math.sin(t * 1.7) * 0.15);
      if (o && o !== orderRef) {
        // a retry swaps the numbers but keeps the same customer standing
        const same = !!orderRef && orderRef.customer === o.customer && state.phase !== 'enter';
        orderRef = o;
        const at = customer?.group.position.clone();
        build(o);
        if (same && at && customer) customer.group.position.copy(at);
      }
      // customer: walks in on enter, bobs while waiting
      if (customer && o) {
        const c = customer.group;
        if (state.phase === 'enter') {
          const w = ease(1 - state.phaseLeft / ENTER_TICKS);
          c.position.lerpVectors(DOOR, SPOT, w);
          if (!reduced) c.position.y = SPOT.y + Math.abs(Math.sin(w * Math.PI * 5)) * 0.35;
          c.rotation.y = (Math.PI / 2) * (1 - w) + 0.6 * w;
          if (o.vip && !reduced && Math.floor(t * 10) % 2 === 0)
            world.particles.emit('sparkle', tmp.copy(c.position).setY(1.8), 2);
        } else if (state.phase !== 'serve') {
          c.position.x = SPOT.x;
          c.position.z = SPOT.z;
          c.rotation.y = 0.6;
          c.position.y = SPOT.y + (reduced ? 0 : Math.abs(Math.sin(t * 2.2)) * 0.06);
        }
        const cs = custSpring.update(vdt);
        c.scale.set(1 - cs * 0.04, 1 + cs * 0.07, 1 - cs * 0.04);
        c.rotation.z = state.phase === 'jam' && !reduced ? Math.sin(t * 9) * 0.12 : 0;
        customer.arm.rotation.z = -0.4 + (reduced ? 0 : Math.sin(t * 3) * 0.25);
        bubble.position.set(c.position.x, c.position.y + 2.15, c.position.z);
        bubble.visible = state.phase !== 'enter' || state.phaseLeft < ENTER_TICKS * 0.35;
        if (!reduced) bubble.position.y += Math.sin(t * 2.5) * 0.06;
      }
      // wrong key: funny breakdowns
      if (prev && prev.phase !== 'jam' && state.phase === 'jam' && o) {
        audio.play('wrong.boing');
        shake.add(0.2 * ctx.shakeIntensity);
        custSpring.impulse(-6);
        if (o.role === 'bake') {
          audio.play('pizza.puff', { delay: 0.05 });
          world.particles.emit('dust', MOUTH, 30);
          world.particles.emit('dust', tmp.set(-2.25, 2.8, -2.1), 20);
          burntT = 0;
        } else {
          audio.play('wrong.pfft', { delay: 0.1 });
          pileSpring.impulse(-14);
          world.particles.emit('dust', tmp.set(-0.2, COUNTER.top + 0.4, COUNTER.z), 18);
        }
      }
      if (burntT >= 0) {
        burntT += vdt;
        const b = clamp01(burntT / 1.1);
        burnt.visible = b < 1;
        const out = Math.sin(b * Math.PI);
        burnt.position.set(MOUTH.x, MOUTH.y + (reduced ? 0 : out * 0.5), MOUTH.z + out * 0.9);
        burnt.rotation.z = reduced ? 0 : Math.sin(burntT * 14) * 0.2;
        if (b >= 1) burntT = -1;
      }
      // serve show
      if (o && state.phase === 'serve') {
        const k = 1 - state.phaseLeft / SERVE_TICKS;
        serve(o, k, state.core.streak, !!state.core.asked?.question.tags.includes('SIX_SEVEN'));
      } else {
        glove.visible = false;
      }
      // piles wobble, partner squash, oven fire flicker, belt slats, lights, rating stars
      const ps = pileSpring.update(vdt);
      pileA.group.scale.set(1 - ps * 0.03, 1 + ps * 0.06, 1 - ps * 0.03);
      const pp = partnerSpring.update(vdt);
      partner.body.scale.set(1 - pp * 0.04, 0.95 + pp * 0.07, 0.95 - pp * 0.04);
      if (!reduced) partner.group.position.y += Math.abs(Math.sin(t * 2)) * 0.04;
      const flick = reduced ? 1 : 1 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.04;
      const fs = oven.fire.scale.x;
      oven.fire.scale.setScalar(Math.max(flick, fs + (flick - fs) * (1 - Math.exp(-vdt * 4))));
      if (!reduced && Math.floor(t * 4) % 3 === 0)
        world.particles.emit('dust', tmp.set(OVEN.x + 0.45, 2.75, OVEN.z - 0.2), 1);
      const run = state.phase === 'serve' ? 1.2 : 0.35;
      for (let i = 0; i < SLATS; i++) {
        const x = -1.9 + (((i / SLATS) * 4.3 + (reduced ? 0 : t * run)) % 4.3);
        dummy.position.set(x, 1.1, -1.3);
        dummy.updateMatrix();
        slats.setMatrixAt(i, dummy.matrix);
      }
      slats.instanceMatrix.needsUpdate = true;
      bulbs.forEach((b, i) => {
        b.scale.setScalar(reduced ? 1 : 1 + Math.max(0, Math.sin(t * 3 + i * 0.9)) * 0.35);
      });
      const lit =
        state.served + (state.phase === 'serve' && 1 - state.phaseLeft / SERVE_TICKS > 0.86 ? 1 : 0);
      starsOn.forEach((s, i) => {
        const on = i < lit;
        if (on && !s.visible && prev) {
          audio.play('star', { delay: 0.1 });
          world.particles.emit('sparkle', tmp.copy(s.position), 16);
        }
        s.visible = on;
        (starsOff[i] as NumberLabel).visible = !on;
      });
      // keys: numbers, tried ones dim, hover / glow
      keys.forEach((k, i) => {
        const value = o?.options[i];
        if (value !== undefined) k.label.set(value);
        const tried = value !== undefined && state.tried.includes(value);
        const serving = state.phase === 'serve' && value !== o?.answer;
        k.top.material = tried || serving ? keyTopDim : keyTop;
        if (prev && prev.phase === 'play' && state.phase !== 'play' && value !== undefined) {
          const chosen = state.phase === 'serve' ? value === o?.answer : state.tried.at(-1) === value;
          if (chosen) k.spring.impulse(-10);
        }
        const glowing = glowId === KEY(i) ? 1 + Math.abs(Math.sin(t * 4)) * 0.12 : 1;
        const hover = cursorId === KEY(i) ? 1.1 : 1;
        const s = (1 + k.spring.update(vdt) * 0.05) * (tried ? 0.88 : 1) * glowing * hover;
        k.group.scale.setScalar(s);
        if (glowId === KEY(i) && Math.floor(t * 6) % 3 === 0)
          world.particles.emit('sparkle', tmp.copy(k.group.position).setY(KEY_Y + 0.6), 2);
      });
      // camera: a gentle push-in while the customer walks in
      let push = 0;
      if (!reduced && state.phase === 'enter') push = 1 - ease((1 - state.phaseLeft / ENTER_TICKS) * 1.2);
      const sh = shake.update(dt);
      // narrow (portrait) screens: back off until the shop's width (door to 피자랑) fits
      const halfH = Math.tan(((world.camera.fov / 2) * Math.PI) / 180);
      const fit = Math.min(1.25, Math.max(1, 5.6 / (halfH * world.camera.aspect) / CAM.z));
      world.camera.position.set(
        sh.x - push * 1.2,
        (CAM.y + push * 0.6) * fit + sh.y,
        (CAM.z + push * 1.5) * fit,
      );
      world.camera.lookAt(-push * 1.5, CAM.lookY, 0);
    },
    pointer(p: PointerInfo, state, emit) {
      if (p.type !== 'down' || state.phase !== 'play') return;
      const id = hitId(
        keys.map((k) => k.proxy),
        p.raycaster,
      );
      if (id !== null && id >= KEY(0)) emit({ t: 'pick', id });
    },
    screenPos(_s, id) {
      const k = keys[id - KEY(0)];
      if (!k) return null;
      const v = k.group
        .getWorldPosition(tmp)
        .setY(KEY_Y + 0.4)
        .project(world.camera);
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
