/**
 * Procedural mini dioramas for the 8 stage portals (SPEC §10: "스테이지 아이콘(3D 미니 모형)").
 * Each one is a little scene that says what the stage is at a glance — a kart under a chequered arch, a
 * fish leaping from a pond, a padlocked door … Toy parts are merged per material (`mergeStatic`), so a
 * detailed model still costs only a handful of draw calls. +Z faces the camera.
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, TorusGeometry } from 'three/webgpu';
import type { StageId } from '../../domain/stage/types';
import { markStatic, mergeStatic } from '../../engine/geo/merge';
import { ball, capsule, disc, roundedBox, waterPlane } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import {
  jellyMaterial,
  metalMaterial,
  toyMaterial,
  waterMaterial,
  woodMaterial,
} from '../../engine/tsl/materials';

type Geo = ConstructorParameters<typeof Mesh>[0];
type Mat = ConstructorParameters<typeof Mesh>[1];
interface Put {
  at?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  mat?: Mat;
}

const INK = '#2b2f3a';
const GOLD = '#f2b632';

/** One toy part, placed and marked for merging. */
function part(g: Group, geo: Geo, color: string, put: Put = {}): Mesh {
  const mesh = new Mesh(geo, put.mat ?? toyMaterial(color, { rimStrength: 0.35 }));
  if (put.at) mesh.position.set(...put.at);
  if (put.rot) mesh.rotation.set(...put.rot);
  if (put.scale) mesh.scale.set(...put.scale);
  mesh.castShadow = true;
  g.add(markStatic(mesh));
  return mesh;
}

/** Two round eyes with pupils and a glint, looking out along +Z. */
function eyes(g: Group, y: number, z: number, gap = 0.1, size = 0.07) {
  for (const x of [-gap, gap]) {
    part(g, ball(size, 12), PALETTE.white, { at: [x, y, z] });
    part(g, ball(size * 0.55, 10), INK, { at: [x, y, z + size * 0.6] });
    part(g, ball(size * 0.2, 6), PALETTE.white, { at: [x + size * 0.25, y + size * 0.3, z + size * 1.05] });
  }
}

/** A chequered strip of `cols` × `rows` little tiles (black / white), centred on x. */
function chequer(
  g: Group,
  cols: number,
  rows: number,
  tile: number,
  at: [number, number, number],
  depth = 0.04,
) {
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      part(g, roundedBox(tile, tile, depth, 0.004), (c + r) % 2 ? PALETTE.white : INK, {
        at: [at[0] + (c - (cols - 1) / 2) * tile, at[1] + r * tile, at[2]],
      });
}

