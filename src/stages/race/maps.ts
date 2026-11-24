/**
 * The five race tracks (D62). The road, lanes, karts and arches work the same everywhere; a track changes
 * the land, the road and kerb colours, the roadside trees, the sky, a far backdrop and who lives there.
 * The camera stays near the origin while the road streams past, so living things move around it.
 *  ① 꽃길 트랙 — spring meadow, butterflies, drifting petals
 *  ② 사막 협곡 — red mesas, sandy road, cacti-green cones, circling vultures, dust swirls
 *  ③ 눈 산길 — white peaks, icy planks, snow-capped pines, falling snow, sliding penguins far off
 *  ④ 해변 도로 — sea beside the boardwalk, palms, gulls, sailboats
 *  ⑤ 밤 무지개 길 — night sky full of twinkling stars, a glowing rainbow, fireflies by the road
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  TorusGeometry,
} from 'three/webgpu';
import { createRng } from '../../domain/rng/rng';
import { ball, disc, roundedBox } from '../../engine/geo/shapes';
import { penguin } from '../../engine/life/critters';
import { bob, critters, fall, flock, flutter, glow, type Life } from '../../engine/life/life';
import { toyMaterial, waterMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { Mood } from '../../engine/world';

export interface RaceLook {
  land: string;
  planks: [string, string];
  kerbs: [string, string];
  tree: [low: string, top: string];
  trunk: string;
  roof: string;
  cloud: string;
}

export const RACE_LOOKS: readonly RaceLook[] = [
  {
    land: '#8fd17a',
    planks: ['#5b6178', '#6f7691'],
    kerbs: ['#ff6f91', '#ffffff'],
    tree: ['#3fae6a', '#5cc77e'],
    trunk: '#8a5a3c',
    roof: '#ff6f91',
    cloud: '#ffffff',
  },
  {
    land: '#e8c48a',
    planks: ['#b9875a', '#c99a68'],
    kerbs: ['#ff8a3c', '#fff3dc'],
    tree: ['#4f9c5a', '#6fbd78'],
    trunk: '#4f9c5a',
    roof: '#ff8a3c',
    cloud: '#fff6e8',
  },
  {
    land: '#f3f7fb',
    planks: ['#7f9bbd', '#97b2cf'],
    kerbs: ['#4f8fe8', '#ffffff'],
    tree: ['#2f7a52', '#ffffff'],
    trunk: '#6b4a34',
    roof: '#4f8fe8',
    cloud: '#ffffff',
  },
  {
    land: '#f2d39a',
    planks: ['#b97a4c', '#c98a5c'],
    kerbs: ['#ff7a6b', '#ffffff'],
    tree: ['#2f9c5a', '#47b86f'],
    trunk: '#a0743f',
    roof: '#2fb4cc',
    cloud: '#ffffff',
  },
  {
    land: '#2c2a55',
    planks: ['#3b3870', '#4a4690'],
    kerbs: ['#ff5fa2', '#4fc3ff'],
    tree: ['#25305e', '#3a4a8a'],
    trunk: '#3a2f4f',
    roof: '#9b7cf0',
    cloud: '#5d5a9a',
  },
];

export const RACE_MOODS: readonly Mood[] = [
  { sky: { top: '#8fd3ff', bottom: '#fff1d6' } },
  { sky: { top: '#ffb26b', bottom: '#ffe8bd' }, sun: '#ffd9a0', sunI: 3.4 },
  { sky: { top: '#a9cdf0', bottom: '#f4f8ff' }, sun: '#eef6ff', sunI: 2.7, hemi: 0.6 },
  { sky: { top: '#5fc9ff', bottom: '#e9fbff' }, sunI: 3.5 },
  {
    sky: { top: '#141238', bottom: '#3c3780' },
    sun: '#a9b8ff',
    sunI: 1.2,
    hemi: 0.3,
    fogNear: 40,
    fogFar: 110,
  },
];

/** Far backdrop and life for one track. */
export function dressRace(map: number, root: Group, life: Life) {
  const rng = createRng(`race-map-${map}`);
  switch (map) {
    case 0: {
      flutter(life, {
        count: 8,
        center: [0, -0.5, -10],
        radius: 9,
        height: [0, 3],
        colors: ['#ffd23f', '#ff8fc0', '#ffffff', '#4fc3ff'],
      });
      fall(life, {
        count: 40,
        min: [-16, -3, -40],
        max: [16, 9, 6],
        kind: 'petal',
        colors: ['#ffc2dc', '#ffffff'],
        speed: 0.6,
      });
      flock(life, { count: 4, center: [0, 0, -30], radius: 12, height: 9, color: '#3b3355', size: 0.5 });
      break;
    }
    case 1: {
      // red mesas on the horizon
      for (let i = 0; i < 7; i++) {
        const side = i % 2 ? 1 : -1;
        const w = 6 + rng.float() * 8;
        const h = 4 + rng.float() * 7;
        const mesa = new Mesh(
          roundedBox(w, h, w * 0.7, 0.8),
          toyMaterial(i % 3 ? '#d9714a' : '#c75f3c', { finish: 'matte' }),
        );
        mesa.position.set(side * (22 + rng.float() * 18), -7 + h / 2, -30 - i * 9);
        root.add(mesa);
        const band = new Mesh(
          roundedBox(w * 1.01, 0.5, w * 0.71, 0.2),
          toyMaterial('#f0a070', { finish: 'matte' }),
        );
        band.position.copy(mesa.position);
        band.position.y += h * 0.15;
        root.add(band);
      }
      flock(life, { count: 4, center: [0, 0, -18], radius: 10, height: 9, color: '#4a3a3a', size: 0.7 });
      fall(life, {
        count: 50,
        min: [-14, -4, -36],
        max: [14, 3, 4],
        kind: 'leaf',
        colors: ['#e8c48a', '#d9b07a'],
        speed: 0.9,
      });
      break;
    }
    case 2: {
      // snowy peaks far away
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        const h = 14 + rng.float() * 12;
        const peak = new Mesh(new ConeGeometry(h * 0.6, h, 7), toyMaterial('#9fb4cc', { finish: 'matte' }));
        peak.position.set(side * (26 + rng.float() * 22), -7 + h / 2, -40 - i * 8);
        const cap = new Mesh(
          new ConeGeometry(h * 0.27, h * 0.45, 7),
          toyMaterial('#ffffff', { finish: 'matte' }),
        );
        cap.position.set(peak.position.x, -7 + h - h * 0.22, peak.position.z);
        root.add(peak, cap);
      }
      fall(life, { count: 120, min: [-16, -4, -34], max: [16, 9, 6], kind: 'snow', colors: ['#ffffff'] });
      critters(life, {
        make: () => penguin(1.6),
        count: 3,
        path: { kind: 'line', from: [-11, -6.7, -16], to: [-11, -6.7, -4] },
        speed: 0.06,
        gait: 'slide',
        spacing: 0.3,
      });
      break;
    }
    case 3: {
      // the sea on the right, sailboats on it
      const sea = new Mesh(disc(70, 0.2, 48), waterMaterial('#0f78b8', '#4fd0f0', 70));
      sea.position.set(78, -6.85, -20);
      root.add(sea);
      const boats: Group[] = [];
      for (let i = 0; i < 4; i++) {
        const boat = new Group();
        const hull = new Mesh(
          roundedBox(3, 0.7, 1.2, 0.3),
          toyMaterial(['#ff8a3c', '#ffffff', '#ff5fa2', '#4fc3ff'][i] as string),
        );
        const mast = new Mesh(new CylinderGeometry(0.08, 0.08, 3.2, 6), woodMaterial('#8a5a3c'));
        mast.position.y = 1.9;
        const sail = new Mesh(new ConeGeometry(1.2, 2.8, 3), toyMaterial('#fff6e8', { finish: 'satin' }));
        sail.scale.set(0.12, 1, 1);
        sail.position.set(0.4, 2, 0);
        boat.add(hull, mast, sail);
        boat.position.set(18 + i * 7, -6.4, -50 + i * 12);
        root.add(boat);
        boats.push(boat);
      }
      bob(life, boats, 0.25, 1.1);
      flock(life, { count: 7, center: [6, 0, -16], radius: 12, height: 8, color: '#ffffff', size: 0.6 });
      break;
    }
    case 4: {
      // a glowing rainbow arching over the far road
      const bands = ['#ff5f7e', '#ffa64d', '#ffe14d', '#5fe08a', '#4fc3ff', '#9b7cf0'];
      bands.forEach((c, i) => {
        const arc = new Mesh(
          new TorusGeometry(26 - i * 1.1, 0.5, 8, 48, Math.PI),
          new MeshBasicNodeMaterial({ color: c }),
        );
        arc.position.set(0, -7, -70);
        root.add(arc);
      });
      // a big round moon
      const moon = new Mesh(ball(5, 24), new MeshBasicNodeMaterial({ color: '#fff6c8' }));
      moon.position.set(-30, 22, -80);
      root.add(moon);
      fall(life, {
        count: 90,
        min: [-60, 6, -90],
        max: [60, 40, -40],
        kind: 'star',
        colors: ['#ffffff', '#fff6b0', '#bfe3ff'],
      });
      glow(life, {
        count: 30,
        center: [0, -1.5, -12],
        radius: 9,
        height: [0, 2.5],
        color: '#fff27a',
        size: 0.08,
      });
      break;
    }
  }
}
