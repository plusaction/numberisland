/**
 * The escape game's five houses (D62). Each house keeps the same rooms, clue hunt and lock; its rooms take
 * the house's tint, its window shows the house's outside, and the space round the house lives.
 *  ① 숲속 오두막 — trees outside, birds, butterflies
 *  ② 잠수함 집 — under the sea: a deep-blue window, bubbles rising, a school of fish round the house
 *  ③ 과자 집 — cookie-coloured rooms, candy canes and lollipops outside, sprinkles in the air
 *  ④ 하늘 성 — above the clouds: clouds drifting past, birds, a castle tower
 *  ⑤ 시계탑 — a big gear turning on the wall, a swinging pendulum, a dusk sky
 */
import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  type Object3D,
  TorusGeometry,
} from 'three/webgpu';
import { ball, capsule, disc, roundedBox } from '../../engine/geo/shapes';
import { tree } from '../../engine/life/critters';
import { critters, drift, fall, flock, flutter, type Life, spin, sway } from '../../engine/life/life';
import { PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial } from '../../engine/tsl/materials';
import type { Mood } from '../../engine/world';
import type { GroundShape } from '../_shared/diorama';

export interface EscapeLook {
  shape: GroundShape;
  ground: string;
  /** Mixed into every room colour (0 = the room's own colours). */
  tint: string;
  tintAmount: number;
  window: string;
}

export const ESCAPE_LOOKS: readonly EscapeLook[] = [
  { shape: 'round', ground: PALETTE.cream, tint: '#ffffff', tintAmount: 0, window: '#5fb8f0' },
  { shape: 'hex', ground: '#e6d3a6', tint: '#4fb3d9', tintAmount: 0.35, window: '#0f4f86' },
  { shape: 'flower', ground: '#ffd6e7', tint: '#c98a5c', tintAmount: 0.4, window: '#ffb8d9' },
  { shape: 'flower', ground: '#ffffff', tint: '#bfe3ff', tintAmount: 0.3, window: '#8fd3ff' },
  { shape: 'square', ground: '#c9a27e', tint: '#d9a441', tintAmount: 0.3, window: '#ff9f8a' },
];

export const ESCAPE_MOODS: readonly Mood[] = [
  { sky: { top: '#9fd8ff', bottom: '#fff1d6' } },
  {
    sky: { top: '#0f4f86', bottom: '#4fc3e8' },
    sun: '#bfefff',
    sunI: 2.6,
    hemi: 0.6,
    fogNear: 22,
    fogFar: 70,
  },
  { sky: { top: '#ffb8d9', bottom: '#fff0f6' }, sun: '#fff0f6' },
  { sky: { top: '#6fc0ff', bottom: '#ffffff' }, sunI: 3.4, hemi: 0.6 },
  { sky: { top: '#5a4f9a', bottom: '#ffb88a' }, sun: '#ffc48a', sunI: 2.6 },
];

const tmp = new Color();
/** A room colour in this house's tint. */
export function houseColor(map: number, hex: string): string {
  const look = ESCAPE_LOOKS[map];
  if (!look || look.tintAmount === 0) return hex;
  return `#${tmp.set(hex).lerp(new Color(look.tint), look.tintAmount).getHexString()}`;
}

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