function bomb(g: Group) {
  part(g, ball(0.4), '#3d4263', { at: [0, 0.44, 0] });
  // a glossy highlight and a brass collar
  part(g, ball(0.09, 12), '#8f95c4', { at: [-0.16, 0.62, 0.3], scale: [1, 0.7, 0.5] });
  part(g, new CylinderGeometry(0.13, 0.15, 0.12, 20), GOLD, {
    at: [0.08, 0.84, 0],
    rot: [0, 0, -0.25],
    mat: metalMaterial(GOLD),
  });
  // the fuse curls up to a spark
  [0, 1, 2, 3].forEach((i) => {
    part(g, capsule(0.03, 0.09), PALETTE.cocoa, {
      at: [0.11 + i * 0.05, 0.93 + i * 0.07, 0],
      rot: [0, 0, -0.5 - i * 0.22],
    });
  });
  part(g, ball(0.075, 10), '#ff7a3d', { at: [0.33, 1.17, 0] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(g, new ConeGeometry(0.03, 0.13, 6), PALETTE.sun, {
      at: [0.33 + Math.cos(a) * 0.12, 1.17 + Math.sin(a) * 0.12, 0],
      rot: [0, 0, a - Math.PI / 2],
    });
  }
  // three coloured wires round the bomb, down to a little number pad
  ['#ff5d7a', '#3fbf6b', '#3aa7e8'].forEach((c, i) => {
    part(g, new TorusGeometry(0.41, 0.028, 8, 36), c, {
      at: [0, 0.44, 0],
      rot: [Math.PI / 2, 0.45 * (i - 1), 0.5 * (i - 1)],
    });
  });
  part(g, roundedBox(0.3, 0.2, 0.2, 0.04), '#e9edf5', { at: [-0.5, 0.12, 0.3], rot: [0, 0.5, 0] });
  part(g, roundedBox(0.2, 0.09, 0.02, 0.01), '#27384a', { at: [-0.46, 0.14, 0.4], rot: [0, 0.5, 0] });
  part(g, ball(0.03, 8), '#ff5d7a', { at: [-0.56, 0.24, 0.3] });
  part(g, ball(0.03, 8), '#3fbf6b', { at: [-0.47, 0.24, 0.26] });
}

function zombie(g: Group) {
  const skin = '#9ad48a';
  part(g, capsule(0.26, 0.3), skin, { at: [0, 0.5, 0] });
  // sleepy lids over the eyes, a tuft, a patch, arms out in front
  eyes(g, 0.72, 0.21, 0.1, 0.065);
  for (const x of [-0.1, 0.1])
    part(g, roundedBox(0.15, 0.05, 0.08, 0.02), '#7fbf70', { at: [x, 0.78, 0.24], rot: [0.3, 0, x * 2] });
  part(g, new ConeGeometry(0.06, 0.16, 6), '#6fae62', { at: [0, 0.98, 0], rot: [0, 0, 0.3] });
  part(g, roundedBox(0.13, 0.11, 0.03, 0.01), '#f1c27a', { at: [0.12, 0.42, 0.24], rot: [0, 0.3, 0.2] });
  part(g, roundedBox(0.16, 0.04, 0.03, 0.01), '#5b4a7a', { at: [0, 0.58, 0.26] });
  for (const x of [-0.24, 0.24]) {
    part(g, capsule(0.065, 0.22), skin, { at: [x, 0.56, 0.2], rot: [Math.PI / 2 - 0.2, 0, 0] });
    part(g, capsule(0.08, 0.06), '#5b4a7a', { at: [x * 0.6, 0.1, 0.03] });
  }
  // the number balloon on its string
  part(g, ball(0.25, 20), '#ff6f91', { at: [0.3, 1.45, 0], scale: [1, 1.12, 1] });
  part(g, ball(0.06, 8), '#ffc2d0', { at: [0.2, 1.56, 0.17], scale: [1, 1.4, 0.4] });
  part(g, new ConeGeometry(0.05, 0.07, 8), '#ff6f91', { at: [0.3, 1.15, 0] });
  part(g, new CylinderGeometry(0.008, 0.008, 0.5, 5), PALETTE.white, {
    at: [0.3, 0.87, 0.08],
    rot: [0.25, 0, 0],
  });
  // a bit of garden fence behind
  for (let i = 0; i < 4; i++) {
    part(g, roundedBox(0.1, 0.42, 0.04, 0.02), PALETTE.white, { at: [-0.65 + i * 0.16, 0.21, -0.45] });
    part(g, new ConeGeometry(0.06, 0.09, 4), PALETTE.white, {
      at: [-0.65 + i * 0.16, 0.46, -0.45],
      rot: [0, Math.PI / 4, 0],
    });
  }
  part(g, roundedBox(0.62, 0.05, 0.03, 0.01), PALETTE.white, { at: [-0.41, 0.26, -0.47] });
}

function fishing(g: Group) {
  // a stone-rimmed pond with real water
  part(g, disc(0.74, 0.12, 40), '#e7d6b0', {
    at: [0, 0.06, 0],
    mat: toyMaterial('#e7d6b0', { finish: 'matte' }),
  });
  // the big pond's water scaled down: its waves shrink with it, so they never dip under the stone rim
  const pond = new Mesh(waterPlane(4.6, 32), waterMaterial());
  pond.scale.setScalar(0.62 / 4.6);
  pond.position.y = 0.15;
  g.add(pond);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    part(g, ball(0.11, 10), i % 2 ? '#c9c2b4' : '#aeb7b0', {
      at: [Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7],
      scale: [1.2, 0.7, 1],
    });
  }
  part(g, disc(0.14, 0.02, 16), '#63c06a', { at: [-0.3, 0.15, 0.25] });
  part(g, ball(0.045, 8), '#ff9ec2', { at: [-0.3, 0.19, 0.25] });
  // the fish leaps in an arc: body, belly, V tail, fins, bright eyes
  const f = new Group();
  const c = '#ff9a5c';
  part(f, ball(0.2, 20), c, { scale: [1.5, 0.95, 0.75] });
  part(f, ball(0.17, 16), '#ffe1c2', { at: [0.02, -0.06, 0], scale: [1.3, 0.7, 0.7] });
  for (const s of [-1, 1])
    part(f, ball(0.12, 12), '#f0703a', {
      at: [-0.36, s * 0.09, 0],
      rot: [0, 0, s * 0.7],
      scale: [1.2, 0.5, 0.25],
    });
  part(f, ball(0.1, 10), '#f0703a', { at: [-0.02, 0.19, 0], rot: [0, 0, -0.4], scale: [1.3, 0.6, 0.2] });
  for (const z of [-0.13, 0.13]) {
    part(f, ball(0.055, 10), PALETTE.white, { at: [0.17, 0.05, z] });
    part(f, ball(0.03, 8), INK, { at: [0.2, 0.05, z * 1.25] });
    part(f, ball(0.07, 8), '#f0703a', {
      at: [0, -0.08, z * 1.2],
      rot: [0.5 * Math.sign(z), 0, -0.6],
      scale: [1.2, 0.5, 0.25],
    });
  }
  mergeStatic(f);
  f.position.set(0.08, 0.72, 0);
  f.rotation.set(0, -0.5, 0.55);
  g.add(f);
  // splash drops under it
  [
    [-0.1, 0.36, 0.1],
    [0.24, 0.3, -0.06],
    [0.02, 0.28, -0.16],
    [0.3, 0.42, 0.12],
  ].forEach(([x, y, z], i) => {
    part(g, ball(0.035 + (i % 2) * 0.015, 8), '#d6f4fb', { at: [x as number, y as number, z as number] });
  });
  // rod, line and float
  part(g, new CylinderGeometry(0.018, 0.03, 1.3, 8), '#8a5a3c', {
    at: [-0.55, 0.72, -0.25],
    rot: [0.2, 0, -0.55],
    mat: woodMaterial('#8a5a3c'),
  });
  part(g, disc(0.07, 0.07, 12), '#ff6f91', { at: [-0.8, 0.35, -0.33], rot: [0, 0, Math.PI / 2] });
  part(g, new CylinderGeometry(0.006, 0.006, 0.95, 4), PALETTE.white, { at: [-0.2, 0.74, -0.13] });
  part(g, ball(0.055, 10), '#ff5d7a', { at: [-0.2, 0.24, -0.13] });
  part(g, ball(0.04, 8), PALETTE.white, { at: [-0.2, 0.29, -0.13] });
}

