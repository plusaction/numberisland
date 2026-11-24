/**
 * The five fishing spots (D62). The pond, fish, rod and bucket stay exactly where play needs them; each spot
 * changes the ground's shape and colour, the water, the sky, the dressing around the bank and who lives
 * there. Tall things stand behind the pond (the camera looks from the front, +Z).
 *  ① 해님 연못 — lily pads, hopping frogs, dragonflies and butterflies on a sunny day
 *  ② 굽이 강가 — a stream runs in and out under a little bridge, a turning water wheel, a duck family
 *  ③ 꽁꽁 얼음 낚시 — snowfield, an ice rim round the hole, an igloo, penguins sliding, falling snow
 *  ④ 노을 바닷가 부두 — sunset, a plank pier, a lighthouse whose lamp turns, gulls, crabs, sailboats
 *  ⑤ 반딧불 동굴 호수 — night cave: rock spires, glowing toadstools, fireflies, swooping bats
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  type Object3D,
} from 'three/webgpu';
import { createRng } from '../../domain/rng/rng';
import { ball, disc, roundedBox } from '../../engine/geo/shapes';
import { crab, duck, frog, glowShroom, penguin, tree } from '../../engine/life/critters';
import {
  bob,
  critters,
  drift,
  fall,
  flock,
  flutter,
  glow,
  type Life,
  spin,
  sway,
} from '../../engine/life/life';
import { PALETTE } from '../../engine/palette';
import { toyMaterial, waterMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { Mood } from '../../engine/world';
import type { GroundShape } from '../_shared/diorama';

export interface FishingLook {
  shape: GroundShape;
  ground: string;
  bank: string;
  rock: readonly string[];
  water: [deep: string, shallow: string];
}

export const FISHING_LOOKS: readonly FishingLook[] = [
  {
    shape: 'flower',
    ground: PALETTE.leaf,
    bank: PALETTE.sand,
    rock: ['#d8cfc4', PALETTE.mint],
    water: ['#11789e', '#3cc0d6'],
  },
  {
    shape: 'blob',
    ground: '#8fd17a',
    bank: '#e9d3a6',
    rock: ['#cfc6b8', '#b9d98c'],
    water: ['#0f6f8c', '#46c7c9'],
  },
  {
    shape: 'hex',
    ground: '#f3f7fb',
    bank: '#e6eef6',
    rock: ['#ffffff', '#dfe9f3'],
    water: ['#123a6b', '#3f7fb8'],
  },
  {
    shape: 'square',
    ground: '#f2d39a',
    bank: '#f7e3b5',
    rock: ['#d9b98c', '#c9a77a'],
    water: ['#0f78b8', '#4fd0f0'],
  },
  {
    shape: 'round',
    ground: '#5b5878',
    bank: '#6e6a8c',
    rock: ['#7a7598', '#59557a'],
    water: ['#0b3a4f', '#1e8a8f'],
  },
];

export const FISHING_MOODS: readonly Mood[] = [
  { sky: { top: '#8fd3ff', bottom: '#fff1d6' } },
  { sky: { top: '#7fd0ff', bottom: '#e8fbff' }, sunI: 3.4 },
  { sky: { top: '#b9d7f2', bottom: '#f4f8ff' }, sun: '#eaf4ff', sunI: 2.6, hemi: 0.6 },
  { sky: { top: '#ff9f8a', bottom: '#ffe2a8' }, sun: '#ffc48a', sunI: 2.8 },
  {
    sky: { top: '#1d1b3f', bottom: '#4b4580' },
    sun: '#9fb4ff',
    sunI: 1.1,
    hemi: 0.28,
    fogNear: 30,
    fogFar: 80,
  },
];

export function fishingWater(map: number) {
  const [deep, shallow] = FISHING_LOOKS[map]?.water ?? ['#11789e', '#3cc0d6'];
  return waterMaterial(deep, shallow);
}

const shadows = (o: Object3D) =>
  o.traverse((c) => {
    c.castShadow = true;
  });

/** Dressing and life for one fishing spot. `root` = the stage root; everything here is decoration. */
export function dressFishing(map: number, root: Group, life: Life) {
  const rng = createRng(`fishing-map-${map}`);
  const add = (o: Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    shadows(o);
    root.add(o);
    return o;
  };
  switch (map) {
    case 0: {
      // lily pads floating at the pond's edge, a few with pink flowers
      const pads: Object3D[] = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const pad = new Group();
        const leaf = new Mesh(disc(0.38, 0.03, 20), toyMaterial('#4fbf5c', { finish: 'satin' }));
        pad.add(leaf);
        if (i % 2 === 0) {
          const flower = new Mesh(ball(0.12, 10), toyMaterial('#ff8fc0'));
          flower.scale.set(1, 0.7, 1);
          flower.position.y = 0.08;
          pad.add(flower);
        }
        pad.position.set(Math.cos(a) * 4.25, 0.2, Math.sin(a) * 4.0);
        root.add(pad);
        pads.push(pad);
      }
      bob(life, pads, 0.025, 1.1);
      // reeds and flowers behind the pond
      const reeds: Object3D[] = [];
      for (let i = 0; i < 9; i++) {
        const r = new Mesh(
          new CylinderGeometry(0.03, 0.05, 1.1 + rng.float() * 0.5, 6),
          toyMaterial('#6fbf4f'),
        );
        const tip = new Mesh(ball(0.07, 8), toyMaterial('#8a5a3c'));
        tip.scale.set(1, 2, 1);
        tip.position.y = 0.6;
        r.add(tip);
        reeds.push(add(r, -3 + i * 0.75, 0.55, -5.6 - rng.float() * 0.5));
      }
      sway(life, reeds, 0.08, 1.2);
      add(tree('round', '#7fd36b', 1.2), 5.6, 0, -3.4);
      add(tree('round', '#9be07d', 1.0), -5.9, 0, -2.6);
      critters(life, {
        make: () => frog(1),
        count: 3,
        path: { kind: 'loop', center: [0, 0.1, 0], rx: 5.6, rz: 5.4 },
        speed: 0.025,
        gait: 'hop',
        spacing: 0.3,
      });
      flutter(life, {
        count: 4,
        center: [0, 1.2, -1],
        radius: 4.5,
        height: [0.4, 2],
        colors: ['#4fc3ff', '#3ddc97'],
        darting: true,
        seed: 'dragonfly',
      });
      flutter(life, {
        count: 4,
        center: [0, 1.6, 0],
        radius: 5.5,
        height: [0.6, 2.2],
        colors: ['#ffd23f', '#ff8fc0', '#ffffff'],
      });
      break;
    }
    case 1: {
      // the stream: water flowing in from the back-left and out to the back-right, under a bridge
      const streamMat = fishingWater(1);
      for (const [x, z, ry] of [
        [-4.6, -4.6, 0.75],
        [4.7, -4.4, -0.8],
      ] as const) {
        const s = new Mesh(roundedBox(1.7, 0.05, 4.2, 0.02), streamMat);
        s.position.set(x, 0.14, z);
        s.rotation.y = ry;
        root.add(s);
        const bed = new Mesh(roundedBox(2.1, 0.1, 4.2, 0.04), toyMaterial('#d9c49a', { finish: 'matte' }));
        bed.position.set(x, 0.06, z);
        bed.rotation.y = ry;
        root.add(bed);
      }
      // a little arched bridge over the outflow
      const bridge = new Group();
      for (let i = 0; i < 7; i++) {
        const plank = new Mesh(roundedBox(0.32, 0.1, 1.5, 0.03), woodMaterial(i % 2 ? '#c98a5c' : '#b97a4c'));
        plank.position.set(-0.96 + i * 0.32, 0.55 + Math.sin((i / 6) * Math.PI) * 0.35, 0);
        bridge.add(plank);
      }
      for (const z of [-0.72, 0.72]) {
        const rail = new Mesh(roundedBox(2.2, 0.08, 0.08, 0.03), woodMaterial('#8a5a3c'));
        rail.position.set(0, 1.05, z);
        bridge.add(rail);
      }
      add(bridge, 4.7, 0, -4.4, -0.8 + Math.PI / 2);
      // water wheel on the left stream, turning
      const wheel = new Group();
      const hub = new Mesh(new CylinderGeometry(0.15, 0.15, 0.5, 12), woodMaterial('#8a5a3c'));
      hub.rotation.x = Math.PI / 2;
      wheel.add(hub);
      for (let i = 0; i < 8; i++) {
        const blade = new Mesh(roundedBox(0.12, 1.4, 0.45, 0.03), woodMaterial('#c98a5c'));
        blade.rotation.z = (i / 8) * Math.PI * 2;
        wheel.add(blade);
      }
      const wheelHolder = new Group();
      wheelHolder.add(wheel);
      add(wheelHolder, -5.4, 0.9, -3.9, 0.75);
      spin(life, wheel, 1.1, 'z');
      add(tree('round', '#6cc85a', 1.3), -1.5, 0, -6.2);
      add(tree('round', '#86d66b', 1.0), 1.8, 0, -6.4);
      // a duck family paddling round the outer pond (outside the fish rings)
      critters(life, {
        make: (i) => duck(i === 0 ? 1.1 : 0.55, i === 0 ? '#f6f1e0' : '#ffd84a'),
        count: 4,
        path: { kind: 'loop', center: [0, 0.16, 0], rx: 4.2, rz: 4.0 },
        speed: 0.018,
        gait: 'swim',
        spacing: 0.025,
      });
      flock(life, { count: 4, center: [0, 0, -2], radius: 6, height: 5.5, color: '#3b3355', size: 0.3 });
      flutter(life, {
        count: 3,
        center: [0, 1.4, 0],
        radius: 5.5,
        height: [0.6, 2],
        colors: ['#ffd23f', '#ff8fc0'],
      });
      break;
    }
    case 2: {
      // an ice rim round the fishing hole: thick frosted slabs ringing the open water
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const slab = new Mesh(
          roundedBox(1.2, 0.16, 0.7, 0.06),
          toyMaterial('#eef8ff', { roughness: 0.12, rimStrength: 0.3 }),
        );
        slab.position.set(Math.cos(a) * 4.75, 0.17, Math.sin(a) * 4.75);
        slab.rotation.y = -a + Math.PI / 2;
        root.add(slab);
      }
      // igloo behind the hole
      const igloo = new Group();
      const dome = new Mesh(ball(1.1, 20), toyMaterial('#ffffff', { finish: 'satin' }));
      dome.scale.set(1, 0.75, 1);
      const door = new Mesh(
        new CylinderGeometry(0.42, 0.42, 0.7, 14, 1, false, 0, Math.PI),
        toyMaterial('#cfe2f2'),
      );
      door.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      door.position.set(0, 0.25, 1.0);
      igloo.add(dome, door);
      for (let r = 0; r < 3; r++) {
        const ring = new Mesh(disc(1.08 - r * 0.22, 0.03, 32), toyMaterial('#dcebf7', { finish: 'matte' }));
        ring.position.y = 0.2 + r * 0.25;
        igloo.add(ring);
      }
      add(igloo, 3.6, 0, -5.7, -0.4);
      add(tree('pine', '#4f9c6a', 1.3, true), -4.4, 0, -5.6);
      add(tree('pine', '#5aa874', 1.0, true), -2.6, 0, -6.4);
      add(tree('pine', '#4f9c6a', 0.9, true), 6.0, 0, -2.0);
      // penguins sliding on their bellies along the back and waddling home
      critters(life, {
        make: () => penguin(1),
        count: 2,
        path: { kind: 'line', from: [-5.8, 0.1, -4.5], to: [5.6, 0.1, -4.8] },
        speed: 0.04,
        gait: 'slide',
        spacing: 0.45,
      });
      critters(life, {
        make: () => penguin(0.8),
        count: 2,
        path: { kind: 'loop', center: [3.6, 0.05, -4.2], rx: 1.8, rz: 0.9 },
        speed: 0.05,
        gait: 'waddle',
        spacing: 0.5,
      });
      fall(life, { count: 90, min: [-8, 0, -8], max: [8, 9, 7], kind: 'snow', colors: ['#ffffff'] });
      break;
    }
    case 3: {
      // a plank pier reaching from the right bank into the water
      const pier = new Group();
      for (let i = 0; i < 9; i++) {
        const plank = new Mesh(roundedBox(1.4, 0.1, 0.34, 0.03), woodMaterial(i % 2 ? '#c98a5c' : '#b97a4c'));
        plank.position.set(0, 0.42, i * 0.38);
        pier.add(plank);
      }
      for (const [x, z] of [
        [-0.65, 0],
        [0.65, 0],
        [-0.65, 3],
        [0.65, 3],
      ] as const) {
        const post = new Mesh(new CylinderGeometry(0.09, 0.09, 1.1, 10), woodMaterial('#8a5a3c'));
        post.position.set(x, 0.3, z);
        pier.add(post);
      }
      add(pier, 5.6, 0, -2.4, -1.25);
      // lighthouse with a turning lamp
      const lh = new Group();
      for (let i = 0; i < 4; i++) {
        const band = new Mesh(
          new CylinderGeometry(0.52 - i * 0.06, 0.58 - i * 0.06, 0.8, 18),
          toyMaterial(i % 2 ? '#ffffff' : '#ff5f5f'),
        );
        band.position.y = 0.4 + i * 0.8;
        lh.add(band);
      }
      const lampRoom = new Mesh(
        new CylinderGeometry(0.36, 0.36, 0.5, 14),
        new MeshBasicNodeMaterial({ color: '#fff4b8' }),
      );
      lampRoom.position.y = 3.45;
      const roof = new Mesh(new ConeGeometry(0.48, 0.5, 14), toyMaterial('#ff5f5f'));
      roof.position.y = 3.95;
      const beam = new Group();
      const ray = new Mesh(
        roundedBox(2.6, 0.12, 0.2, 0.05),
        new MeshBasicNodeMaterial({ color: '#fff7c7', transparent: true, opacity: 0.55, depthWrite: false }),
      );
      ray.position.x = 1.3;
      beam.add(ray);
      beam.position.y = 3.45;
      lh.add(lampRoom, roof, beam);
      add(lh, -5.2, 0, -4.6);
      spin(life, beam, 1.2, 'y');
      // sailboats drifting on the sea behind
      const boats: Object3D[] = [];
      for (let i = 0; i < 3; i++) {
        const boat = new Group();
        const hull = new Mesh(
          roundedBox(1.0, 0.25, 0.45, 0.1),
          toyMaterial(['#ff8a3c', '#4fc3ff', '#ffffff'][i] as string),
        );
        const mast = new Mesh(new CylinderGeometry(0.03, 0.03, 1.0, 6), woodMaterial('#8a5a3c'));
        mast.position.y = 0.6;
        const sail = new Mesh(new ConeGeometry(0.4, 0.9, 3), toyMaterial('#fff6e8', { finish: 'satin' }));
        sail.scale.set(0.15, 1, 1);
        sail.position.set(0.15, 0.65, 0);
        boat.add(hull, mast, sail);
        boat.position.set(-12 + i * 9, -0.2, -13 - i * 1.5);
        root.add(boat);
        boats.push(boat);
      }
      const sea = new Mesh(disc(30, 0.1, 64), fishingWater(3));
      sea.position.y = -1.12;
      root.add(sea);
      drift(life, boats, 30, 0.6);
      bob(life, boats, 0.08, 1.4);
      critters(life, {
        make: () => crab(0.9),
        count: 3,
        path: { kind: 'line', from: [-5.9, 0.05, 1.2], to: [-3.2, 0.05, 5.6] },
        speed: 0.05,
        gait: 'scuttle',
        spacing: 0.33,
      });
      flock(life, { count: 6, center: [0, 0, -3], radius: 7, height: 6, color: '#ffffff', size: 0.42 });
      break;
    }
    case 4: {
      // rock spires round the cave lake, glowing toadstools at their feet
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI; // behind the lake
        const h = 1.6 + rng.float() * 2.4;
        const spire = new Mesh(
          new ConeGeometry(0.45 + rng.float() * 0.3, h, 7),
          toyMaterial(i % 2 ? '#6e6a8c' : '#5d5980', { finish: 'matte' }),
        );
        spire.position.set(Math.cos(a) * 6.1, h / 2, Math.sin(a) * 5.9);
        spire.castShadow = true;
        root.add(spire);
      }
      // stalactites hanging from an unseen roof: points above the back
      for (let i = 0; i < 6; i++) {
        const st = new Mesh(new ConeGeometry(0.22, 1.2, 6), toyMaterial('#7a7598', { finish: 'matte' }));
        st.rotation.x = Math.PI;
        st.position.set(-4 + i * 1.6, 5.4 + rng.float() * 0.6, -6.5);
        root.add(st);
      }
      const shroomColors = ['#7fe8ff', '#c49bff', '#8dffb0'];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.2;
        if (Math.cos(a) < -0.6 && Math.sin(a) > 0.3) continue; // keep the rod/bucket corner clear
        add(
          glowShroom(1.1 + rng.float() * 0.7, shroomColors[i % 3]),
          Math.cos(a) * 5.55,
          0,
          Math.sin(a) * 5.4,
          rng.float() * 3,
        );
      }
      glow(life, {
        count: 26,
        center: [0, 0.4, 0],
        radius: 5.5,
        height: [0.5, 3],
        color: '#fff27a',
        size: 0.05,
      });
      flock(life, {
        count: 4,
        center: [0, 0, -2],
        radius: 5,
        height: 4.2,
        color: '#3a3157',
        size: 0.32,
        style: 'swoop',
      });
      break;
    }
  }
}
