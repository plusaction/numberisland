/**
 * The bomb squad's five places (D62). The bench, bomb, wires and toy shelves stay where play needs them;
 * each place changes the ground, the bench, the sky and everything around it.
 *  ① 장난감 공작소 — a pegboard of toy tools, a wind-up mouse zipping about, dust motes
 *  ② 해적선 갑판 — the sea all round, a mast whose sail and flag flap, a parrot, gulls overhead
 *  ③ 우주 정거장 — space outside, a ringed planet turning, tools floating, twinkling stars
 *  ④ 눈 오두막 — a fireplace with a flickering fire, a cat asleep on the rug, snow falling outside
 *  ⑤ 화산 실험실 — a volcano with a glowing top, bubbling flasks, lava bubbles rising
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
import { cat } from '../../engine/life/critters';
import { bob, critters, fall, flock, type Life, spin, sway } from '../../engine/life/life';
import { PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial, waterMaterial, woodMaterial } from '../../engine/tsl/materials';
import type { Mood } from '../../engine/world';
import type { GroundShape } from '../_shared/diorama';

export interface BombLook {
  shape: GroundShape;
  ground: string;
  bench: string;
}

export const BOMB_LOOKS: readonly BombLook[] = [
  { shape: 'round', ground: PALETTE.lavender, bench: '#e8c9a0' },
  { shape: 'square', ground: '#a8744a', bench: '#c98a5c' },
  { shape: 'hex', ground: '#8f9bb8', bench: '#cfd6e4' },
  { shape: 'square', ground: '#d9a27a', bench: '#e8c9a0' },
  { shape: 'blob', ground: '#5b4a5e', bench: '#8d7a8f' },
];

export const BOMB_MOODS: readonly Mood[] = [
  { sky: { top: '#9fd8ff', bottom: '#fff1d6' } },
  { sky: { top: '#6fc8ff', bottom: '#e6fbff' }, sunI: 3.4 },
  {
    sky: { top: '#0b0b2a', bottom: '#2c2a66' },
    sun: '#cfe0ff',
    sunI: 2.4,
    hemi: 0.35,
    fogNear: 40,
    fogFar: 120,
  },
  { sky: { top: '#b8cde6', bottom: '#fff1e0' }, sun: '#ffe2bd', sunI: 2.6 },
  { sky: { top: '#5a2b3a', bottom: '#ff9b6a' }, sun: '#ffb27a', sunI: 2.8, hemi: 0.4 },
];

const shadows = (o: Object3D) =>
  o.traverse((c) => {
    c.castShadow = true;
  });

/** A small wind-up toy mouse (grey body, pink ears, a key on its back that turns). */
function windupMouse(): Group {
  const g = new Group();
  const body = new Mesh(ball(0.22, 12), toyMaterial('#b9b4c9'));
  body.scale.set(0.8, 0.7, 1.2);
  body.position.y = 0.16;
  g.add(body);
  for (const sx of [-1, 1]) {
    const ear = new Mesh(disc(0.09, 0.03, 12), toyMaterial('#ff9fc5'));
    ear.rotation.x = Math.PI / 2;
    ear.position.set(sx * 0.1, 0.32, 0.12);
    g.add(ear);
  }
  const key = new Mesh(new TorusGeometry(0.07, 0.02, 6, 12), metalMaterial('#f2b632'));
  key.position.set(0, 0.36, -0.05);
  g.add(key);
  return g;
}

