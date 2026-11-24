/**
 * The card duel's five arenas (D62). The table, hands, bot and score marks stay where play needs them;
 * each arena recolours the table and its light rings and fills the space around.
 *  ① 네온 아레나 — sweeping spotlights, twinkling sparkles
 *  ② 숲속 그루터기 — a tree stump table, trees and toadstools, squirrel fans, falling leaves
 *  ③ 해적 갑판 — the sea all round, a mast with a flag, a treasure chest of gems, gulls
 *  ④ 얼음 궁전 — ice pillars, falling snow, penguin fans waddling
 *  ⑤ 별빛 우주 — planets circling, shooting stars, a sky full of stars
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
import { ball, disc, gemGeo, roundedBox } from '../../engine/geo/shapes';
import { glowShroom, penguin, squirrel, tree } from '../../engine/life/critters';
import { bob, critters, drift, fall, flock, type Life, spin, sway } from '../../engine/life/life';
import { GEM_COLORS } from '../../engine/palette';
import { toyMaterial, waterMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { Mood } from '../../engine/world';
import type { GroundShape } from '../_shared/diorama';

export interface CardLook {
  shape: GroundShape;
  ground: string;
  table: string;
  neon: [string, string];
}

export const CARD_LOOKS: readonly CardLook[] = [
  { shape: 'round', ground: '#2b2f6b', table: '#33397a', neon: ['#6fe3ff', '#ff8fd0'] },
  { shape: 'blob', ground: '#6fbf5a', table: '#c98a5c', neon: ['#ffd23f', '#9be07d'] },
  { shape: 'square', ground: '#a8744a', table: '#8a5a3c', neon: ['#f2b632', '#ff5f5f'] },
  { shape: 'hex', ground: '#e6f2fb', table: '#9fd0f0', neon: ['#ffffff', '#6fe3ff'] },
  { shape: 'flower', ground: '#141238', table: '#0f0d33', neon: ['#ffd23f', '#9b7cf0'] },
];

export const CARD_MOODS: readonly Mood[] = [
  { sky: { top: '#1d1b4a', bottom: '#5a4f9a' }, sunI: 2.6, hemi: 0.4 },
  { sky: { top: '#8fd3ff', bottom: '#f2ffe6' }, sunI: 3.2 },
  { sky: { top: '#5fc9ff', bottom: '#e9fbff' }, sunI: 3.5 },
  { sky: { top: '#b8d7f2', bottom: '#f6faff' }, sun: '#eef6ff', sunI: 2.7, hemi: 0.6 },
  {
    sky: { top: '#090826', bottom: '#2c2a66' },
    sun: '#cfe0ff',
    sunI: 2.2,
    hemi: 0.35,
    fogNear: 40,
    fogFar: 120,
  },
];

const shadows = (o: Object3D) =>
  o.traverse((c) => {
    c.castShadow = true;
  });

export function dressCards(map: number, root: Group, life: Life) {
  const add = (o: Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    shadows(o);
    root.add(o);
    return o;
  };
  switch (map) {
    case 0: {
      // two spotlight beams sweeping over the arena from the back corners
      for (const [x, c] of [
        [-5.6, '#6fe3ff'],
        [5.6, '#ff8fd0'],
      ] as const) {
        const pivot = new Group();
        const beam = new Mesh(
          new ConeGeometry(1.1, 7, 16, 1, true),
          new MeshBasicNodeMaterial({ color: c, transparent: true, opacity: 0.18, depthWrite: false }),
        );
        beam.position.y = -3.5;
        pivot.add(beam);
        pivot.rotation.x = 0.55;
        add(pivot, x, 6.5, -5.2);
        sway(life, [pivot], 0.35, 0.8);
        const lamp = new Mesh(new CylinderGeometry(0.3, 0.4, 0.5, 12), toyMaterial('#2c3350'));
        add(lamp, x, 6.6, -5.2);
      }
      fall(life, {
        count: 50,
        min: [-8, 1, -7],
        max: [8, 7, 3],
        kind: 'star',
        colors: ['#ffffff', '#6fe3ff', '#ff8fd0'],
      });
      break;
    }
    case 1: {
      // tree-stump rings on the table come from its wood colour; trees, toadstools and squirrel fans around
      for (let i = 0; i < 4; i++) {
        const ring = new Mesh(new TorusGeometry(1.2 + i * 1.0, 0.03, 6, 72), toyMaterial('#a8663a'));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.255;
        root.add(ring);
      }
      add(tree('round', '#6cc85a', 1.4), -6.0, 0, -4.0);
      add(tree('round', '#ffb23c', 1.2), 6.2, 0, -3.6);
      add(tree('round', '#86d66b', 1.1), 0.5, 0, -6.4);
      for (const [x, z, c] of [
        [-6.2, 1.6, '#ff6b5c'],
        [6.4, 2.2, '#ff9fc5'],
      ] as const) {
        const shroom = glowShroom(1.4, c);
        add(shroom, x, 0, z);
      }
      critters(life, {
        make: () => squirrel(1.3),
        count: 3,
        path: { kind: 'line', from: [-3.2, 0.05, -5.8], to: [3.6, 0.05, -5.8] },
        speed: 0,
        gait: 'idle',
        spacing: 0.33,
      });
      critters(life, {
        make: () => squirrel(1),
        count: 1,
        path: { kind: 'loop', center: [0, 0.05, 0], rx: 6.3, rz: 6.1 },
        speed: 0.03,
        gait: 'hop',
      });
      fall(life, {
        count: 55,
        min: [-8, 0.5, -7],
        max: [8, 8, 4],
        kind: 'leaf',
        colors: ['#ffb23c', '#ff8a3c', '#9be07d'],
      });
      break;
    }
    case 2: {
      const sea = new Mesh(disc(30, 0.1, 64), waterMaterial('#0f6fae', '#47c6e8', 30));
      sea.position.y = -1.12;
      root.add(sea);
      bob(life, [sea], 0.05, 0.8);
      const mast = new Group();
      const pole = new Mesh(new CylinderGeometry(0.16, 0.2, 7, 12), woodMaterial('#6b4a34'));
      pole.position.y = 3.5;
      const flag = new Mesh(roundedBox(1.2, 0.7, 0.04, 0.02), toyMaterial('#2c3350'));
      flag.position.set(0.65, 6.6, 0);
      const skull = new Mesh(ball(0.16, 12), toyMaterial('#ffffff'));
      skull.position.set(0.65, 6.6, 0.05);
      mast.add(pole, flag, skull);
      add(mast, -5.8, 0, -4.4);
      sway(life, [flag, skull], 0.25, 3);
      // a treasure chest spilling gems
      const chest = new Group();
      const box = new Mesh(roundedBox(1.3, 0.7, 0.85, 0.1), woodMaterial('#a0643c'));
      box.position.y = 0.35;
      const lid = new Mesh(roundedBox(1.32, 0.25, 0.87, 0.1), woodMaterial('#b8743f'));
      lid.position.set(0, 0.85, -0.4);
      lid.rotation.x = -1.1;
      chest.add(box, lid);
      for (let i = 0; i < 9; i++) {
        const g = new Mesh(
          gemGeo(0.16),
          toyMaterial(GEM_COLORS[i % 4] as string, { roughness: 0.06, rimStrength: 0.4 }),
        );
        g.position.set(-0.4 + (i % 3) * 0.4, 0.75 + Math.floor(i / 3) * 0.12, -0.15 + (i % 2) * 0.2);
        g.rotation.set(i, i * 2, 0);
        chest.add(g);
      }
      add(chest, 5.8, 0, -3.6, -0.5);
      flock(life, { count: 5, center: [0, 0, -2], radius: 8, height: 7, color: '#ffffff', size: 0.5 });
      break;
    }
    case 3: {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + 0.25 + (i / 6) * (Math.PI - 0.5);
        const h = 2.4 + (i % 3) * 0.9;
        const pillar = new Mesh(
          new CylinderGeometry(0.4, 0.5, h, 6),
          toyMaterial('#cfeaff', { roughness: 0.1, rimStrength: 0.5 }),
        );
        add(pillar, Math.cos(a) * 6.3, h / 2, Math.sin(a) * 6.1);
        const tip = new Mesh(
          new ConeGeometry(0.42, 0.7, 6),
          toyMaterial('#ffffff', { roughness: 0.1, rimStrength: 0.6 }),
        );
        add(tip, Math.cos(a) * 6.3, h + 0.35, Math.sin(a) * 6.1);
      }
      critters(life, {
        make: () => penguin(1.1),
        count: 3,
        path: { kind: 'line', from: [-3.4, 0.05, -5.9], to: [3.4, 0.05, -5.9] },
        speed: 0.03,
        gait: 'waddle',
        spacing: 0.33,
      });
      fall(life, { count: 100, min: [-9, 0, -8], max: [9, 9, 5], kind: 'snow', colors: ['#ffffff'] });
      break;
    }
    case 4: {
      // planets circling the arena
      const orbits: [string, number, number, number][] = [
        ['#ff9f6a', 6.4, 2.0, 0.25],
        ['#7fd0ff', 7.2, 3.2, -0.18],
      ];
      for (const [c, r, y, sp] of orbits) {
        const orbit = new Group();
        const planet = new Mesh(ball(0.7, 20), toyMaterial(c, { finish: 'satin' }));
        planet.position.set(r, y, 0);
        orbit.add(planet);
        if (c === '#ff9f6a') {
          const ring = new Mesh(
            new TorusGeometry(1.1, 0.06, 6, 40),
            toyMaterial('#ffe08a', { rimStrength: 0.5 }),
          );
          ring.rotation.x = 1.2;
          ring.position.copy(planet.position);
          orbit.add(ring);
        }
        orbit.position.z = -2;
        root.add(orbit);
        spin(life, orbit, sp, 'y');
      }
      fall(life, {
        count: 110,
        min: [-16, 2, -14],
        max: [16, 16, -5],
        kind: 'star',
        colors: ['#ffffff', '#bfe3ff', '#fff6b0'],
      });
      // the table itself is a little galaxy: sparkles twinkling just above it, and a big moon behind
      fall(life, {
        count: 40,
        min: [-5, 0.35, -4.5],
        max: [5, 0.6, 4.5],
        kind: 'star',
        colors: ['#ffffff', '#fff6b0', '#bfe3ff'],
      });
      const moon = new Mesh(ball(1.4, 28), new MeshBasicNodeMaterial({ color: '#fff3c4' }));
      add(moon, 4.6, 3.0, -8.5);
      // shooting stars streaking across the back
      const meteors: Object3D[] = [];
      for (let i = 0; i < 2; i++) {
        const m = new Mesh(
          roundedBox(1.6, 0.06, 0.06, 0.03),
          new MeshBasicNodeMaterial({ color: '#fff6c8' }),
        );
        m.rotation.z = -0.35;
        m.position.set(-10 + i * 11, 9 - i * 1.5, -9);
        root.add(m);
        meteors.push(m);
      }
      drift(life, meteors, 34, 6);
      break;
    }
  }
}
