/**
 * ⑤ 이상한 자물쇠 방탈출 diorama: a toy room (back wall + side wall + floor) with five things that may hide a
 * number, and a door with a chunky lock carrying three big number keys.
 * - Things not opened yet wear a bouncing "?" badge. Opening one: a clue number pops out and flies into the
 *   sentence at the top (DOM, `flyToGoal`); the thing keeps a little ★. Empties puff dust.
 * - The lock keys show "?" until every clue is found, then flip to numbers; a wrong key dims and rattles.
 * - Room cut: the camera swoops in at the start of each room. Behind each door is a real passage: when it
 *   opens, its lamps come on one by one, a guide star hops down the friend's paw prints to a glowing far door
 *   and the camera walks in after it. Behind the last door is the treasure room, where the friend waits.
 */
import { Color, CylinderGeometry, Group, Mesh, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';
import { HitStop, Shake, Spring } from '../../engine/fx/juice';
import { ball, disc, gemGeo, roundedBox, starGeo } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { GEM_COLORS, PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { RenderWorld } from '../../engine/world';
import { audio } from '../../infra/audio/audio';
import type { PointerInfo } from '../../scenes/common/controller';
import { createFriend } from '../../scenes/island/friend';
import {
  disposeTree,
  hitCylinder,
  hitId,
  hitSphere,
  mapDiorama,
  nearestOnScreen,
  stageCamera,
} from '../_shared/diorama';
import { celebrate } from '../_shared/fx';
import type { StageCtx, StageScene } from '../_shared/module';
import { startStageMap } from '../_shared/stagemap';
import { dressEscape, ESCAPE_LOOKS, ESCAPE_MOODS, houseColor } from './maps';
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
  // the house (D62): room tint, window, ground, sky, outside dressing and life — the rooms play the same
  const env = startStageMap(world, root, ctx, ESCAPE_MOODS);
  const house = ESCAPE_LOOKS[env.map] as (typeof ESCAPE_LOOKS)[number];
  root.add(mapDiorama(house.shape, house.ground, 7));
  dressEscape(env.map, root, env.life);
  const hc = (hex: string) => houseColor(env.map, hex);

  // room shell (recoloured per theme)
  const floor = new Mesh(roundedBox(9.6, 0.3, 6.4, 0.12), toyMaterial('#f6c9a0', { finish: 'satin' }));
  floor.position.set(0, 0.15, -0.2);
  floor.receiveShadow = true;
  // the back wall has a real opening where the door is: a passage lies behind it
  const OPEN_HALF = DOOR_W / 2 + 0.2;
  const sideW = 4.8 - OPEN_HALF;
  const backL = new Mesh(roundedBox(sideW, 4.2, 0.3, 0.1), toyMaterial('#fff0d6', { finish: 'matte' }));
  backL.position.set(-4.8 + sideW / 2, 2.25, WALL_Z - 0.15);
  const backR = new Mesh(roundedBox(sideW, 4.2, 0.3, 0.1), toyMaterial('#fff0d6', { finish: 'matte' }));
  backR.position.set(4.8 - sideW / 2, 2.25, WALL_Z - 0.15);
  const lintelH = 4.35 - (0.3 + DOOR_H);
  const backTop = new Mesh(
    roundedBox(OPEN_HALF * 2, lintelH, 0.3, 0.06),
    toyMaterial('#fff0d6', { finish: 'matte' }),
  );
  backTop.position.set(0, 4.35 - lintelH / 2, WALL_Z - 0.15);
  const backs = [backL, backR, backTop];
  for (const b of backs) b.receiveShadow = true;
  const side = new Mesh(roundedBox(0.3, 4.2, 6.4, 0.1), toyMaterial('#fff0d6', { finish: 'matte' }));
  side.position.set(-4.95, 2.25, -0.2);
  side.receiveShadow = true;
  // skirting board on both sides of the doorway (not across it)
  const trimL = new Mesh(roundedBox(sideW, 0.22, 0.36, 0.06), toyMaterial(PALETTE.berry));
  trimL.position.set(-4.8 + sideW / 2, 0.42, WALL_Z - 0.1);
  const trimR = new Mesh(roundedBox(sideW, 0.22, 0.36, 0.06), toyMaterial(PALETTE.berry));
  trimR.position.set(4.8 - sideW / 2, 0.42, WALL_Z - 0.1);
  root.add(floor, ...backs, side, trimL, trimR);
  // a lived-in room, not bare boards: wallpaper stripes (tinted per room), a window with a sky in the side
  // wall, a framed picture and a hanging lamp
  const stripeMat = () => toyMaterial('#ffffff', { finish: 'matte' });
  const stripes: Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const x = -4.3 + i * 0.95;
    if (Math.abs(x) < 1.7) continue; // the door
    const st = new Mesh(roundedBox(0.28, 3.4, 0.04, 0.02), stripeMat());
    st.position.set(x, 2.55, WALL_Z + 0.02);
    stripes.push(st);
  }
  for (let i = 0; i < 6; i++) {
    const st = new Mesh(roundedBox(0.04, 3.4, 0.28, 0.02), stripeMat());
    st.position.set(-4.78, 2.55, -2.2 + i * 1.0);
    if (Math.abs(-2.2 + i * 1.0 - 0.4) < 1.1) continue; // the window
    stripes.push(st);
  }
  const winFrame = new Mesh(roundedBox(0.14, 1.5, 1.7, 0.05), woodMaterial('#f4f1ec'));
  winFrame.position.set(-4.76, 2.5, 0.4);
  const winSky = new Mesh(
    roundedBox(0.06, 1.24, 1.44, 0.03),
    toyMaterial(house.window, { rimStrength: 0.5 }),
  );
  winSky.position.set(-4.72, 2.5, 0.4);
  const winBars = [
    new Mesh(roundedBox(0.08, 1.24, 0.07, 0.02), woodMaterial('#f4f1ec')),
    new Mesh(roundedBox(0.08, 0.07, 1.44, 0.02), woodMaterial('#f4f1ec')),
  ];
  for (const b of winBars) b.position.set(-4.7, 2.5, 0.4);
  const cloud = new Mesh(ball(0.16, 12), toyMaterial('#ffffff', { finish: 'matte' }));
  cloud.scale.set(0.3, 0.6, 1.4);
  cloud.position.set(-4.7, 2.75, 0.1);
  const picture = new Group();
  const pFrame = new Mesh(roundedBox(1.1, 0.85, 0.08, 0.04), woodMaterial('#c98a5c'));
  const pArt = new Mesh(roundedBox(0.9, 0.65, 0.05, 0.02), toyMaterial('#fff6dc', { finish: 'matte' }));
  pArt.position.z = 0.03;
  const sun = new Mesh(disc(0.13, 0.03, 18), toyMaterial(PALETTE.sun));
  sun.rotation.x = Math.PI / 2;
  sun.position.set(0.22, 0.13, 0.06);
  const hill = new Mesh(ball(0.32, 16), toyMaterial('#7ee08a', { finish: 'matte' }));
  hill.scale.set(1.3, 0.45, 0.1);
  hill.position.set(-0.1, -0.2, 0.06);
  picture.add(pFrame, pArt, sun, hill);
  picture.position.set(3.1, 2.9, WALL_Z + 0.06);
  picture.rotation.z = -0.04;
  const lampCord = new Mesh(new CylinderGeometry(0.02, 0.02, 1.2, 6), toyMaterial('#3b3355'));
  lampCord.position.set(-2.4, 4.55, -0.9);
  const lampShade = new Mesh(
    new CylinderGeometry(0.22, 0.48, 0.42, 20, 1, true),
    toyMaterial(PALETTE.sun, { finish: 'satin' }),
  );
  lampShade.position.set(-2.4, 3.8, -0.9);
  const lampBulb = new Mesh(ball(0.14, 12), toyMaterial('#fff6c8', { rimStrength: 1 }));
  lampBulb.position.set(-2.4, 3.62, -0.9);
  root.add(...stripes, winFrame, winSky, ...winBars, cloud, picture, lampCord, lampShade, lampBulb);

  // door: frame + panel hinged on its left edge, glowing doorway behind it
  // a real frame: two posts and a head piece around an open doorway (not a solid board)
  const frame = new Group();
  const frameMat = woodMaterial('#8a5a3c');
  for (const side of [-1, 1]) {
    const post = new Mesh(roundedBox(0.2, DOOR_H + 0.25, 0.42, 0.06), frameMat);
    post.position.set(side * (DOOR_W / 2 + 0.1), 0.3 + DOOR_H / 2, WALL_Z);
    post.castShadow = true;
    frame.add(post);
  }
  const frameHead = new Mesh(roundedBox(DOOR_W + 0.4, 0.22, 0.42, 0.06), frameMat);
  frameHead.position.set(0, 0.3 + DOOR_H + 0.08, WALL_Z);
  frame.add(frameHead);
  const hinge = new Group();
  hinge.position.set(-DOOR_W / 2, 0.3, WALL_Z + 0.2);
  const panel = new Mesh(roundedBox(DOOR_W, DOOR_H, 0.16, 0.06), woodMaterial('#c98a5c'));
  panel.position.set(DOOR_W / 2, DOOR_H / 2, 0);
  panel.castShadow = true;
  hinge.add(panel);
  root.add(frame, hinge);

  // ── behind the door: a real passage to the next room (and, behind the last door, the treasure room).
  // Open-topped toy build lit by the same sun (no extra lights); its lamps are self-lit and switch on one by
  // one as the door swings, the friend's paw prints run down the rug to a glowing far door, and a little
  // guide star zips ahead along them. The camera then walks in.
  const HALL_L = 4.6;
  const HALL_W = 2.6;
  const HALL_H = 3.1;
  const hallZ = WALL_Z - 0.3 - HALL_L / 2;
  const farZ = WALL_Z - 0.3 - HALL_L;
  const hall = new Group();
  hall.name = 'escape-hall';
  const hallFloor = new Mesh(roundedBox(HALL_W + 0.4, 0.3, HALL_L + 0.3, 0.08), woodMaterial('#b98f6e'));
  hallFloor.position.set(0, 0.15, hallZ);
  const rug = new Mesh(
    roundedBox(1.1, 0.04, HALL_L - 0.5, 0.02),
    toyMaterial(PALETTE.berry, { finish: 'matte' }),
  );
  rug.position.set(0, 0.32, hallZ + 0.1);
  const hallWallMat = () => toyMaterial('#f0dcc0', { finish: 'matte' });
  const hallL = new Mesh(roundedBox(0.24, HALL_H, HALL_L, 0.06), hallWallMat());
  hallL.position.set(-HALL_W / 2 - 0.12, 0.3 + HALL_H / 2, hallZ);
  const hallR = new Mesh(roundedBox(0.24, HALL_H, HALL_L, 0.06), hallWallMat());
  hallR.position.set(HALL_W / 2 + 0.12, 0.3 + HALL_H / 2, hallZ);
  const hallEnd = new Mesh(roundedBox(HALL_W + 0.5, HALL_H, 0.24, 0.06), hallWallMat());
  hallEnd.position.set(0, 0.3 + HALL_H / 2, farZ - 0.12);
  hall.add(hallFloor, rug, hallL, hallR, hallEnd);
  // open-topped like the room itself (a roof would sit lower than the lintel and hide the passage when seen
  // from the room); little framed pictures between the lamps make it a lived-in hallway
  const artMats = ['#ffd6e7', '#d6ecff', '#e3ffd6'].map((c) => toyMaterial(c, { finish: 'matte' }));
  for (let i = 0; i < 3; i++)
    for (const side of [-1, 1]) {
      const fr = new Mesh(roundedBox(0.06, 0.55, 0.7, 0.03), woodMaterial('#c98a5c'));
      fr.position.set(side * (HALL_W / 2 - 0.02), 1.55, WALL_Z - 0.9 - i * 1.4 - (side > 0 ? 0.5 : 0));
      const art = new Mesh(
        roundedBox(0.04, 0.42, 0.56, 0.02),
        artMats[(i + (side > 0 ? 1 : 0)) % 3] as ReturnType<typeof toyMaterial>,
      );
      art.position.copy(fr.position).setX(side * (HALL_W / 2 - 0.05));
      hall.add(fr, art);
    }
  // wall lamps: dark until the door opens, then on one after another (nearest first)
  // bulbs: dull glass when off, unlit warm light when on (reads as glowing in every tier)
  const lampOff = toyMaterial('#a39d86', { finish: 'satin' });
  const lampOn = new MeshBasicNodeMaterial({ color: '#ffe7a3' });
  const lamps: Mesh[] = [];
  for (let i = 0; i < 2; i++)
    for (const side of [-1, 1]) {
      const z = WALL_Z - 1.6 - i * 2.0;
      const plate = new Mesh(roundedBox(0.06, 0.34, 0.22, 0.03), metalMaterial('#cfa64a'));
      plate.position.set(side * (HALL_W / 2 - 0.02), 2.35, z);
      const arm = new Mesh(roundedBox(0.22, 0.05, 0.05, 0.02), metalMaterial('#cfa64a'));
      arm.position.set(side * (HALL_W / 2 - 0.13), 2.4, z);
      const shade = new Mesh(
        new CylinderGeometry(0.08, 0.16, 0.16, 16, 1, true),
        toyMaterial(PALETTE.sun, { finish: 'satin' }),
      );
      shade.position.set(side * (HALL_W / 2 - 0.26), 2.5, z);
      const bulb = new Mesh(ball(0.085, 12), lampOff);
      bulb.position.set(side * (HALL_W / 2 - 0.26), 2.42, z);
      hall.add(plate, arm, shade, bulb);
      lamps.push(bulb);
    }
  // the friend's paw prints (they were carried this way), left–right along the rug
  const pawMat = toyMaterial('#9b7cf0', { finish: 'matte' });
  for (let i = 0; i < 6; i++) {
    const paw = new Group();
    const pad = new Mesh(ball(0.13, 12), pawMat);
    pad.scale.set(1, 0.18, 1.15);
    paw.add(pad);
    for (const dx of [-0.11, 0, 0.11]) {
      const toe = new Mesh(ball(0.05, 8), pawMat);
      toe.scale.set(1, 0.3, 1);
      toe.position.set(dx, 0, -0.17 + Math.abs(dx) * 0.4);
      paw.add(toe);
    }
    paw.position.set(i % 2 ? 0.22 : -0.22, 0.35, WALL_Z - 0.9 - i * 0.62);
    paw.rotation.y = i % 2 ? -0.12 : 0.12;
    hall.add(paw);
  }
  // far end: the next door, ajar and glowing, with a bouncing arrow over it
  const farFrame = new Mesh(roundedBox(1.9, 2.75, 0.2, 0.06), woodMaterial('#8a5a3c'));
  farFrame.position.set(0, 0.3 + 1.37, farZ + 0.02);
  // the next room's light through the far door: unlit, so it glows the same in every tier
  const farGlow = new Mesh(
    roundedBox(1.5, 2.45, 0.06, 0.02),
    new MeshBasicNodeMaterial({ color: '#fff1b8' }),
  );
  farGlow.position.set(0, 0.3 + 1.25, farZ + 0.2);
  const arrow = new Group();
  const shaft = new Mesh(roundedBox(0.16, 0.36, 0.1, 0.04), toyMaterial(PALETTE.sun, { rimStrength: 0.6 }));
  shaft.position.y = 0.2;
  const head = new Mesh(
    new CylinderGeometry(0, 0.26, 0.3, 4),
    toyMaterial(PALETTE.sun, { rimStrength: 0.6 }),
  );
  head.rotation.z = Math.PI;
  head.rotation.y = Math.PI / 4;
  head.position.y = -0.08;
  arrow.add(shaft, head);
  arrow.position.set(0, 0.3 + 2.95, farZ + 0.3);
  hall.add(farFrame, farGlow, arrow);
  // the little guide star that zips ahead along the paw prints
  const guide = new Mesh(starGeo(0.18, 0.08), toyMaterial('#ffd23f', { rimStrength: 1 }));
  guide.visible = false;
  hall.add(guide);
  // treasure room (behind the last door only): gem heaps, an open chest, the friend waiting inside
  const treasure = new Group();
  const gemMats = GEM_COLORS.map((c) => toyMaterial(c, { roughness: 0.06, rimStrength: 0.4 }));
  for (let i = 0; i < 22; i++) {
    const a = i * 2.4;
    const r = 0.25 + (i % 5) * 0.17;
    const gem = new Mesh(gemGeo(0.16), gemMats[i % gemMats.length] as ReturnType<typeof toyMaterial>);
    const heap = i % 2 ? -0.75 : 0.75;
    gem.position.set(
      heap + Math.cos(a) * r * 0.6,
      0.42 + (0.5 - r) * 0.5,
      farZ + 1.2 + Math.sin(a) * r * 0.5,
    );
    gem.rotation.set(i * 0.5, i, i * 0.3);
    treasure.add(gem);
  }
  const chest = new Group();
  const chestBox = new Mesh(roundedBox(1.1, 0.6, 0.7, 0.08), woodMaterial('#a0643c'));
  chestBox.position.y = 0.3;
  const chestLid = new Mesh(roundedBox(1.12, 0.22, 0.72, 0.08), woodMaterial('#b8743f'));
  chestLid.position.set(0, 0.7, -0.32);
  chestLid.rotation.x = -1.1;
  const chestBand = new Mesh(roundedBox(1.14, 0.1, 0.74, 0.03), metalMaterial('#f2b632', 0.25));
  chestBand.position.y = 0.45;
  chest.add(chestBox, chestLid, chestBand);
  chest.position.set(0, 0.3, farZ + 0.6);
  treasure.add(chest);
  hall.add(treasure);
  root.add(hall);
  // hall dressing per room: the treasure room swaps the far door + prints for the hoard
  const dressHall = (boss: boolean) => {
    treasure.visible = boss;
    farFrame.visible = farGlow.visible = arrow.visible = !boss;
    for (const c of hall.children) if (c instanceof Group && c !== treasure && c !== arrow) c.visible = !boss;
    const wall = boss ? '#fff0b8' : '#f0dcc0';
    for (const w of [hallL, hallR, hallEnd]) w.material = toyMaterial(wall, { finish: 'matte' });
    rug.material = toyMaterial(boss ? '#e2246b' : PALETTE.berry, { finish: 'matte' });
  };

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
  friend.group.position.set(0.3, 0.3, WALL_Z - 1.6);
  friend.group.visible = false;
  root.add(friend.group);

  const things = new Map<number, ThingView>();
  const proxies: Mesh[] = [];
  const pickV = new Vector3();
  let roomRef: EscapeState['room'] = null;
  const hitStop = new HitStop();
  const shake = new Shake(!ctx.reducedMotion && ctx.shakeIntensity > 0);
  const lockShake = new Spring(0, 260, 9);
  let cursorId: number | null = null;
  let glowId: number | null = null;
  let t = 0;
  let doorT = 0;
  let friendT = -1;
  let guideT = -1;
  const tmp = new Vector3();
  const look = new Vector3();

  const paint = (th: RoomTheme) => {
    const r = ROOM_COLORS[th];
    const c = { floor: hc(r.floor), wall: hc(r.wall), trim: hc(r.trim) };
    floor.material = toyMaterial(c.floor, { finish: 'satin' });
    side.material = toyMaterial(c.wall, { finish: 'matte' });
    for (const b of backs) b.material = side.material;
    // stripes: the wall colour a shade deeper, so each room has its own wallpaper
    const deeper = new Color(c.wall).offsetHSL(0, 0.08, -0.06).getStyle();
    for (const st of stripes) st.material = toyMaterial(deeper, { finish: 'matte' });
    trimL.material = trimR.material = toyMaterial(c.trim);
  };

  const build = (s: EscapeState) => {
    for (const v of things.values()) disposeTree(v.group);
    things.clear();
    proxies.length = 0;
    const room = s.room;
    if (!room) return;
    paint(room.theme);
    dressHall(room.boss);
    doorT = 0;
    // the trapped friend sits in the treasure room behind the last door (seen as soon as it opens)
    friend.group.visible = room.boss;
    friend.group.position.set(0.3, 0.3, WALL_Z - 1.6);
    friendT = -1;
    guideT = -1;
    for (const l of lamps) l.material = lampOff;
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
      env.update(dt);
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
        if (!room?.boss) guideT = 0;
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
      // lamps switch on one after another as the door swings (nearest pair first), with a soft click each
      lamps.forEach((l, i) => {
        const on = doorT > 0.25 + Math.floor(i / 2) * 0.3;
        const mat = on ? lampOn : lampOff;
        if (l.material !== mat) {
          l.material = mat;
          if (on && i % 2 === 0) audio.play('pop', { pitch: 1.4 + i * 0.1 });
        }
      });
      if (doorT > 0.3 && !ctx.reducedMotion && Math.floor(t * 12) % 2 === 0)
        world.particles.emit(
          'sparkle',
          tmp.set((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 2.6, WALL_Z - 0.2),
          2,
        );
      // the far door's arrow bobs; the guide star hops from print to print down the hall
      arrow.position.y = 0.3 + 2.95 + (ctx.reducedMotion ? 0 : Math.abs(Math.sin(t * 3)) * 0.15);
      guide.visible = guideT >= 0 && guideT < 2.2;
      if (guideT >= 0) {
        guideT += vdt;
        const k = Math.min(1, Math.max(0, (guideT - 0.25) / 1.6));
        const hop = ctx.reducedMotion ? 0 : Math.abs(Math.sin(k * Math.PI * 6)) * 0.35;
        guide.position.set(Math.sin(k * Math.PI * 6) * 0.22, 1.0 + hop, WALL_Z + 0.4 - k * (HALL_L + 0.2));
        guide.rotation.z = t * 5;
        if (!ctx.reducedMotion && Math.floor(t * 20) % 3 === 0)
          world.particles.emit('sparkle', tmp.copy(guide.position), 1);
      }
      // the waiting friend bobs in the treasure room; once freed it hops out of the door
      if (friendT < 0 && friend.group.visible) friend.update(vdt, t, ctx.reducedMotion);
      if (friendT >= 0) {
        friendT += vdt;
        friend.group.visible = true;
        const k = Math.min(1, friendT / 1.4);
        friend.group.position.set(0.3, 0.3 + Math.sin(k * Math.PI) * 1.2, WALL_Z - 1.6 + k * 3.8);
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
      let walk = 0;
      if (!ctx.reducedMotion) {
        if (state.phase === 'enter') push = 1 - ease(Math.min(1, (1 - state.phaseLeft / ENTER_TICKS) * 1.15));
        if (state.phase === 'open' && !room?.boss) {
          // up to the doorway, then step through it and walk down the passage after the guide star
          const k = Math.max(0, (1 - state.phaseLeft / OPEN_TICKS - 0.35) / 0.65);
          push = ease(Math.min(1, k / 0.45));
          walk = ease(Math.max(0, (k - 0.45) / 0.55));
        }
      }
      const sh = shake.update(dt);
      const bob = walk > 0 && walk < 1 ? Math.abs(Math.sin(walk * Math.PI * 5)) * 0.08 : 0;
      world.camera.position.set(
        sh.x,
        CAM.y + sh.y - push * 3.6 - walk * 0.9 + bob,
        CAM.z - push * (CAM.z - WALL_Z - 3.2) - walk * (3.2 + 0.6),
      );
      look.set(0, CAM.lookY + push * 0.4 - walk * 0.4, push * WALL_Z + walk * (farZ - WALL_Z));
      world.camera.lookAt(look);
    },
    pointer(p: PointerInfo, state, emit) {
      if (p.type !== 'down' || state.phase !== 'play') return;
      // the lock's number keys only count once every clue is found (before that a tap goes to the things)
      const key = state.room && allFound(state.room, state.found) ? hitId(keyProxies, p.raycaster) : null;
      if (key !== null) {
        emit({ t: 'pick', id: key });
        return;
      }
      // things still closed, picked by what is nearest the finger on screen (body or ? badge) — a closed
      // thing in front must not swallow a tap meant for the one behind it, nor an opened one any tap at all
      const closed = new Set(
        (state.room?.things ?? []).filter((t) => !state.found.includes(t.id)).map((t) => t.id),
      );
      const cands: { id: number; points: { x: number; y: number }[] }[] = [];
      for (const id of closed) {
        const v = things.get(id);
        if (!v) continue;
        const pts = [0.8, 1.4, 1.85].map((y) => {
          const q = pickV.copy(v.group.position).setY(y).project(world.camera);
          return { x: q.x, y: q.y };
        });
        cands.push({ id, points: pts });
      }
      const id =
        nearestOnScreen(p.x, p.y, world.camera.aspect, cands) ??
        hitId(proxies, p.raycaster, (x) => closed.has(x));
      if (id !== null) emit({ t: 'tap', id });
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
      env.dispose();
      disposeTree(root);
    },
  };
}
