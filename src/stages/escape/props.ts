/**
 * Toy props for the escape rooms: six per room theme, each a few batched primitives (~0.8–1.4 tall,
 * base on y = 0). Original simple toys (P3); anything can hide a number clue.
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, TorusGeometry } from 'three/webgpu';
import { markStatic, mergeStatic } from '../../engine/geo/merge';
import { ball, capsule, roundedBox } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { RoomTheme } from './rules';

type Mat = ReturnType<typeof toyMaterial>;
type V3 = [number, number, number];

function put(g: Group, geo: Mesh['geometry'], mat: Mat, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) {
  const m = new Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = true;
  g.add(markStatic(m));
}

const crate = (g: Group, hex: string) => {
  put(g, roundedBox(0.9, 0.7, 0.8, 0.08), woodMaterial(hex), [0, 0.35, 0]);
  put(g, roundedBox(0.95, 0.1, 0.85, 0.04), woodMaterial('#8a5a3c'), [0, 0.72, 0]);
};
const jar = (g: Group, hex: string, lid: string) => {
  put(g, new CylinderGeometry(0.32, 0.36, 0.7, 20), toyMaterial(hex, { finish: 'satin' }), [0, 0.35, 0]);
  put(g, new CylinderGeometry(0.34, 0.34, 0.12, 20), toyMaterial(lid), [0, 0.76, 0]);
  put(g, ball(0.08, 10), toyMaterial(lid), [0, 0.86, 0]);
};
const books = (g: Group) => {
  const cols = [PALETTE.berry, PALETTE.sea, PALETTE.sun, PALETTE.leaf];
  cols.forEach((c, i) => {
    put(
      g,
      roundedBox(0.8 - i * 0.06, 0.16, 0.55, 0.03),
      toyMaterial(c),
      [0, 0.08 + i * 0.17, 0],
      [0, i * 0.18, 0],
    );
  });
};
const lamp = (g: Group, shade: string) => {
  put(g, new CylinderGeometry(0.22, 0.26, 0.08, 16), toyMaterial(PALETTE.ink), [0, 0.04, 0]);
  put(g, new CylinderGeometry(0.04, 0.04, 0.8, 8), metalMaterial('#cfd6e4'), [0, 0.45, 0]);
  put(g, new ConeGeometry(0.36, 0.42, 20, 1, true), toyMaterial(shade, { rimStrength: 0.6 }), [0, 0.95, 0]);
};
const plant = (g: Group, pot: string) => {
  put(g, new CylinderGeometry(0.3, 0.22, 0.45, 16), toyMaterial(pot), [0, 0.22, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    put(g, ball(0.2, 12), toyMaterial(PALETTE.leaf), [
      Math.cos(a) * 0.16,
      0.6 + (i % 2) * 0.12,
      Math.sin(a) * 0.16,
    ]);
  }
};
const teddy = (g: Group, fur: string) => {
  const m = toyMaterial(fur, { finish: 'matte' });
  put(g, ball(0.3, 16), m, [0, 0.3, 0]);
  put(g, ball(0.22, 16), m, [0, 0.72, 0]);
  for (const x of [-0.16, 0.16]) put(g, ball(0.08, 10), m, [x, 0.9, 0]);
  put(g, ball(0.07, 10), toyMaterial('#f2d3b1'), [0, 0.68, 0.18]);
  for (const x of [-0.08, 0.08]) put(g, ball(0.03, 8), toyMaterial(PALETTE.ink), [x, 0.78, 0.19]);
};
const clock = (g: Group, hex: string) => {
  put(g, roundedBox(0.5, 1.1, 0.35, 0.08), woodMaterial(hex), [0, 0.55, 0]);
  put(
    g,
    new CylinderGeometry(0.2, 0.2, 0.05, 20),
    toyMaterial(PALETTE.cream),
    [0, 0.82, 0.18],
    [Math.PI / 2, 0, 0],
  );
  put(g, capsule(0.015, 0.12), toyMaterial(PALETTE.ink), [0, 0.86, 0.21]);
};
const chest = (g: Group) => {
  put(g, roundedBox(1, 0.55, 0.65, 0.08), woodMaterial('#a0643c'), [0, 0.28, 0]);
  put(
    g,
    new CylinderGeometry(0.33, 0.33, 1, 16, 1, false, 0, Math.PI),
    woodMaterial('#b8743f'),
    [0, 0.56, 0],
    [0, 0, Math.PI / 2],
  );
  put(g, roundedBox(0.16, 0.2, 0.08, 0.03), metalMaterial('#f2b632', 0.2), [0, 0.5, 0.34]);
};
const coins = (g: Group) => {
  const gold = metalMaterial('#f2b632', 0.22);
  for (let i = 0; i < 7; i++)
    put(g, new CylinderGeometry(0.16, 0.16, 0.05, 16), gold, [
      (i % 3) * 0.12 - 0.12,
      0.03 + Math.floor(i / 3) * 0.055,
      0,
    ]);
};
const crown = (g: Group) => {
  const gold = metalMaterial('#f2b632', 0.2);
  put(g, new CylinderGeometry(0.22, 0.22, 0.35, 16), toyMaterial(PALETTE.berry), [0, 0.18, 0]);
  put(g, new TorusGeometry(0.3, 0.04, 8, 24), gold, [0, 0.5, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    put(g, new ConeGeometry(0.06, 0.2, 8), gold, [Math.cos(a) * 0.3, 0.62, Math.sin(a) * 0.3]);
  }
};
const mushroom = (g: Group) => {
  put(g, new CylinderGeometry(0.12, 0.16, 0.4, 12), toyMaterial(PALETTE.cream), [0, 0.2, 0]);
  put(g, ball(0.36, 16), toyMaterial(PALETTE.berry), [0, 0.42, 0], [0, 0, 0], [1, 0.6, 1]);
  for (const [x, z] of [
    [0.12, 0.2],
    [-0.18, 0.08],
    [0.05, -0.2],
  ] as const)
    put(g, ball(0.06, 8), toyMaterial(PALETTE.white), [x, 0.58, z]);
};
const can = (g: Group) => {
  put(g, new CylinderGeometry(0.3, 0.34, 0.55, 16), metalMaterial('#7cc8e0', 0.3), [0, 0.28, 0]);
  put(g, capsule(0.05, 0.5), metalMaterial('#7cc8e0', 0.3), [0.4, 0.45, 0], [0, 0, -0.9]);
  put(g, new TorusGeometry(0.2, 0.04, 8, 16, Math.PI), metalMaterial('#7cc8e0', 0.3), [-0.1, 0.62, 0]);
};

const BUILDERS: Record<RoomTheme, ((g: Group) => void)[]> = {
  kitchen: [
    (g) => jar(g, '#ffd8a8', PALETTE.berry),
    (g) => jar(g, PALETTE.sky, PALETTE.sea),
    (g) => crate(g, '#e8c9a0'),
    (g) => teddy(g, '#c98a5c'),
    (g) => plant(g, '#e8a27c'),
    (g) => clock(g, '#c98a5c'),
  ],
  study: [
    books,
    (g) => lamp(g, PALETTE.sun),
    (g) => clock(g, '#8a5a3c'),
    (g) => crate(g, '#c9a27e'),
    books,
    (g) => plant(g, PALETTE.sea),
  ],
  attic: [
    (g) => crate(g, '#c9a27e'),
    (g) => teddy(g, '#b98fd9'),
    chest,
    (g) => lamp(g, PALETTE.peach),
    (g) => crate(g, '#a98a6e'),
    (g) => clock(g, '#7a5a4c'),
  ],
  garden: [
    mushroom,
    can,
    (g) => plant(g, '#e8a27c'),
    (g) => plant(g, PALETTE.lavender),
    mushroom,
    (g) => crate(g, '#c9a27e'),
  ],
  treasure: [chest, coins, crown, chest, coins, (g) => jar(g, '#f2d06b', PALETTE.berry)],
};

export function propModel(theme: RoomTheme, kind: number): Group {
  const g = new Group();
  const build = BUILDERS[theme][kind % 6] ?? ((x: Group) => crate(x, '#c9a27e'));
  build(g);
  mergeStatic(g);
  return g;
}

/** Wall / floor colours per room. */
export const ROOM_COLORS: Record<RoomTheme, { wall: string; floor: string; trim: string }> = {
  kitchen: { wall: '#fff0d6', floor: '#f6c9a0', trim: PALETTE.berry },
  study: { wall: '#dfe9ff', floor: '#c9a27e', trim: PALETTE.sea },
  attic: { wall: '#f0e2ff', floor: '#b98f6e', trim: PALETTE.lavender },
  garden: { wall: '#dff7e6', floor: '#9fd59a', trim: PALETTE.leaf },
  treasure: { wall: '#fff3c4', floor: '#e8b86b', trim: '#f2b632' },
};