function slime(g: Group) {
  part(g, roundedBox(1.25, 0.1, 0.95, 0.05), '#b9a6f2', {
    at: [0, 0.06, 0],
    mat: toyMaterial('#b9a6f2', { finish: 'satin' }),
  });
  const blobs: [string, number, number, number, number][] = [
    ['#ff8fab', -0.3, 0.05, 0.3, 1],
    ['#6fd0e3', 0.3, 0.12, 0.24, 1],
    ['#ffd166', 0.02, -0.18, 0.19, 1],
  ];
  for (const [c, x, z, r] of blobs) {
    const b = new Mesh(ball(r, 24), jellyMaterial(c).material);
    b.position.set(x, 0.11 + r * 0.78, z);
    b.scale.y = 0.82;
    b.castShadow = true;
    g.add(b);
    // faces sit on the jelly: eyes, cheeks, a little smile
    for (const s of [-1, 1]) {
      part(g, ball(r * 0.14, 8), INK, { at: [x + s * r * 0.33, 0.11 + r * 0.9, z + r * 0.88] });
      part(g, ball(r * 0.05, 6), PALETTE.white, {
        at: [x + s * r * 0.33 + r * 0.04, 0.11 + r * 0.95, z + r * 0.98],
      });
      part(g, ball(r * 0.1, 8), '#ff9ec2', {
        at: [x + s * r * 0.55, 0.11 + r * 0.7, z + r * 0.8],
        scale: [1, 0.6, 0.4],
      });
    }
    part(g, new TorusGeometry(r * 0.13, r * 0.03, 6, 12, Math.PI), INK, {
      at: [x, 0.11 + r * 0.72, z + r * 0.93],
      rot: [0, 0, Math.PI],
    });
  }
  // a plus sign and a sparkle between them: "합체!"
  part(g, roundedBox(0.2, 0.06, 0.05, 0.02), PALETTE.white, { at: [0.02, 0.72, 0.1] });
  part(g, roundedBox(0.06, 0.2, 0.05, 0.02), PALETTE.white, { at: [0.02, 0.72, 0.1] });
  for (let i = 0; i < 4; i++)
    part(g, new ConeGeometry(0.03, 0.12, 4), PALETTE.sun, {
      at: [0.42 + Math.cos((i * Math.PI) / 2) * 0.08, 0.75 + Math.sin((i * Math.PI) / 2) * 0.08, -0.05],
      rot: [0, 0, (i * Math.PI) / 2 - Math.PI / 2],
    });
}

