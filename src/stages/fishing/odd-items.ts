/**
 * The fishing bonus things that drift by (tap = free coins, no maths — a resting moment): an old rubber boot,
 * a yellow rubber duck and a golden key, each built so a 6-year-old can name it, with a spinning coin above
 * that says "tap me for a coin". Paths are decorative and derived deterministically from the rules' data.
 */
import { CylinderGeometry, Group, Mesh, TorusGeometry } from 'three/webgpu';
import { ball, capsule, disc, roundedBox } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial } from '../../engine/tsl/materials';

function boot(): Group {
  const g = new Group();
  const rubber = toyMaterial('#7a5236', { finish: 'satin' });
  const shaft = new Mesh(roundedBox(0.42, 0.62, 0.4, 0.12), rubber);
  shaft.position.set(-0.12, 0.36, 0);
  const foot = new Mesh(roundedBox(0.72, 0.26, 0.42, 0.12), rubber);
  foot.position.set(0.06, 0.1, 0);
  const sole = new Mesh(roundedBox(0.78, 0.08, 0.46, 0.04), toyMaterial('#3e2a1e', { finish: 'matte' }));
  sole.position.set(0.06, -0.04, 0);
  const cuff = new Mesh(roundedBox(0.48, 0.1, 0.46, 0.05), toyMaterial('#c98b52', { finish: 'satin' }));
  cuff.position.set(-0.12, 0.7, 0);
  g.add(shaft, foot, sole, cuff);
  for (let i = 0; i < 3; i++) {
    const lace = new Mesh(capsule(0.025, 0.2), toyMaterial(PALETTE.white));
    lace.rotation.z = Math.PI / 2;
    lace.position.set(0.06 + i * 0.02, 0.42 - i * 0.12, 0.21);
    g.add(lace);
  }
  g.rotation.z = 0.25; // lying a little tipped over, like it fell in
  return g;
}

function duck(): Group {
  const g = new Group();
  const yellow = toyMaterial('#ffd23f');
  const body = new Mesh(ball(0.36, 28), yellow);
  body.scale.set(1.25, 0.8, 0.95);
  body.position.y = 0.2;
  const tail = new Mesh(ball(0.14, 14), yellow);
  tail.position.set(-0.44, 0.36, 0);
  const head = new Mesh(ball(0.22, 24), yellow);
  head.position.set(0.26, 0.58, 0);
  const beak = new Mesh(roundedBox(0.22, 0.08, 0.16, 0.04), toyMaterial('#ff8a3d'));
  beak.position.set(0.5, 0.54, 0);
  g.add(body, tail, head, beak);
  for (const z of [-0.12, 0.12]) {
    const eye = new Mesh(ball(0.04, 10), toyMaterial(PALETTE.ink));
    eye.position.set(0.4, 0.64, z);
    g.add(eye);
  }
  return g;
}

function key(): Group {
  const g = new Group();
  const gold = metalMaterial('#f2b632', 0.22);
  const bow = new Mesh(new TorusGeometry(0.2, 0.065, 12, 28), gold);
  bow.position.set(-0.36, 0.22, 0);
  const shaftM = new Mesh(new CylinderGeometry(0.05, 0.05, 0.62, 12), gold);
  shaftM.rotation.z = Math.PI / 2;
  shaftM.position.set(0.12, 0.22, 0);
  g.add(bow, shaftM);
  for (const [x, h] of [
    [0.32, 0.16],
    [0.2, 0.1],
  ] as const) {
    const tooth = new Mesh(roundedBox(0.07, h, 0.08, 0.02), gold);
    tooth.position.set(x, 0.22 - 0.05 - h / 2, 0);
    g.add(tooth);
  }
  g.rotation.x = -0.9; // floating almost flat on the water
  return g;
}

export interface OddItems {
  group: Group;
  /** Show item `kind` (0 boot, 1 duck, 2 key) and animate the "coin to collect" hint above it. */
  update(kind: number, t: number): void;
}

export function createOddItems(): OddItems {
  const group = new Group();
  const items = [boot(), duck(), key()];
  for (const it of items) {
    it.traverse((o) => {
      o.castShadow = true;
    });
    group.add(it);
  }
  // spinning coin above = "tap it for a coin" (the same gold as the coins that fall when it is caught)
  // bright, self-lit gold (a metal shader would mirror the dark pond and read brown at this size)
  const coin = new Mesh(disc(0.26, 0.06, 28), toyMaterial('#ffc83d', { rimStrength: 0.9 }));
  coin.rotation.x = Math.PI / 2;
  coin.position.y = 1.25;
  group.add(coin);
  return {
    group,
    update(kind, t) {
      items.forEach((it, i) => {
        it.visible = i === kind;
      });
      coin.rotation.z = t * 4;
      coin.position.y = 1.2 + Math.sin(t * 3) * 0.08;
    },
  };
}

/**
 * Where the bonus thing is at progress k (0 → 1): a gently curving chord across the pond whose angle and bend
 * come from the rules' own seeded values (id, lane), so every visit swims a different way — left, right,
 * towards the child or away — and replays look identical.
 */
export function oddPath(
  id: number,
  lane: number,
  k: number,
  radius = 3.9,
): { x: number; z: number; heading: number } {
  const h = (Math.sin(id * 12.9898 + lane * 78.233) * 43758.5453) % 1;
  const a = Math.abs(h) * Math.PI * 2; // entry angle
  const across = a + Math.PI + ((lane % 3) - 1) * 0.7; // exit roughly opposite
  const bend = ((lane % 2) * 2 - 1) * 1.1; // curve left or right
  const sx = Math.cos(a) * radius;
  const sz = Math.sin(a) * radius;
  const ex = Math.cos(across) * radius;
  const ez = Math.sin(across) * radius;
  // perpendicular offset for a soft arc
  const px = -(ez - sz);
  const pz = ex - sx;
  const len = Math.hypot(px, pz) || 1;
  const arc = Math.sin(k * Math.PI) * bend;
  const x = sx + (ex - sx) * k + (px / len) * arc;
  const z = sz + (ez - sz) * k + (pz / len) * arc;
  // heading from the derivative (for facing + wake)
  const dk = 0.01;
  const arc2 = Math.sin((k + dk) * Math.PI) * bend;
  const x2 = sx + (ex - sx) * (k + dk) + (px / len) * arc2;
  const z2 = sz + (ez - sz) * (k + dk) + (pz / len) * arc2;
  return { x, z, heading: Math.atan2(-(z2 - z), x2 - x) };
}