/** A parrot perched on a rail (green, red head, yellow beak). */
function parrot(): Group {
  const g = new Group();
  const body = new Mesh(ball(0.2, 12), toyMaterial('#3ddc97'));
  body.scale.set(0.8, 1.2, 0.8);
  body.position.y = 0.22;
  const head = new Mesh(ball(0.14, 12), toyMaterial('#ff5f5f'));
  head.position.set(0, 0.5, 0.04);
  const beak = new Mesh(new ConeGeometry(0.05, 0.12, 8), toyMaterial('#ffd23f'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.48, 0.18);
  const tail = new Mesh(capsule(0.05, 0.3), toyMaterial('#4fc3ff'));
  tail.rotation.x = 0.5;
  tail.position.set(0, 0.0, -0.12);
  g.add(body, head, beak, tail);
  return g;
}

export function dressBomb(map: number, root: Group, life: Life) {
  const add = (o: Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    shadows(o);
    root.add(o);
    return o;
  };
  switch (map) {
    case 0: {
      // pegboard of toy tools behind the bench
      const board = new Group();
      const panel = new Mesh(roundedBox(9, 3.2, 0.2, 0.1), woodMaterial('#e3c79c'));
      board.add(panel);
      const tools: [string, number, number][] = [
        ['#ff6f91', -3.2, 0.5],
        ['#4fc3ff', -1.6, -0.3],
        ['#ffd23f', 1.6, 0.4],
        ['#7ee08a', 3.1, -0.2],
      ];
      for (const [c, x, y] of tools) {
        const handle = new Mesh(capsule(0.13, 0.7), toyMaterial(c));
        handle.position.set(x, y, 0.2);
        handle.rotation.z = 0.3;
        const head = new Mesh(roundedBox(0.6, 0.25, 0.2, 0.06), metalMaterial('#cfd6e4'));
        head.position.set(x + 0.2, y + 0.55, 0.2);
        head.rotation.z = 0.3;
        board.add(handle, head);
      }
      add(board, 0, 2.4, -4.3);
      critters(life, {
        make: () => windupMouse(),
        count: 1,
        path: { kind: 'loop', center: [0, 0.6, 1.9], rx: 4.6, rz: 1.2 },
        speed: 0.07,
        gait: 'waddle',
      });
      fall(life, {
        count: 30,
        min: [-6, 0.5, -4],
        max: [6, 5, 4],
        kind: 'star',
        colors: ['#fff6d8'],
        speed: 0,
      });
      break;
    }
    case 1: {
      // the sea round the ship, a mast with a flapping sail and flag, rope rails
      const sea = new Mesh(disc(30, 0.1, 64), waterMaterial('#0f6fae', '#47c6e8', 30));
      sea.position.y = -1.12;
      root.add(sea);
      const mast = new Group();
      const pole = new Mesh(new CylinderGeometry(0.16, 0.2, 7, 12), woodMaterial('#8a5a3c'));
      pole.position.y = 3.5;
      const sail = new Mesh(roundedBox(3.4, 2.8, 0.06, 0.04), toyMaterial('#fff6e8', { finish: 'satin' }));
      sail.position.set(0, 4.4, 0.25);
      const stripe = new Mesh(roundedBox(3.42, 0.4, 0.08, 0.02), toyMaterial('#ff5f5f'));
      stripe.position.set(0, 4.4, 0.27);
      const flag = new Mesh(roundedBox(1.0, 0.6, 0.04, 0.02), toyMaterial('#2c3350'));
      flag.position.set(0.55, 6.8, 0);
      mast.add(pole, sail, stripe, flag);
      add(mast, -4.8, 0, -3.8, 0.3);
      sway(life, [sail, stripe], 0.04, 1.8);
      sway(life, [flag], 0.25, 3.2);
      const rail = new Mesh(roundedBox(12, 0.14, 0.14, 0.05), woodMaterial('#6b4a34'));
      rail.position.set(0, 1.2, -4.6);
      root.add(rail);
      const bird = parrot();
      add(bird, 4.4, 1.28, -4.6, -0.4);
      bob(life, [bird], 0.05, 3);
      flock(life, { count: 5, center: [0, 0, -2], radius: 8, height: 7, color: '#ffffff', size: 0.5 });
      bob(life, [sea], 0.06, 0.8);
      break;
    }
    case 2: {
      // a big round window to space with a ringed planet slowly turning
      const win = new Group();
      const rim = new Mesh(new TorusGeometry(2.6, 0.3, 12, 40), metalMaterial('#cfd6e4'));
      const glass = new Mesh(disc(2.5, 0.05, 40), new MeshBasicNodeMaterial({ color: '#141238' }));
      glass.rotation.x = Math.PI / 2;
      const planet = new Group();
      const globe = new Mesh(ball(1.0, 24), toyMaterial('#ff9f6a', { finish: 'satin' }));
      const ring = new Mesh(
        new TorusGeometry(1.5, 0.08, 6, 40),
        toyMaterial('#ffe08a', { rimStrength: 0.6 }),
      );
      ring.rotation.x = 1.2;
      planet.add(globe, ring);
      planet.position.set(0.6, 0.3, 0.35);
      win.add(rim, glass, planet);
      add(win, 0, 3.6, -4.6);
      spin(life, planet, 0.3, 'y');
      // floating tools: they bob and turn slowly in zero gravity
      const floaters: Object3D[] = [];
      for (const [c, x, y, z] of [
        ['#ffd23f', -4.6, 2.6, -2.2],
        ['#4fc3ff', 4.8, 3.2, -1.6],
        ['#ff6f91', -3.8, 4.0, 1.2],
      ] as const) {
        const tool = new Mesh(capsule(0.12, 0.7), toyMaterial(c));
        tool.rotation.z = 1;
        add(tool, x, y, z);
        floaters.push(tool);
        spin(life, tool, 0.6, 'x');
      }
      bob(life, floaters, 0.25, 0.8);
      fall(life, {
        count: 70,
        min: [-14, 6, -16],
        max: [14, 16, -8],
        kind: 'star',
        colors: ['#ffffff', '#bfe3ff'],
      });
      break;
    }
    case 3: {
      // a cabin back wall with a window (snow outside) and a fireplace with a flickering fire
      const wall = new Mesh(roundedBox(11, 5, 0.3, 0.1), woodMaterial('#b98a5c'));
      add(wall, 0, 2.5, -4.6);
      const frame = new Mesh(roundedBox(2.4, 1.8, 0.2, 0.08), woodMaterial('#f4f1ec'));
      add(frame, 3.2, 3.2, -4.4);
      const pane = new Mesh(roundedBox(2.1, 1.5, 0.1, 0.04), new MeshBasicNodeMaterial({ color: '#cfe6ff' }));
      add(pane, 3.2, 3.2, -4.32);
      const hearth = new Mesh(roundedBox(2.6, 2.2, 0.8, 0.12), toyMaterial('#c96b4f', { finish: 'matte' }));
      add(hearth, -3.2, 1.4, -4.2);
      const mouth = new Mesh(
        roundedBox(1.6, 1.1, 0.2, 0.08),
        new MeshBasicNodeMaterial({ color: '#2a1a1a' }),
      );
      add(mouth, -3.2, 1.0, -3.78);
      const flames: Object3D[] = [];
      for (const [c, x, s] of [
        ['#ff8a3c', -3.45, 0.9],
        ['#ffd23f', -3.15, 0.7],
        ['#ff5f3c', -2.9, 0.8],
      ] as const) {
        const f = new Mesh(new ConeGeometry(0.22, 0.7, 8), new MeshBasicNodeMaterial({ color: c }));
        f.scale.setScalar(s);
        add(f, x, 0.85, -3.7);
        flames.push(f);
      }
      bob(life, flames, 0.06, 6);
      sway(life, flames, 0.15, 5);
      const rug = new Mesh(disc(1.2, 0.04, 32), toyMaterial('#ff6f91', { finish: 'matte' }));
      rug.scale.set(1.4, 1, 0.8);
      add(rug, 4.3, 0.6, 2.6);
      critters(life, {
        make: () => cat(1.2),
        count: 1,
        path: { kind: 'line', from: [4.3, 0.62, 2.6], to: [4.3, 0.62, 2.6] },
        speed: 0,
        gait: 'idle',
      });
      fall(life, {
        count: 40,
        min: [2, 2.3, -4.35],
        max: [4.4, 4.0, -4.3],
        kind: 'snow',
        colors: ['#ffffff'],
        speed: 0.3,
      });
      break;
    }
    case 4: {
      // a volcano behind the lab with a glowing crater, flasks bubbling on the edges
      const volcano = new Mesh(new ConeGeometry(3.6, 4.4, 10), toyMaterial('#6b4a5e', { finish: 'matte' }));
      add(volcano, -4.6, 1.6, -6.4);
      const lava = new Mesh(disc(1.2, 0.2, 20), new MeshBasicNodeMaterial({ color: '#ff7a2c' }));
      add(lava, -4.6, 3.6, -6.4);
      fall(life, {
        count: 30,
        min: [-2.2, 4.5, -8],
        max: [0.2, 9, -6],
        kind: 'bubble',
        colors: ['#ff9b4a', '#ffd23f'],
        speed: 1.2,
      });
      for (const [c, x, z] of [
        ['#7fe8ff', -5.2, 1.6],
        ['#c49bff', 5.2, 1.2],
        ['#8dffb0', 4.8, -2.6],
      ] as const) {
        const flask = new Group();
        const bulb = new Mesh(ball(0.45, 16), toyMaterial(c, { roughness: 0.05, rimStrength: 0.5 }));
        bulb.position.y = 0.45;
        const neck = new Mesh(
          new CylinderGeometry(0.12, 0.12, 0.6, 10),
          toyMaterial('#eef6ff', { roughness: 0.05 }),
        );
        neck.position.y = 1.1;
        flask.add(bulb, neck);
        add(flask, x, 0, z);
        fall(life, {
          count: 8,
          min: [x - 0.1, 1.3, z - 0.1],
          max: [x + 0.1, 3, z + 0.1],
          kind: 'bubble',
          colors: [c],
          speed: 0.6,
        });
      }
      fall(life, {
        count: 25,
        min: [-6, 0.5, -5],
        max: [6, 6, 4],
        kind: 'star',
        colors: ['#ffb27a'],
        speed: 0,
      });
      break;
    }
  }
}