function lockedDoor(g: Group) {
  const wood = woodMaterial('#9a6a48');
  // a stone doorway with an arch and a heavy wooden door
  for (const x of [-0.44, 0.44]) part(g, roundedBox(0.16, 1.1, 0.26, 0.04), '#b9bfd0', { at: [x, 0.55, 0] });
  part(g, new TorusGeometry(0.44, 0.085, 10, 24, Math.PI), '#b9bfd0', {
    at: [0, 1.08, 0],
    scale: [1, 0.75, 1.5],
  });
  part(g, roundedBox(0.2, 0.16, 0.3, 0.03), '#d9deea', { at: [0, 1.44, 0] });
  part(g, roundedBox(0.74, 1.08, 0.12, 0.04), '#9a6a48', { at: [0, 0.56, -0.02], mat: wood });
  for (const x of [-0.19, 0.19])
    part(g, roundedBox(0.3, 0.9, 0.03, 0.02), '#84583a', {
      at: [x, 0.56, 0.05],
      mat: woodMaterial('#84583a'),
    });
  for (const y of [0.25, 0.9]) {
    part(g, roundedBox(0.72, 0.07, 0.03, 0.01), '#6d7387', {
      at: [0, y, 0.07],
      mat: metalMaterial('#8d93a8'),
    });
    for (const x of [-0.3, 0.3])
      part(g, ball(0.03, 8), '#d9deea', { at: [x, y, 0.09], mat: metalMaterial('#d9deea') });
  }
  // the big padlock: body, shackle, keyhole, number wheels
  const gold = metalMaterial(GOLD);
  part(g, roundedBox(0.36, 0.3, 0.14, 0.06), GOLD, { at: [0, 0.5, 0.16], mat: gold });
  part(g, new TorusGeometry(0.11, 0.035, 8, 20, Math.PI), '#d9deea', {
    at: [0, 0.65, 0.16],
    mat: metalMaterial('#d9deea'),
  });
  part(g, ball(0.04, 10), INK, { at: [0, 0.54, 0.235], scale: [1, 1, 0.3] });
  part(g, roundedBox(0.03, 0.09, 0.01, 0.005), INK, { at: [0, 0.47, 0.235] });
  // a key on the step and a question mark star above
  part(g, new TorusGeometry(0.06, 0.02, 6, 14), GOLD, {
    at: [0.5, 0.05, 0.4],
    rot: [Math.PI / 2, 0, 0],
    mat: gold,
  });
  part(g, roundedBox(0.2, 0.03, 0.03, 0.01), GOLD, { at: [0.36, 0.05, 0.4], mat: gold });
  part(g, roundedBox(0.03, 0.03, 0.07, 0.008), GOLD, { at: [0.29, 0.05, 0.43], mat: gold });
  part(g, roundedBox(1.0, 0.07, 0.5, 0.03), '#cfd4e2', { at: [0, 0.035, 0.12] });
}

