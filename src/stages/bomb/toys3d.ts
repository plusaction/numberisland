/**
 * The bomb-squad gift toys as little procedural models (~0.6 tall, base on y = 0). Each is a handful of
 * shared shapes batched per material, so a full shelf of ten costs few draw calls. Original simple toys (P3).
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, TorusGeometry } from 'three/webgpu';
import type { ToyId } from '../../domain/toys';
import { markStatic, mergeStatic } from '../../engine/geo/merge';
import { ball, capsule, roundedBox } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial } from '../../engine/tsl/materials';

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

const eyes = (g: Group, y: number, z: number, gap = 0.08, r = 0.035) => {
  for (const x of [-gap, gap]) put(g, ball(r, 10), toyMaterial(PALETTE.ink), [x, y, z]);
};

const BUILD: Record<ToyId, (g: Group) => void> = {
  top(g) {
    put(g, new ConeGeometry(0.3, 0.36, 20), toyMaterial(PALETTE.berry), [0, 0.2, 0], [Math.PI, 0, 0]);
    put(g, new CylinderGeometry(0.3, 0.3, 0.08, 20), toyMaterial(PALETTE.sun), [0, 0.4, 0]);
    put(g, new CylinderGeometry(0.04, 0.04, 0.22, 10), toyMaterial(PALETTE.cocoa), [0, 0.54, 0]);
  },
  robot(g) {
    const grey = toyMaterial('#9fb3c8');
    put(g, roundedBox(0.4, 0.32, 0.3, 0.06), grey, [0, 0.2, 0]);
    put(g, roundedBox(0.3, 0.22, 0.26, 0.06), grey, [0, 0.48, 0]);
    put(g, capsule(0.015, 0.12), toyMaterial(PALETTE.ink), [0, 0.66, 0]);
    put(g, ball(0.045, 10), toyMaterial(PALETTE.berry), [0, 0.74, 0]);
    put(g, roundedBox(0.16, 0.08, 0.02, 0.02), toyMaterial(PALETTE.sun), [0, 0.22, 0.155]);
    eyes(g, 0.5, 0.13, 0.07, 0.04);
  },
  dino(g) {
    const green = toyMaterial('#6fcf7f');
    put(g, ball(0.22, 16), green, [0, 0.22, 0], [0, 0, 0], [1.3, 0.9, 0.9]);
    put(g, ball(0.14, 14), green, [0.28, 0.42, 0]);
    put(g, new ConeGeometry(0.1, 0.32, 10), green, [-0.36, 0.2, 0], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 3; i++)
      put(g, new ConeGeometry(0.05, 0.1, 8), toyMaterial(PALETTE.sun), [-0.12 + i * 0.12, 0.42, 0]);
    for (const z of [-0.07, 0.07]) put(g, ball(0.03, 8), toyMaterial(PALETTE.ink), [0.36, 0.46, z]);
  },
  rocket(g) {
    put(g, new CylinderGeometry(0.13, 0.13, 0.42, 16), toyMaterial(PALETTE.white), [0, 0.3, 0]);
    put(g, new ConeGeometry(0.13, 0.2, 16), toyMaterial(PALETTE.berry), [0, 0.61, 0]);
    put(g, ball(0.06, 12), toyMaterial('#6fd0e3'), [0, 0.38, 0.11]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      put(
        g,
        roundedBox(0.04, 0.16, 0.14, 0.02),
        toyMaterial(PALETTE.berry),
        [Math.sin(a) * 0.14, 0.1, Math.cos(a) * 0.14],
        [0, a, 0],
      );
    }
  },
  car(g) {
    put(g, roundedBox(0.56, 0.16, 0.3, 0.06), toyMaterial('#ff9a52'), [0, 0.16, 0]);
    put(g, roundedBox(0.3, 0.14, 0.26, 0.06), toyMaterial('#bfe6f2'), [-0.03, 0.3, 0]);
    for (const x of [-0.17, 0.17])
      for (const z of [-0.15, 0.15])
        put(
          g,
          new CylinderGeometry(0.07, 0.07, 0.05, 14),
          toyMaterial(PALETTE.ink),
          [x, 0.07, z],
          [Math.PI / 2, 0, 0],
        );
  },
  bear(g) {
    const fur = toyMaterial('#c98a5c', { finish: 'matte' });
    put(g, ball(0.2, 16), fur, [0, 0.2, 0]);
    put(g, ball(0.15, 16), fur, [0, 0.48, 0]);
    for (const x of [-0.11, 0.11]) put(g, ball(0.055, 10), fur, [x, 0.6, 0]);
    put(g, ball(0.06, 10), toyMaterial('#f2d3b1'), [0, 0.45, 0.12]);
    eyes(g, 0.52, 0.12, 0.06, 0.025);
  },
  tumbler(g) {
    put(g, ball(0.24, 18), toyMaterial(PALETTE.berry), [0, 0.24, 0]);
    put(g, ball(0.15, 16), toyMaterial('#ffe0c8'), [0, 0.52, 0]);
    put(g, ball(0.03, 8), toyMaterial('#ff8fab'), [0, 0.5, 0.15]);
    eyes(g, 0.56, 0.13, 0.055, 0.025);
  },
  plane(g) {
    put(g, capsule(0.09, 0.4), toyMaterial('#6fd0e3'), [0, 0.25, 0], [0, 0, Math.PI / 2]);
    put(g, roundedBox(0.14, 0.03, 0.62, 0.015), toyMaterial(PALETTE.sun), [0.02, 0.25, 0]);
    put(g, roundedBox(0.1, 0.16, 0.03, 0.015), toyMaterial(PALETTE.sun), [-0.26, 0.36, 0]);
    put(g, ball(0.035, 10), toyMaterial(PALETTE.ink), [0.33, 0.25, 0]);
  },
  octopus(g) {
    const pink = toyMaterial('#b9a6f2');
    put(g, ball(0.2, 16), pink, [0, 0.36, 0], [0, 0, 0], [1, 1.15, 1]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      put(
        g,
        capsule(0.045, 0.16),
        pink,
        [Math.sin(a) * 0.14, 0.12, Math.cos(a) * 0.14],
        [Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5],
      );
    }
    eyes(g, 0.38, 0.18, 0.07, 0.035);
  },
  crown(g) {
    const gold = metalMaterial('#f2b632', 0.2);
    put(g, new CylinderGeometry(0.24, 0.22, 0.16, 24, 1, true), gold, [0, 0.12, 0]);
    put(g, new TorusGeometry(0.23, 0.025, 8, 28), gold, [0, 0.05, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      put(g, new ConeGeometry(0.05, 0.16, 8), gold, [Math.sin(a) * 0.23, 0.27, Math.cos(a) * 0.23]);
      put(g, ball(0.03, 8), toyMaterial(i % 2 ? PALETTE.berry : '#6fd0e3'), [
        Math.sin(a) * 0.23,
        0.36,
        Math.cos(a) * 0.23,
      ]);
    }
  },
};

export function toyModel(id: ToyId): Group {
  const g = new Group();
  BUILD[id](g);
  mergeStatic(g);
  return g;
}
