/**
 * The pizza shop's five places (D62). Counter, oven, packing table, door and customers stay where play
 * needs them; each place recolours the shop (floor, wall, wainscot, awning) and dresses the outside.
 *  ① 마을 피자집 — flower pots by the door, butterflies
 *  ② 해변 푸드트럭 — the sea round the table, palms, a parasol, gulls, a crab on the sand
 *  ③ 우주 피자 정거장 — space outside, a ringed planet turning, twinkling stars, a hovering drone
 *  ④ 눈 산장 — snow falling, snowy pines, a snowman waving from the side
 *  ⑤ 밤 야시장 — night, paper lanterns swaying on strings, fireflies, a sky of stars
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
import { crab, snowman, tree } from '../../engine/life/critters';
import { bob, critters, fall, flock, flutter, glow, type Life, spin, sway } from '../../engine/life/life';
import { PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial, waterMaterial } from '../../engine/tsl/materials';
import type { Mood } from '../../engine/world';
import type { GroundShape } from '../_shared/diorama';

export interface PizzaLook {
  shape: GroundShape;
  ground: string;
  floor: string;
  wall: string;
  wainscot: string;
  stripe: string;
}

export const PIZZA_LOOKS: readonly PizzaLook[] = [
  {
    shape: 'round',
    ground: PALETTE.cream,
    floor: '#f7dcb4',
    wall: '#fff1d9',
    wainscot: '#7cc6a4',
    stripe: '#e2492f',
  },
  {
    shape: 'blob',
    ground: '#f2d39a',
    floor: '#d9a874',
    wall: '#bfeef2',
    wainscot: '#2fb4cc',
    stripe: '#2fb4cc',
  },
  {
    shape: 'hex',
    ground: '#8f9bb8',
    floor: '#aab4cc',
    wall: '#3b3870',
    wainscot: '#6f7bd0',
    stripe: '#9b7cf0',
  },
  {
    shape: 'square',
    ground: '#f3f7fb',
    floor: '#c98a5c',
    wall: '#b98a5c',
    wainscot: '#8a5a3c',
    stripe: '#e2492f',
  },
  {
    shape: 'round',
    ground: '#3c3658',
    floor: '#6b5a7e',
    wall: '#ffe6c2',
    wainscot: '#c9473f',
    stripe: '#ff8a3c',
  },
];

export const PIZZA_MOODS: readonly Mood[] = [
  { sky: { top: '#9fd8ff', bottom: '#fff1d6' } },
  { sky: { top: '#5fc9ff', bottom: '#e9fbff' }, sunI: 3.5 },
  {
    sky: { top: '#0b0b2a', bottom: '#2c2a66' },
    sun: '#cfe0ff',
    sunI: 2.5,
    hemi: 0.4,
    fogNear: 40,
    fogFar: 120,
  },
  { sky: { top: '#b8cde6', bottom: '#f6f9ff' }, sun: '#eef6ff', sunI: 2.7, hemi: 0.55 },
  {
    sky: { top: '#16133a', bottom: '#4a3f7a' },
    sun: '#ffc48a',
    sunI: 1.6,
    hemi: 0.35,
    fogNear: 40,
    fogFar: 110,
  },
];

const shadows = (o: Object3D) =>
  o.traverse((c) => {
    c.castShadow = true;
  });

function palm(): Group {
  const g = new Group();
  for (let i = 0; i < 5; i++) {
    const seg = new Mesh(
      new CylinderGeometry(0.16, 0.19, 0.6, 10),
      toyMaterial('#b98a5c', { finish: 'satin' }),
    );
    seg.position.set(i * 0.05, 0.3 + i * 0.55, 0);
    g.add(seg);
  }
  const top = new Group();
  for (let k = 0; k < 6; k++) {
    const leaf = new Mesh(capsule(0.16, 1.4), toyMaterial('#3fae6a'));
    leaf.scale.set(1, 1, 0.35);
    leaf.rotation.set(0, (k / 6) * Math.PI * 2, 1.15);
    leaf.position.y = 0.2;
    top.add(leaf);
  }
  top.position.set(0.25, 2.95, 0);
  g.add(top);
  return g;
}

export function dressPizza(map: number, root: Group, life: Life) {
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
        ['#ff6f91', 5.9, 2.6],
        ['#ffd23f', 5.9, -1.0],
      ] as const) {
        const pot = new Group();
        const base = new Mesh(new CylinderGeometry(0.35, 0.28, 0.5, 14), toyMaterial('#c96b4f'));
        base.position.y = 0.25;
        pot.add(base);
        for (let k = 0; k < 3; k++) {
          const f = new Mesh(ball(0.16, 10), toyMaterial(c));
          f.position.set(Math.cos(k * 2.1) * 0.15, 0.7 + k * 0.05, Math.sin(k * 2.1) * 0.15);
          pot.add(f);
        }
        add(pot, x, 0, z);
      }
      flutter(life, {
        count: 5,
        center: [0, 1.6, 2],
        radius: 6,
        height: [0.6, 3],
        colors: ['#ffd23f', '#ff8fc0', '#4fc3ff'],
      });
      break;
    }
    case 1: {
      const sea = new Mesh(disc(30, 0.1, 64), waterMaterial('#0f78b8', '#4fd0f0', 30));
      sea.position.y = -1.12;
      root.add(sea);
      add(palm(), 6.0, 0, -2.4);
      add(palm(), -6.4, 0, -2.8, 1);
      const parasol = new Group();
      const stick = new Mesh(new CylinderGeometry(0.05, 0.05, 2.4, 8), toyMaterial('#ffffff'));
      stick.position.y = 1.2;
      const shade = new Mesh(new ConeGeometry(1.2, 0.5, 12), toyMaterial('#ff6f91'));
      shade.position.y = 2.4;
      parasol.add(stick, shade);
      add(parasol, 6.1, 0, 2.4);
      critters(life, {
        make: () => crab(1),
        count: 2,
        path: { kind: 'line', from: [5.2, 0.05, 4.4], to: [6.6, 0.05, 0.6] },
        speed: 0.05,
        gait: 'scuttle',
        spacing: 0.5,
      });
      flock(life, { count: 5, center: [0, 0, -3], radius: 8, height: 7, color: '#ffffff', size: 0.5 });
      break;
    }
    case 2: {
      const planet = new Group();
      const globe = new Mesh(ball(1.6, 24), toyMaterial('#7fd0ff', { finish: 'satin' }));
      const ring = new Mesh(new TorusGeometry(2.4, 0.1, 6, 48), toyMaterial('#ffe08a', { rimStrength: 0.6 }));
      ring.rotation.x = 1.25;
      planet.add(globe, ring);
      add(planet, 5.4, 6.8, -6);
      spin(life, planet, 0.25, 'y');
      fall(life, {
        count: 90,
        min: [-16, 4, -14],
        max: [16, 16, -5],
        kind: 'star',
        colors: ['#ffffff', '#bfe3ff', '#fff6b0'],
      });
      // a little delivery drone hovering by the door
      const drone = new Group();
      const body = new Mesh(ball(0.35, 16), metalMaterial('#cfd6e4'));
      body.scale.set(1, 0.6, 1);
      const eye = new Mesh(ball(0.12, 10), new MeshBasicNodeMaterial({ color: '#7fe8ff' }));
      eye.position.set(0, 0, 0.3);
      drone.add(body, eye);
      const props: Object3D[] = [];
      for (const sx of [-1, 1]) {
        const prop = new Mesh(roundedBox(0.6, 0.03, 0.1, 0.02), toyMaterial('#2c3350'));
        prop.position.set(sx * 0.45, 0.2, 0);
        drone.add(prop);
        props.push(prop);
      }
      add(drone, 5.6, 3.4, 2.2);
      for (const p of props) spin(life, p, 18, 'y');
      bob(life, [drone], 0.25, 1.4);
      break;
    }
    case 3: {
      add(tree('pine', '#4f9c6a', 1.4, true), -6.6, 0, -2.0);
      add(tree('pine', '#5aa874', 1.1, true), 6.3, 0, -2.6);
      add(tree('pine', '#4f9c6a', 0.9, true), 6.8, 0, 0.2);
      const man = snowman(1.2);
      add(man, 6.0, 0, 2.6, -0.6);
      sway(life, [man], 0.05, 1.2);
      fall(life, { count: 110, min: [-9, 0, -8], max: [9, 10, 6], kind: 'snow', colors: ['#ffffff'] });
      break;
    }
    case 4: {
      // strings of paper lanterns across the front
      const lanterns: Object3D[] = [];
      const colors = ['#ff5f5f', '#ffb84d', '#ff8fc0'];
      for (let i = 0; i < 9; i++) {
        const l = new Group();
        const body = new Mesh(ball(0.28, 14), new MeshBasicNodeMaterial({ color: colors[i % 3] as string }));
        body.scale.set(1, 1.2, 1);
        const cap = new Mesh(new CylinderGeometry(0.12, 0.12, 0.08, 10), toyMaterial('#3b3355'));
        cap.position.y = 0.36;
        l.add(body, cap);
        // two strings along the sides of the shop (clear of the counter, the sign and the customers' door)
        const side = i < 5 ? 1 : -1;
        const k = i < 5 ? i : i - 5;
        l.position.set(side * (6.1 - k * 0.12), 3.3 - Math.sin((k / 4) * Math.PI) * 0.35, -2.6 + k * 1.3);
        root.add(l);
        lanterns.push(l);
      }
      sway(life, lanterns, 0.12, 1.6);
      glow(life, {
        count: 26,
        center: [0, 0.8, 2],
        radius: 7,
        height: [0.4, 3.2],
        color: '#fff27a',
        size: 0.06,
      });
      fall(life, {
        count: 70,
        min: [-16, 7, -14],
        max: [16, 16, -6],
        kind: 'star',
        colors: ['#ffffff', '#fff6b0'],
      });
      break;
    }
  }
}