function pizza(g: Group) {
  // brick oven with a glowing mouth and a chimney
  part(g, ball(0.42, 24), '#d9604a', { at: [-0.3, 0.3, -0.25], scale: [1, 0.85, 1] });
  part(g, roundedBox(0.92, 0.22, 0.8, 0.05), '#c9a27a', { at: [-0.3, 0.11, -0.25] });
  part(g, roundedBox(0.34, 0.24, 0.1, 0.08), '#3a2b2b', { at: [-0.3, 0.35, 0.12] });
  part(g, roundedBox(0.26, 0.12, 0.08, 0.04), '#ff9a3d', { at: [-0.3, 0.3, 0.15] });
  part(g, roundedBox(0.14, 0.06, 0.08, 0.02), PALETTE.sun, { at: [-0.3, 0.28, 0.17] });
  part(g, new CylinderGeometry(0.07, 0.09, 0.4, 10), '#b84e3c', { at: [-0.45, 0.78, -0.35] });
  for (let i = 0; i < 3; i++)
    part(g, ball(0.07 + i * 0.025, 10), PALETTE.white, { at: [-0.42 + i * 0.06, 1.05 + i * 0.14, -0.35] });
  // a whole pizza on a wooden peel: crust, sauce, cheese, toppings, one slice lifted
  const peel = woodMaterial('#d6a26c');
  part(g, disc(0.42, 0.04, 32), '#d6a26c', { at: [0.34, 0.06, 0.28], mat: peel });
  part(g, roundedBox(0.12, 0.04, 0.5, 0.02), '#d6a26c', { at: [0.34, 0.06, 0.82], mat: peel });
  part(g, disc(0.37, 0.07, 32), '#e9b45f', { at: [0.34, 0.11, 0.28] });
  part(g, disc(0.32, 0.075, 32), '#e2452f', { at: [0.34, 0.115, 0.28] });
  part(g, disc(0.3, 0.08, 32), '#ffd97a', { at: [0.34, 0.12, 0.28] });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i % 2 ? 0.2 : 0.11;
    part(g, disc(0.05, 0.03, 12), '#d93a3a', { at: [0.34 + Math.cos(a) * r, 0.165, 0.28 + Math.sin(a) * r] });
    part(g, ball(0.022, 6), '#4f8f3a', {
      at: [0.34 + Math.cos(a + 0.5) * 0.16, 0.17, 0.28 + Math.sin(a + 0.5) * 0.16],
    });
  }
  // the lifted slice with a cheese pull
  part(g, new CylinderGeometry(0.2, 0.2, 0.06, 3), '#ffd97a', {
    at: [0.62, 0.42, 0.02],
    rot: [0.5, 0.4, 0.2],
  });
  part(g, capsule(0.03, 0.34), '#e9b45f', { at: [0.74, 0.5, -0.1], rot: [0.5, 0.4, Math.PI / 2 + 0.2] });
  part(g, disc(0.04, 0.03, 10), '#d93a3a', { at: [0.6, 0.47, 0.03], rot: [0.5, 0.4, 0.2] });
  part(g, new CylinderGeometry(0.012, 0.02, 0.26, 5), '#ffe9a8', {
    at: [0.5, 0.27, 0.14],
    rot: [0.5, 0, -0.5],
  });
  // chef hat
  part(g, new CylinderGeometry(0.12, 0.11, 0.14, 14), PALETTE.white, { at: [0.72, 0.16, 0.74] });
  for (const [x, z] of [
    [0, 0],
    [0.08, 0.03],
    [-0.08, 0.02],
    [0, -0.07],
  ] as const)
    part(g, ball(0.1, 10), PALETTE.white, { at: [0.72 + x, 0.3, 0.74 + z] });
}