export function dressEscape(map: number, root: Group, life: Life) {
  const add = (o: Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    shadows(o);
    root.add(o);
    return o;
  };
  switch (map) {
    case 0: {
      add(tree('round', '#6cc85a', 1.5), 6.0, 0, -1.6);
      add(tree('pine', '#3f9a5f', 1.3), 6.2, 0, 1.8);
      add(tree('round', '#86d66b', 1.2), -5.9, 0, 3.4);
      flock(life, { count: 4, center: [0, 0, -3], radius: 7, height: 6.5, color: '#3b3355', size: 0.4 });
      flutter(life, {
        count: 4,
        center: [5.5, 1.2, 1],
        radius: 2.2,
        height: [0.4, 2],
        colors: ['#ffd23f', '#ff8fc0'],
      });
      break;
    }
    case 1: {
      fall(life, {
        count: 60,
        min: [-7, 0, -6],
        max: [7, 9, 5],
        kind: 'bubble',
        colors: ['#e6fbff'],
        speed: 0.8,
      });
      critters(life, {
        make: (i) => fish(['#ffd23f', '#ff8a3c', '#4fc3ff', '#ff8fc0'][i % 4] as string),
        count: 6,
        path: { kind: 'loop', center: [0, 4.6, -0.5], rx: 6.5, rz: 4.8 },
        speed: 0.03,
        gait: 'swim',
        spacing: 0.05,
      });
      const weeds: Object3D[] = [];
      for (let i = 0; i < 5; i++) {
        const w = new Group();
        for (let k = 0; k < 4; k++) {
          const leaf = new Mesh(capsule(0.12, 0.6), toyMaterial(k % 2 ? '#3fae6a' : '#5cc77e'));
          leaf.position.y = 0.35 + k * 0.6;
          w.add(leaf);
        }
        add(w, 5.6 + (i % 2) * 0.6, 0, -2.4 + i * 1.2);
        weeds.push(w);
      }
      sway(life, weeds, 0.15, 1.1);
      break;
    }
    case 2: {
      for (const [x, z] of [
        [5.8, -1.8],
        [5.9, 2.6],
      ] as const) {
        const cane = new Group();
        for (let i = 0; i < 7; i++) {
          const seg = new Mesh(capsule(0.16, 0.3), toyMaterial(i % 2 ? '#ffffff' : '#ff3c5f'));
          seg.position.y = 0.25 + i * 0.4;
          cane.add(seg);
        }
        add(cane, x, 0, z);
      }
      const pop = new Group();
      const stick = new Mesh(new CylinderGeometry(0.08, 0.08, 2.4, 8), toyMaterial('#ffffff'));
      stick.position.y = 1.2;
      const head = new Group();
      const candy = new Mesh(disc(0.9, 0.24, 32), toyMaterial('#4fc3ff', { rimStrength: 0.3 }));
      candy.rotation.x = Math.PI / 2;
      const swirl = new Mesh(new TorusGeometry(0.5, 0.09, 8, 24), toyMaterial('#ffffff'));
      swirl.position.z = 0.13;
      head.add(candy, swirl);
      head.position.y = 2.7;
      pop.add(stick, head);
      add(pop, 6.2, 0, 0.4, -Math.PI / 2);
      spin(life, head, 0.6, 'z');
      fall(life, {
        count: 50,
        min: [-7, 0.5, -6],
        max: [7, 8, 5],
        kind: 'sprinkle',
        colors: ['#ff5fa2', '#4fc3ff', '#ffd23f', '#3ddc97'],
        speed: 0.8,
      });
      break;
    }
    case 3: {
      const clouds: Object3D[] = [];
      for (let i = 0; i < 7; i++) {
        const c = new Group();
        for (let k = 0; k < 3; k++) {
          const puff = new Mesh(ball(0.9 - k * 0.15, 14), toyMaterial('#ffffff', { finish: 'matte' }));
          puff.position.set(k * 0.9 - 0.9, k === 1 ? 0.3 : 0, 0);
          c.add(puff);
        }
        c.position.set(-14 + i * 4.5, -0.6 + (i % 3) * 0.4, 4 + (i % 2) * 2.2);
        root.add(c);
        clouds.push(c);
      }
      drift(life, clouds, 30, 0.6);
      const tower = new Group();
      const body = new Mesh(
        new CylinderGeometry(0.9, 1.0, 4.8, 18),
        toyMaterial('#f4f1ec', { finish: 'satin' }),
      );
      body.position.y = 2.4;
      const roof = new Mesh(new ConeGeometry(1.15, 1.6, 18), toyMaterial('#ff6f91'));
      roof.position.y = 5.6;
      const flag = new Mesh(roundedBox(0.8, 0.45, 0.04, 0.02), toyMaterial('#ffd23f'));
      flag.position.set(0.45, 6.6, 0);
      tower.add(body, roof, flag);
      add(tower, 6.0, 0, -1.6);
      sway(life, [flag], 0.3, 3);
      flock(life, { count: 5, center: [0, 0, -2], radius: 8, height: 6, color: '#3b3355', size: 0.4 });
      break;
    }
    case 4: {
      // a big brass gear turning above the room, a pendulum swinging beside the house
      const gear = new Group();
      const wheel = new Mesh(disc(1.4, 0.25, 32), metalMaterial('#d9a441', 0.3));
      wheel.rotation.x = Math.PI / 2;
      gear.add(wheel);
      for (let i = 0; i < 12; i++) {
        const tooth = new Mesh(roundedBox(0.35, 0.4, 0.25, 0.05), metalMaterial('#d9a441', 0.3));
        const a = (i / 12) * Math.PI * 2;
        tooth.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0);
        tooth.rotation.z = a;
        gear.add(tooth);
      }
      const hub = new Mesh(disc(0.35, 0.35, 16), metalMaterial('#8a5a3c', 0.3));
      hub.rotation.x = Math.PI / 2;
      gear.add(hub);
      add(gear, 3.4, 5.6, -2.9);
      spin(life, gear, 0.4, 'z');
      const small = gear.clone();
      small.scale.setScalar(0.55);
      add(small, 1.55, 5.95, -2.85);
      spin(life, small, -0.75, 'z');
      const pendulum = new Group();
      const rod = new Mesh(new CylinderGeometry(0.05, 0.05, 3.2, 8), metalMaterial('#d9a441', 0.3));
      rod.position.y = -1.6;
      const bobM = new Mesh(disc(0.45, 0.15, 24), metalMaterial('#f2b632', 0.25));
      bobM.rotation.x = Math.PI / 2;
      bobM.position.y = -3.3;
      pendulum.add(rod, bobM);
      add(pendulum, 6.2, 4.6, 0.2);
      sway(life, [pendulum], 0.45, 1.6);
      break;
    }
  }
}
