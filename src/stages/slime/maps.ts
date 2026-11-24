/**
 * The slimes' five places (D62). The tray and its eight cushions stay put (they are the board); each place
 * changes the ground, tray and cushion colours, the sky and everything around the board.
 *  ① 젤리 쟁반 — jelly desserts on the corners, butterflies
 *  ② 사탕 가게 — giant lollipops turning, candy canes, sprinkles raining
 *  ③ 비 온 뒤 정원 — a rainbow, snails creeping, puddles, butterflies
 *  ④ 바닷속 — seaweed swaying, jellyfish bobbing, a school of fish, bubbles rising
 *  ⑤ 구름 위 성 — castle towers with waving flags, clouds drifting by, birds
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Object3D,
  TorusGeometry,
} from 'three/webgpu';
import { ball, capsule, disc, roundedBox } from '../../engine/geo/shapes';
import { snail } from '../../engine/life/critters';
import { bob, critters, drift, fall, flock, flutter, type Life, spin, sway } from '../../engine/life/life';
import { PALETTE } from '../../engine/palette';
import { jellyMaterial, toyMaterial } from '../../engine/tsl/materials';
import type { Mood } from '../../engine/world';
import type { GroundShape } from '../_shared/diorama';

export interface SlimeLook {
  shape: GroundShape;
  ground: string;
  tray: string;
  pad: string;
}

export const SLIME_LOOKS: readonly SlimeLook[] = [
  { shape: 'round', ground: PALETTE.mint, tray: PALETTE.lavender, pad: '#d9cdfb' },
  { shape: 'flower', ground: '#ffc2dc', tray: '#ff8fb8', pad: '#fff0f6' },
  { shape: 'blob', ground: '#8fd17a', tray: '#c98a5c', pad: '#d9f2c9' },
  { shape: 'round', ground: '#f2dba6', tray: '#ff8a7a', pad: '#ffd6cf' },
  { shape: 'flower', ground: '#eef6ff', tray: '#7fb8ff', pad: '#ffffff' },
];

export const SLIME_MOODS: readonly Mood[] = [
  { sky: { top: '#9fd8ff', bottom: '#fff1d6' } },
  { sky: { top: '#ffb8d9', bottom: '#fff0f8' }, sun: '#fff0f6' },
  { sky: { top: '#8fd3ff', bottom: '#f2fff0' }, sunI: 3.3 },
  {
    sky: { top: '#0f5f9e', bottom: '#5fd3e8' },
    sun: '#bfefff',
    sunI: 2.5,
    hemi: 0.6,
    fogNear: 18,
    fogFar: 60,
  },
  { sky: { top: '#7fc8ff', bottom: '#ffffff' }, sunI: 3.5, hemi: 0.6 },
];

const shadows = (o: Object3D) =>
  o.traverse((c) => {
    c.castShadow = true;
  });

function fish(color: string): Group {
  const g = new Group();
  const body = new Mesh(ball(0.2, 12), toyMaterial(color));
  body.scale.set(0.6, 0.8, 1.3);
  const tail = new Mesh(new ConeGeometry(0.15, 0.25, 6), toyMaterial(color));
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.32;
  g.add(body, tail);
  return g;
}

export function dressSlime(map: number, root: Group, life: Life) {
  const add = (o: Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    shadows(o);
    root.add(o);
    return o;
  };
  switch (map) {
    case 0: {
      for (const [c, x, z] of [
        ['#ff8fb8', -6.0, -3.6],
        ['#7fe0c0', 6.0, -3.6],
        ['#ffd23f', 6.2, 3.4],
      ] as const) {
        const jelly = new Group();
        const plate = new Mesh(disc(0.8, 0.08, 24), toyMaterial('#ffffff', { finish: 'satin' }));
        const j = new Mesh(new CylinderGeometry(0.45, 0.6, 0.8, 16), jellyMaterial(c).material);
        j.position.y = 0.45;
        const cherry = new Mesh(ball(0.14, 10), toyMaterial('#ff3c5f'));
        cherry.position.y = 0.95;
        jelly.add(plate, j, cherry);
        add(jelly, x, 0, z);
      }
      flutter(life, {
        count: 5,
        center: [0, 1.5, 0],
        radius: 6,
        height: [0.8, 3],
        colors: ['#ffd23f', '#ff8fc0', '#4fc3ff'],
      });
      break;
    }
    case 1: {
      const pops: Object3D[] = [];
      for (const [c, x, z] of [
        ['#ff5fa2', -6.2, -3.2],
        ['#4fc3ff', 6.2, -3.2],
        ['#ffd23f', -6.4, 3.0],
      ] as const) {
        const pop = new Group();
        const stick = new Mesh(
          new CylinderGeometry(0.07, 0.07, 2.2, 8),
          toyMaterial('#ffffff', { finish: 'satin' }),
        );
        stick.position.y = 1.1;
        const head = new Group();
        const candy = new Mesh(disc(0.8, 0.22, 32), toyMaterial(c, { rimStrength: 0.3 }));
        candy.rotation.x = Math.PI / 2;
        const swirl = new Mesh(
          new TorusGeometry(0.45, 0.08, 8, 24),
          toyMaterial('#ffffff', { finish: 'satin' }),
        );
        swirl.position.z = 0.12;
        head.add(candy, swirl);
        head.position.y = 2.5;
        pop.add(stick, head);
        add(pop, x, 0, z);
        pops.push(head);
        spin(life, head, 0.6, 'z');
      }
      for (const [x, z] of [
        [6.3, 2.8],
        [-2.5, -4.6],
        [2.6, -4.6],
      ] as const) {
        const cane = new Group();
        for (let i = 0; i < 6; i++) {
          const seg = new Mesh(capsule(0.12, 0.25), toyMaterial(i % 2 ? '#ffffff' : '#ff3c5f'));
          seg.position.y = 0.2 + i * 0.32;
          cane.add(seg);
        }
        add(cane, x, 0, z);
      }
      fall(life, {
        count: 70,
        min: [-8, 0.5, -6],
        max: [8, 8, 5],
        kind: 'sprinkle',
        colors: ['#ff5fa2', '#4fc3ff', '#ffd23f', '#3ddc97', '#ffffff'],
        speed: 0.9,
      });
      break;
    }
    case 2: {
      const bands = ['#ff5f7e', '#ffa64d', '#ffe14d', '#5fe08a', '#4fc3ff', '#9b7cf0'];
      bands.forEach((c, i) => {
        const arc = new Mesh(
          new TorusGeometry(6.5 - i * 0.32, 0.17, 8, 48, Math.PI),
          new MeshBasicNodeMaterial({ color: c }),
        );
        arc.position.set(0, -0.2, -7.2);
        root.add(arc);
      });
      const puddles: Object3D[] = [];
      for (const [x, z, r] of [
        [-6.3, 2.4, 0.7],
        [6.4, -1.4, 0.55],
      ] as const) {
        const p = new Mesh(disc(r, 0.03, 24), toyMaterial('#8fd3ff', { roughness: 0.05, rimStrength: 0.4 }));
        p.scale.set(1.3, 1, 1);
        add(p, x, 0.03, z);
        puddles.push(p);
      }
      critters(life, {
        make: () => snail(1.2),
        count: 2,
        path: { kind: 'line', from: [-6.3, 0, -3.5], to: [-5.8, 0, 3.5] },
        speed: 0.012,
        gait: 'waddle',
        spacing: 0.5,
      });
      critters(life, {
        make: () => snail(1),
        count: 1,
        path: { kind: 'line', from: [6.2, 0, 3.2], to: [6.0, 0, -3.4] },
        speed: 0.015,
        gait: 'waddle',
      });
      flutter(life, {
        count: 5,
        center: [0, 1.6, 0],
        radius: 6.2,
        height: [0.8, 3],
        colors: ['#ffd23f', '#ff8fc0', '#ffffff'],
      });
      break;
    }
    case 3: {
      const weeds: Object3D[] = [];
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        const w = new Group();
        for (let k = 0; k < 4; k++) {
          const leaf = new Mesh(capsule(0.12, 0.6), toyMaterial(k % 2 ? '#3fae6a' : '#5cc77e'));
          leaf.position.y = 0.35 + k * 0.6;
          leaf.rotation.z = (k % 2 ? 1 : -1) * 0.2;
          w.add(leaf);
        }
        add(w, side * (6.0 + (i % 3) * 0.4), 0, -4 + Math.floor(i / 2) * 1.9);
        weeds.push(w);
      }
      sway(life, weeds, 0.15, 1.1);
      const jellies: Object3D[] = [];
      for (const [c, x, y, z] of [
        ['#ff9fd8', -4.5, 4.2, -4.5],
        ['#b9a6f2', 4.8, 5.0, -3.8],
        ['#9fe8ff', 0.5, 5.6, -5.6],
      ] as const) {
        const jf = new Group();
        const bell = new Mesh(ball(0.5, 16), jellyMaterial(c).material);
        bell.scale.set(1, 0.7, 1);
        jf.add(bell);
        for (let k = 0; k < 4; k++) {
          const t = new Mesh(capsule(0.04, 0.7), jellyMaterial(c).material);
          const a = (k / 4) * Math.PI * 2;
          t.position.set(Math.cos(a) * 0.25, -0.55, Math.sin(a) * 0.25);
          jf.add(t);
        }
        add(jf, x, y, z);
        jellies.push(jf);
      }
      bob(life, jellies, 0.45, 0.7);
      critters(life, {
        make: (i) => fish(['#ffd23f', '#ff8a3c', '#4fc3ff'][i % 3] as string),
        count: 6,
        path: { kind: 'loop', center: [0, 3.5, -1], rx: 7.5, rz: 4.5 },
        speed: 0.03,
        gait: 'swim',
        spacing: 0.04,
      });
      fall(life, {
        count: 45,
        min: [-8, 0, -6],
        max: [8, 9, 4],
        kind: 'bubble',
        colors: ['#e6fbff'],
        speed: 0.8,
      });
      break;
    }
    case 4: {
      const towers: [number, number, number][] = [
        [-6.6, -4.6, 3.0],
        [6.6, -4.6, 3.3],
        [0, -6.8, 3.8],
      ];
      const flags: Object3D[] = [];
      for (const [x, z, h] of towers) {
        const t = new Group();
        const body = new Mesh(
          new CylinderGeometry(0.9, 1.0, h, 18),
          toyMaterial('#f4f1ec', { finish: 'satin' }),
        );
        body.position.y = h / 2;
        const roof = new Mesh(new ConeGeometry(1.15, 1.6, 18), toyMaterial('#ff6f91'));
        roof.position.y = h + 0.8;
        const pole = new Mesh(new CylinderGeometry(0.04, 0.04, 0.9, 6), toyMaterial('#8a5a3c'));
        pole.position.y = h + 2;
        const flag = new Mesh(roundedBox(0.7, 0.4, 0.04, 0.02), toyMaterial('#ffd23f'));
        flag.position.set(0.35, h + 2.25, 0);
        const win = new Mesh(
          roundedBox(0.4, 0.6, 0.1, 0.15),
          new MeshBasicNodeMaterial({ color: '#fff4b8' }),
        );
        win.position.set(0, h * 0.6, 0.95);
        t.add(body, roof, pole, flag, win);
        add(t, x, 0, z);
        flags.push(flag);
      }
      sway(life, flags, 0.3, 3);
      const clouds: Object3D[] = [];
      for (let i = 0; i < 6; i++) {
        const c = new Group();
        for (let k = 0; k < 3; k++) {
          const puff = new Mesh(ball(0.8 - k * 0.15, 14), toyMaterial('#ffffff', { finish: 'matte' }));
          puff.position.set(k * 0.8 - 0.8, k === 1 ? 0.3 : 0, 0);
          c.add(puff);
        }
        c.position.set(-12 + i * 4.5, 5 + (i % 3) * 1.1, -8 - (i % 2) * 2);
        root.add(c);
        clouds.push(c);
      }
      drift(life, clouds, 28, 0.7);
      flock(life, { count: 5, center: [0, 0, -3], radius: 8, height: 7, color: '#3b3355', size: 0.4 });
      break;
    }
  }
}