function cards(g: Group) {
  // three fanned cards: white face, coloured frame, a big sign each
  const frames = ['#4a9fe0', '#ffc93c', '#ff7fa8'];
  [-1, 0, 1].forEach((k, i) => {
    const c = new Group();
    part(c, roundedBox(0.44, 0.62, 0.035, 0.05), frames[i] as string);
    part(c, roundedBox(0.36, 0.54, 0.04, 0.035), '#fbfdff', { at: [0, 0, 0.005] });
    const ink = frames[i] as string;
    if (i !== 2) {
      part(c, roundedBox(0.2, 0.055, 0.02, 0.01), ink, { at: [0, 0.02, 0.03] });
      if (i === 1) part(c, roundedBox(0.055, 0.2, 0.02, 0.01), ink, { at: [0, 0.02, 0.03] });
    } else {
      part(c, new TorusGeometry(0.085, 0.028, 8, 20), ink, { at: [0, 0.02, 0.03] });
    }
    for (const s of [-1, 1]) part(c, ball(0.03, 8), ink, { at: [s * 0.12, s * -0.2, 0.03] });
    mergeStatic(c);
    c.position.set(k * 0.36, 0.52 - Math.abs(k) * 0.05, k === 0 ? 0.06 : 0);
    c.rotation.set(-0.15, -k * 0.25, -k * 0.3);
    g.add(c);
  });
  // a target gem on a stand in front, and two stars
  part(g, disc(0.2, 0.06, 20), '#3b3355', { at: [0, 0.03, 0.5] });
  part(g, new ConeGeometry(0.13, 0.16, 6), '#57e0c9', { at: [0, 0.14, 0.5], rot: [Math.PI, 0, 0] });
  part(g, new ConeGeometry(0.13, 0.07, 6), '#9af3e4', { at: [0, 0.255, 0.5] });
  for (const [x, y] of [
    [-0.62, 0.95],
    [0.62, 0.86],
  ] as const)
    for (let i = 0; i < 4; i++)
      part(g, new ConeGeometry(0.035, 0.13, 4), PALETTE.sun, {
        at: [x + Math.cos((i * Math.PI) / 2) * 0.08, y + Math.sin((i * Math.PI) / 2) * 0.08, 0.05],
        rot: [0, 0, (i * Math.PI) / 2 - Math.PI / 2],
      });
}

