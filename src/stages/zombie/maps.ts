/**
 * The zombie party's five yards (D62). Lanes, gate, house door and the card hand stay where play needs
 * them; each yard recolours the lawn, paths and fence and dresses the space behind the fence and around.
 * Nothing scary (P3): the guests are silly and the places are cheerful.
 *  ① 마을 파티 — balloons bobbing over the fence, butterflies
 *  ② 호박밭 — pumpkins and glowing pumpkin lanterns, a swaying scarecrow, crows, falling leaves
 *  ③ 눈사람 마을 — a row of snowmen, snowy pines, falling snow
 *  ④ 해변 파티 — the sea behind, palms, a parasol, crabs, gulls
 *  ⑤ 별밤 캠핑 — night, tents, a flickering campfire, fireflies and stars
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Object3D,
} from 'three/webgpu';
import { ball, capsule, disc, roundedBox } from '../../engine/geo/shapes';
import { crab, snowman, tree } from '../../engine/life/critters';
import { bob, critters, fall, flock, flutter, glow, type Life, sway } from '../../engine/life/life';
import { toyMaterial, waterMaterial } from '../../engine/tsl/materials';
import type { Mood } from '../../engine/world';
import type { GroundShape } from '../_shared/diorama';

export interface ZombieLook {
  shape: GroundShape;
  ground: string;
  lawn: string;
  path: string;
  fence: string;
}

export const ZOMBIE_LOOKS: readonly ZombieLook[] = [
  { shape: 'round', ground: '#bfe6b0', lawn: '#a9dc98', path: '#f1e2c4', fence: '#ffffff' },
  { shape: 'blob', ground: '#d9b77a', lawn: '#c9b27a', path: '#e8d3a6', fence: '#a8744a' },
  { shape: 'hex', ground: '#f3f7fb', lawn: '#f6f9ff', path: '#cfe2f2', fence: '#ffffff' },
  { shape: 'blob', ground: '#f2d39a', lawn: '#f6dfae', path: '#c98a5c', fence: '#c98a5c' },
  { shape: 'round', ground: '#2f4a3f', lawn: '#3f6b4f', path: '#8a7a5a', fence: '#8a5a3c' },
];

export const ZOMBIE_MOODS: readonly Mood[] = [
  { sky: { top: '#9fd8ff', bottom: '#fff1d6' } },
  { sky: { top: '#ffb26b', bottom: '#ffe8c2' }, sun: '#ffcf9a', sunI: 3.0 },
  { sky: { top: '#b8cde6', bottom: '#f6f9ff' }, sun: '#eef6ff', sunI: 2.7, hemi: 0.55 },
  { sky: { top: '#5fc9ff', bottom: '#e9fbff' }, sunI: 3.5 },
  {
    sky: { top: '#141238', bottom: '#3c3780' },
    sun: '#ffc48a',
    sunI: 1.4,
    hemi: 0.32,
    fogNear: 40,
    fogFar: 110,
  },
];

const shadows = (o: Object3D) =>
  o.traverse((c) => {
    c.castShadow = true;
  });

function pumpkin(scale: number, lit: boolean): Group {
  const g = new Group();
  const body = new Mesh(
    ball(0.45, 16),
    lit ? new MeshBasicNodeMaterial({ color: '#ffb23c' }) : toyMaterial('#ff8a3c'),
  );
  body.scale.set(1.2, 0.85, 1.2);
  body.position.y = 0.38;
  const stem = new Mesh(new CylinderGeometry(0.06, 0.08, 0.22, 8), toyMaterial('#5f8a3c'));
  stem.position.y = 0.8;
  g.add(body, stem);
  g.scale.setScalar(scale);
  return g;
}

function scarecrow(): Group {
  const g = new Group();
  const pole = new Mesh(new CylinderGeometry(0.07, 0.07, 2.4, 8), toyMaterial('#8a5a3c'));
  pole.position.y = 1.2;
  const arms = new Mesh(new CylinderGeometry(0.06, 0.06, 1.8, 8), toyMaterial('#8a5a3c'));
  arms.rotation.z = Math.PI / 2;
  arms.position.y = 1.8;
  const shirt = new Mesh(roundedBox(0.8, 0.8, 0.35, 0.12), toyMaterial('#4fc3ff'));
  shirt.position.y = 1.65;
  const head = new Mesh(ball(0.3, 14), toyMaterial('#f2d39a'));
  head.position.y = 2.35;
  const hat = new Mesh(new ConeGeometry(0.45, 0.4, 14), toyMaterial('#c9844f'));
  hat.position.y = 2.65;
  g.add(pole, arms, shirt, head, hat);
  return g;
}

function tent(color: string): Group {
  const g = new Group();
  const body = new Mesh(new ConeGeometry(1.3, 1.8, 4), toyMaterial(color, { finish: 'satin' }));
  body.rotation.y = Math.PI / 4;
  body.position.y = 0.9;
  const door = new Mesh(new ConeGeometry(0.45, 0.9, 3), new MeshBasicNodeMaterial({ color: '#2a2440' }));
  door.position.set(0, 0.45, 0.62);
  g.add(body, door);
  return g;
}

export function dressZombie(map: number, root: Group, life: Life) {
  const add = (o: Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    shadows(o);
    root.add(o);
    return o;
  };
  switch (map) {
    case 0: {
      const balloons: Object3D[] = [];
      const colors = ['#ff5f7e', '#ffd23f', '#4fc3ff', '#7ee08a', '#c49bff'];
      for (let i = 0; i < 7; i++) {
        const b = new Group();
        const ball0 = new Mesh(
          ball(0.38, 16),
          toyMaterial(colors[i % colors.length] as string, { rimStrength: 0.3 }),
        );
        ball0.scale.set(1, 1.15, 1);
        const string = new Mesh(new CylinderGeometry(0.01, 0.01, 1.4, 4), toyMaterial('#ffffff'));
        string.position.y = -1.0;
        b.add(ball0, string);
        add(b, -5.2 + i * 1.6, 3.0 + (i % 2) * 0.5, -4.3);
        balloons.push(b);
      }
      bob(life, balloons, 0.22, 1.3);
      sway(life, balloons, 0.1, 1.1);
      flutter(life, {
        count: 5,
        center: [0.6, 1.6, 0],
        radius: 6.5,
        height: [0.6, 3],
        colors: ['#ffd23f', '#ff8fc0', '#ffffff'],
      });
      break;
    }
    case 1: {
      for (let i = 0; i < 9; i++) {
        const lit = i % 3 === 1;
        add(pumpkin(1.25 + (i % 2) * 0.4, lit), -3.6 + i * 1.15, 0, -4.4 - (i % 2) * 0.5, i);
      }
      const crow = scarecrow();
      add(crow, 6.4, 0, -4.2, -0.3);
      sway(life, [crow], 0.06, 1.2);
      flock(life, { count: 4, center: [0, 0, -3], radius: 8, height: 6.5, color: '#2a2440', size: 0.45 });
      fall(life, {
        count: 50,
        min: [-8, 0.5, -6],
        max: [9, 8, 5],
        kind: 'leaf',
        colors: ['#ff8a3c', '#ffb23c', '#d9714a'],
      });
      break;
    }
    case 2: {
      for (let i = 0; i < 4; i++) {
        const man = snowman(1.35 + (i % 2) * 0.3);
        add(man, -2.8 + i * 2.4, 0, -4.5, (i - 1.5) * 0.2);
      }
      add(tree('pine', '#4f9c6a', 1.3, true), -6.8, 0, -3.0);
      add(tree('pine', '#5aa874', 1.1, true), 7.6, 0, -3.4);
      fall(life, { count: 110, min: [-9, 0, -7], max: [10, 10, 6], kind: 'snow', colors: ['#ffffff'] });
      break;
    }
    case 3: {
      const sea = new Mesh(disc(30, 0.1, 64), waterMaterial('#0f78b8', '#4fd0f0', 30));
      sea.position.y = -1.12;
      root.add(sea);
      for (const [x, z] of [
        [-6.6, -4.4],
        [7.4, -4.0],
      ] as const) {
        const p = new Group();
        for (let i = 0; i < 5; i++) {
          const seg = new Mesh(
            new CylinderGeometry(0.16, 0.19, 0.6, 10),
            toyMaterial('#b98a5c', { finish: 'satin' }),
          );
          seg.position.set(i * 0.05, 0.3 + i * 0.55, 0);
          p.add(seg);
        }
        for (let k = 0; k < 6; k++) {
          const leaf = new Mesh(capsule(0.16, 1.4), toyMaterial('#3fae6a'));
          leaf.scale.set(1, 1, 0.35);
          leaf.rotation.set(0, (k / 6) * Math.PI * 2, 1.15);
          leaf.position.set(0.25, 3.15, 0);
          p.add(leaf);
        }
        add(p, x, 0, z);
      }
      const parasol = new Group();
      const stick = new Mesh(new CylinderGeometry(0.05, 0.05, 2.4, 8), toyMaterial('#ffffff'));
      stick.position.y = 1.2;
      const shade = new Mesh(new ConeGeometry(1.2, 0.5, 12), toyMaterial('#ff6f91'));
      shade.position.y = 2.4;
      parasol.add(stick, shade);
      add(parasol, 0.6, 0, -4.6);
      critters(life, {
        make: () => crab(1),
        count: 3,
        path: { kind: 'line', from: [-5.4, 0.05, -4.6], to: [5.8, 0.05, -4.6] },
        speed: 0.03,
        gait: 'scuttle',
        spacing: 0.33,
      });
      flock(life, { count: 5, center: [0, 0, -3], radius: 8, height: 7, color: '#ffffff', size: 0.5 });
      break;
    }
    case 4: {
      add(tent('#ff8a3c'), -2.2, 0, -5.4, 0.3);
      add(tent('#4fc3ff'), 3.6, 0, -5.4, -0.3);
      const fire = new Group();
      for (let i = 0; i < 5; i++) {
        const log = new Mesh(capsule(0.1, 0.7), toyMaterial('#8a5a3c'));
        log.rotation.set(Math.PI / 2, (i / 5) * Math.PI, 0);
        log.position.y = 0.1;
        fire.add(log);
      }
      const flames: Object3D[] = [];
      for (const [c, s] of [
        ['#ff8a3c', 1],
        ['#ffd23f', 0.7],
      ] as const) {
        const f = new Mesh(new ConeGeometry(0.35 * s, 1.0 * s, 8), new MeshBasicNodeMaterial({ color: c }));
        f.position.y = 0.55 * s;
        fire.add(f);
        flames.push(f);
      }
      add(fire, 0.6, 0, -4.8);
      bob(life, flames, 0.08, 7);
      sway(life, flames, 0.12, 5);
      glow(life, {
        count: 26,
        center: [0.6, 0.6, -1],
        radius: 7,
        height: [0.4, 3],
        color: '#fff27a',
        size: 0.06,
      });
      fall(life, {
        count: 80,
        min: [-16, 7, -14],
        max: [16, 16, -6],
        kind: 'star',
        colors: ['#ffffff', '#fff6b0'],
      });
      break;
    }
  }
}