function race(g: Group) {
  // a strip of track with kerbs and a chequered start line
  part(g, roundedBox(1.5, 0.06, 1.0, 0.03), '#4d5266', {
    at: [0, 0.03, 0.05],
    mat: toyMaterial('#4d5266', { finish: 'matte' }),
  });
  for (let i = 0; i < 8; i++)
    for (const z of [-0.47, 0.57])
      part(g, roundedBox(0.19, 0.08, 0.08, 0.02), i % 2 ? PALETTE.white : '#e8505b', {
        at: [-0.66 + i * 0.19, 0.04, z],
      });
  for (let i = 0; i < 4; i++)
    part(g, roundedBox(0.16, 0.012, 0.035, 0.004), PALETTE.white, { at: [-0.5 + i * 0.36, 0.066, 0.05] });
  // the start arch: two posts, a chequered banner, lights on top
  for (const x of [-0.72, 0.72]) {
    part(g, new CylinderGeometry(0.045, 0.055, 1.25, 10), '#e9edf5', { at: [x, 0.63, -0.42] });
    part(g, ball(0.08, 10), '#e8505b', { at: [x, 1.3, -0.42] });
  }
  part(g, roundedBox(1.5, 0.28, 0.05, 0.02), INK, { at: [0, 1.1, -0.42] });
  chequer(g, 14, 2, 0.1, [0, 1.05, -0.39], 0.02);
  ['#e8505b', PALETTE.sun, '#3fbf6b'].forEach((c, i) => {
    part(g, ball(0.055, 10), c, { at: [-0.14 + i * 0.14, 1.31, -0.42] });
  });
  // the kart: low body, pointed nose, wing, exhausts, four fat tyres with gold hubs, a helmeted driver
  const k = new Group();
  const red = '#ff5a52';
  part(k, roundedBox(0.34, 0.13, 0.62, 0.06), red, { at: [0, 0.2, 0] });
  part(k, roundedBox(0.2, 0.1, 0.3, 0.05), red, { at: [0, 0.18, 0.4] });
  part(k, new ConeGeometry(0.1, 0.2, 12), '#ff8a6a', {
    at: [0, 0.18, 0.62],
    rot: [Math.PI / 2, 0, 0],
    scale: [1, 1, 0.6],
  });
  part(k, roundedBox(0.5, 0.035, 0.1, 0.015), PALETTE.white, { at: [0, 0.12, 0.6] });
  part(k, roundedBox(0.3, 0.012, 0.5, 0.004), PALETTE.white, { at: [0, 0.27, 0.05] });
  for (const x of [-0.17, 0.17]) part(k, roundedBox(0.03, 0.16, 0.04, 0.01), INK, { at: [x, 0.36, -0.3] });
  part(k, roundedBox(0.5, 0.035, 0.16, 0.015), INK, { at: [0, 0.45, -0.32] });
  for (const x of [-0.09, 0.09])
    part(k, new CylinderGeometry(0.035, 0.045, 0.16, 10), '#cfd6e4', {
      at: [x, 0.2, -0.36],
      rot: [Math.PI / 2, 0, 0],
      mat: metalMaterial('#cfd6e4'),
    });
  for (const [x, z, r] of [
    [-0.26, 0.32, 0.12],
    [0.26, 0.32, 0.12],
    [-0.28, -0.22, 0.145],
    [0.28, -0.22, 0.145],
  ] as const) {
    part(k, disc(r, 0.13, 20), INK, {
      at: [x, r, z],
      rot: [0, 0, Math.PI / 2],
      mat: toyMaterial(INK, { finish: 'matte' }),
    });
    part(k, disc(r * 0.5, 0.14, 12), GOLD, { at: [x, r, z], rot: [0, 0, Math.PI / 2] });
  }
  // driver: helmet with a stripe and a visor
  part(k, ball(0.13, 18), PALETTE.sun, { at: [0, 0.4, -0.05] });
  part(k, roundedBox(0.05, 0.2, 0.2, 0.02), PALETTE.white, { at: [0, 0.43, -0.07] });
  part(k, roundedBox(0.2, 0.07, 0.06, 0.03), '#27384a', { at: [0, 0.4, 0.06] });
  // exhaust flames: it is going fast
  for (const x of [-0.09, 0.09]) {
    part(k, new ConeGeometry(0.045, 0.2, 8), '#ff9a3d', { at: [x, 0.2, -0.53], rot: [-Math.PI / 2, 0, 0] });
    part(k, new ConeGeometry(0.025, 0.12, 8), PALETTE.sun, { at: [x, 0.2, -0.5], rot: [-Math.PI / 2, 0, 0] });
  }
  mergeStatic(k);
  k.position.set(-0.05, 0.06, 0.08);
  k.rotation.set(-0.12, Math.PI / 2 - 0.45, 0); // three-quarter view, nose slightly up: a wheelie off the line
  g.add(k);
  // a chequered flag waving beside the track, and a little trophy
  part(g, new CylinderGeometry(0.018, 0.018, 0.85, 6), '#e9edf5', {
    at: [0.62, 0.48, 0.5],
    rot: [0, 0, -0.12],
  });
  const flag = new Group();
  chequer(flag, 4, 3, 0.085, [0, 0, 0], 0.015);
  mergeStatic(flag);
  flag.position.set(0.85, 0.66, 0.5);
  flag.rotation.set(0, 0.35, -0.12);
  g.add(flag);
  const gold = metalMaterial(GOLD);
  part(g, disc(0.07, 0.03, 12), GOLD, { at: [-0.6, 0.08, 0.42], mat: gold });
  part(g, new CylinderGeometry(0.015, 0.015, 0.08, 6), GOLD, { at: [-0.6, 0.13, 0.42], mat: gold });
  part(g, new CylinderGeometry(0.075, 0.03, 0.12, 12), GOLD, { at: [-0.6, 0.23, 0.42], mat: gold });
}

const BUILD: Record<StageId, (g: Group) => void> = {
  bomb,
  zombie,
  fishing,
  slime,
  escape: lockedDoor,
  pizza,
  cardbattle: cards,
  race,
};

export function portalModel(stage: StageId): Group {
  const g = new Group();
  BUILD[stage](g);
  // everything static of one material becomes one mesh (animated / special-material parts are left alone)
  mergeStatic(g);
  return g;
}
