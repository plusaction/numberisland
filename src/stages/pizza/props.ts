/**
 * Pizza shop props (all procedural toys, P3): a whole pizza, slices and boxes for showing numbers (a box =
 * ten slices, a loose slice = one — place value you can see), the brick oven, the partner chef 피자랑 and the
 * five customer monsters (names from the SPEC list). Shapes come from the shared geometry cache.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  type Material,
  Mesh,
  Object3D,
  OctahedronGeometry,
  SphereGeometry,
} from 'three/webgpu';
import { ball, capsule, disc, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { jellyMaterial, metalMaterial, toyMaterial } from '../../engine/tsl/materials';

export const COLORS = {
  crust: '#e9a95b',
  cheese: '#ffd36b',
  sauce: '#e2492f',
  pepperoni: '#b8322a',
  mushroom: '#f1e6d2',
  box: '#e9bd84',
  stripe: '#e2492f',
  brick: '#c8553d',
};

/** A whole pizza (crust, sauce, cheese, pepperoni, mushrooms), lying flat, radius ≈ 0.7. */
export function pizzaModel(scale = 1): Group {
  const g = new Group();
  const crust = new Mesh(disc(0.72, 0.12, 40), toyMaterial(COLORS.crust, { finish: 'satin' }));
  const sauce = new Mesh(disc(0.64, 0.03, 40), toyMaterial(COLORS.sauce, { finish: 'satin' }));
  sauce.position.y = 0.07;
  const cheese = new Mesh(disc(0.58, 0.03, 40), toyMaterial(COLORS.cheese, { finish: 'satin' }));
  cheese.position.y = 0.09;
  crust.castShadow = true;
  g.add(crust, sauce, cheese);
  const pep = toyMaterial(COLORS.pepperoni);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const r = i === 0 ? 0 : 0.36;
    const p = new Mesh(disc(0.1, 0.03, 16), pep);
    p.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r);
    g.add(p);
  }
  const mush = toyMaterial(COLORS.mushroom, { finish: 'satin' });
  for (let i = 0; i < 4; i++) {
    const a = 0.8 + i * 1.57;
    const m = new Mesh(ball(0.07, 10), mush);
    m.scale.set(1.2, 0.5, 1);
    m.position.set(Math.cos(a) * 0.22, 0.12, Math.sin(a) * 0.22);
    g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}

/** A closed pizza box (one box = ten slices), with a red stripe and a tiny pizza badge. */
export function boxModel(): Group {
  const g = new Group();
  const body = new Mesh(roundedBox(1.0, 0.16, 1.0, 0.03), toyMaterial(COLORS.box, { finish: 'matte' }));
  body.castShadow = true;
  const stripe = new Mesh(
    roundedBox(1.02, 0.05, 0.16, 0.02),
    toyMaterial(COLORS.stripe, { finish: 'satin' }),
  );
  stripe.position.y = 0.03;
  g.add(body, stripe);
  return g;
}

/**
 * A pile that shows a number: `tens` boxes stacked + `ones` slices fanned in front, plus its numeral.
 * Instanced so up to 9 + 9 pieces cost two draw calls.
 */
export class NumberPile {
  readonly group = new Group();
  readonly label: NumberLabel;
  private boxes: InstancedMesh;
  private stripes: InstancedMesh;
  private slices: InstancedMesh;
  private dummy = new Object3D();
  value = -1;
  constructor(labelY = 1.9) {
    const boxGeo = roundedBox(0.7, 0.14, 0.7, 0.03);
    this.boxes = new InstancedMesh(boxGeo, toyMaterial(COLORS.box, { finish: 'matte' }), 9);
    this.stripes = new InstancedMesh(
      roundedBox(0.72, 0.045, 0.12, 0.02),
      toyMaterial(COLORS.stripe, { finish: 'satin' }),
      9,
    );
    // a slice: a 1/8 wedge of a short cylinder (cheese top + crust edge read as one colour toy)
    const wedge = new CylinderGeometry(0.5, 0.5, 0.1, 6, 1, false, -Math.PI / 9, (Math.PI * 2) / 9);
    this.slices = new InstancedMesh(wedge, toyMaterial(COLORS.cheese, { finish: 'satin' }), 9);
    for (const m of [this.boxes, this.stripes, this.slices]) {
      m.castShadow = true;
      m.count = 0;
      this.group.add(m);
    }
    this.label = new NumberLabel(0, { size: 0.5, placeColors: true });
    this.label.position.y = labelY;
    this.group.add(this.label);
  }
  set(n: number) {
    if (n === this.value) return;
    this.value = n;
    const tens = Math.min(9, Math.floor(n / 10));
    const ones = Math.min(9, n % 10);
    const d = this.dummy;
    for (let i = 0; i < tens; i++) {
      d.position.set(-0.8, 0.1 + i * 0.15, 0);
      d.rotation.set(0, (i % 2) * 0.12 - 0.06, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.boxes.setMatrixAt(i, d.matrix);
      d.position.y += 0.025;
      d.updateMatrix();
      this.stripes.setMatrixAt(i, d.matrix);
    }
    for (let i = 0; i < ones; i++) {
      // slices stand up facing the camera (crust on top) in rows of five, like a ten-frame
      const row = i < 5 ? 0 : 1;
      const k = row === 0 ? i : i - 5;
      d.position.set(-0.25 + k * 0.36, 0.06 + row * 0.12, 0.25 - row * 0.45);
      d.rotation.set(-Math.PI / 2 + 0.35, 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.slices.setMatrixAt(i, d.matrix);
    }
    this.boxes.count = this.stripes.count = tens;
    this.slices.count = ones;
    this.boxes.instanceMatrix.needsUpdate = true;
    this.stripes.instanceMatrix.needsUpdate = true;
    this.slices.instanceMatrix.needsUpdate = true;
    this.label.set(n);
  }
}

/** Brick dome oven with a glowing mouth and a chimney; `fire` is the mouth glow to flicker. */
export function ovenModel(): { group: Group; fire: Mesh; mouth: Mesh } {
  const g = new Group();
  const base = new Mesh(roundedBox(2.6, 0.9, 2.0, 0.12), toyMaterial('#b9a48e', { finish: 'matte' }));
  base.position.y = 0.45;
  base.castShadow = base.receiveShadow = true;
  const dome = new Mesh(
    new SphereGeometry(1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    toyMaterial(COLORS.brick, { finish: 'satin' }),
  );
  dome.position.y = 0.9;
  dome.scale.set(1, 0.85, 0.8);
  dome.castShadow = true;
  const mouth = new Mesh(roundedBox(1.1, 0.62, 0.3, 0.2), toyMaterial('#3a1d14', { finish: 'matte' }));
  mouth.position.set(0, 1.18, 0.78);
  const fire = new Mesh(roundedBox(0.9, 0.42, 0.06, 0.15), toyMaterial('#ff9a3c', { rimStrength: 1 }));
  fire.position.set(0, 1.14, 0.94);
  const arch = new Mesh(roundedBox(1.3, 0.16, 0.34, 0.06), toyMaterial('#f2d6a8', { finish: 'satin' }));
  arch.position.set(0, 1.55, 0.8);
  const chimney = new Mesh(
    new CylinderGeometry(0.16, 0.2, 0.9, 16),
    toyMaterial('#8f3b2c', { finish: 'satin' }),
  );
  chimney.position.set(0.45, 2.2, -0.2);
  g.add(base, dome, mouth, fire, arch, chimney);
  return { group: g, fire, mouth };
}

export interface Monster {
  group: Group;
  body: Mesh;
  /** Arm that waves / high-fives (partner only has one that matters). */
  arm: Group;
}

function face(group: Group, y: number, z: number, spread = 0.26) {
  const white = toyMaterial(PALETTE.white);
  const ink = toyMaterial(PALETTE.ink);
  const cheek = toyMaterial('#ff9fb8', { finish: 'matte' });
  for (const x of [-spread, spread]) {
    const w = new Mesh(ball(0.17, 16), white);
    w.position.set(x, y, z);
    const p = new Mesh(ball(0.09, 12), ink);
    p.position.set(x, y, z + 0.14);
    const c = new Mesh(ball(0.08, 10), cheek);
    c.position.set(x * 1.55, y - 0.2, z - 0.02);
    c.scale.set(1, 0.6, 0.4);
    group.add(w, p, c);
  }
  const mouth = new Mesh(capsule(0.035, 0.14), ink);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, y - 0.24, z + 0.06);
  group.add(mouth);
}

function armOf(jelly: Material, side: 1 | -1, y: number): Group {
  const arm = new Group();
  arm.position.set(side * 0.62, y, 0.1);
  const limb = new Mesh(capsule(0.1, 0.42), jelly);
  limb.position.y = 0.26;
  const paw = new Mesh(ball(0.15, 14), toyMaterial(PALETTE.white, { finish: 'satin' }));
  paw.position.y = 0.55;
  arm.add(limb, paw);
  arm.rotation.z = side * -0.4;
  return arm;
}

/** 피자랑 — the partner chef: an orange jelly bear with a puffy chef hat and an apron. */
export function partnerModel(): Monster {
  const g = new Group();
  const jelly = jellyMaterial('#ff9b54').material;
  const body = new Mesh(ball(0.72, 40), jelly);
  body.position.y = 0.75;
  body.scale.set(1, 0.95, 0.95);
  body.castShadow = true;
  g.add(body);
  face(g, 0.92, 0.6);
  for (const x of [-0.42, 0.42]) {
    const ear = new Mesh(ball(0.18, 14), jelly);
    ear.position.set(x, 1.38, 0);
    g.add(ear);
  }
  const hatBand = new Mesh(
    new CylinderGeometry(0.4, 0.4, 0.28, 24),
    toyMaterial(PALETTE.white, { finish: 'satin' }),
  );
  hatBand.position.y = 1.55;
  const puff = new Mesh(ball(0.48, 24), toyMaterial(PALETTE.white, { finish: 'satin' }));
  puff.position.y = 1.86;
  puff.scale.set(1, 0.7, 1);
  const apron = new Mesh(roundedBox(0.66, 0.36, 0.1, 0.08), toyMaterial('#e2492f', { finish: 'satin' }));
  apron.position.set(0, 0.32, 0.6);
  apron.rotation.x = 0.35;
  g.add(hatBand, puff, apron);
  const arm = armOf(jelly, 1, 0.75);
  const other = armOf(jelly, -1, 0.75);
  g.add(arm, other);
  return { group: g, body, arm };
}

const CUSTOMER_TINT = ['#8fd3ff', '#d7b98a', '#e9ecf7', '#ffd23f', '#b48cff'];

/** The five customers (쏙쏙이 sock, 뽀송송 mushroom, 몽글몽글이 cloud, 꽥꽥팡 duck, 반짝뿅 star). */
export function customerModel(i: number): Monster {
  const g = new Group();
  const tint = CUSTOMER_TINT[i % CUSTOMER_TINT.length] as string;
  const jelly = jellyMaterial(tint).material;
  const body = new Mesh(ball(0.62, 36), jelly);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  face(g, 0.78, 0.52, 0.22);
  const kind = i % 5;
  if (kind === 0) {
    // sock: a striped cuff on the head
    for (let k = 0; k < 3; k++) {
      const band = new Mesh(
        new CylinderGeometry(0.34, 0.38, 0.12, 20),
        toyMaterial(k % 2 ? PALETTE.white : PALETTE.berry, { finish: 'satin' }),
      );
      band.position.y = 1.2 + k * 0.12;
      g.add(band);
    }
  } else if (kind === 1) {
    // mushroom cap with white spots
    const cap = new Mesh(
      new SphereGeometry(0.6, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      toyMaterial('#e2492f', { finish: 'satin' }),
    );
    cap.position.y = 1.1;
    cap.scale.y = 0.7;
    g.add(cap);
    for (let k = 0; k < 4; k++) {
      const dot = new Mesh(ball(0.08, 10), toyMaterial(PALETTE.white));
      const a = k * 1.6;
      dot.position.set(Math.cos(a) * 0.36, 1.42, Math.sin(a) * 0.36);
      g.add(dot);
    }
  } else if (kind === 2) {
    // cloud puffs around the head
    for (let k = 0; k < 5; k++) {
      const p = new Mesh(ball(0.26, 16), toyMaterial(PALETTE.white, { finish: 'satin' }));
      const a = k * 1.26;
      p.position.set(Math.cos(a) * 0.48, 1.12 + Math.sin(k) * 0.08, Math.sin(a) * 0.3 - 0.1);
      g.add(p);
    }
  } else if (kind === 3) {
    // duck: a beak and a tuft
    const beak = new Mesh(new ConeGeometry(0.15, 0.32, 12), toyMaterial('#ff8a3d'));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.62, 0.66);
    const tuft = new Mesh(capsule(0.06, 0.24), jelly);
    tuft.position.set(0, 1.35, 0);
    tuft.rotation.z = 0.3;
    g.add(beak, tuft);
  } else {
    // a twinkling star on top
    const star = new Mesh(new OctahedronGeometry(0.26), metalMaterial('#f2b632', 0.2));
    star.position.y = 1.5;
    star.scale.set(1, 1, 0.4);
    g.add(star);
  }
  const arm = armOf(jelly, 1, 0.6);
  arm.scale.setScalar(0.8);
  g.add(arm);
  return { group: g, body, arm };
}

/** A gold crown for the VIP (sits on any customer's head). */
export function crownModel(): Group {
  const g = new Group();
  const gold = metalMaterial('#f2b632', 0.25);
  const band = new Mesh(new CylinderGeometry(0.34, 0.36, 0.18, 24, 1, true), gold);
  g.add(band);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const spike = new Mesh(new ConeGeometry(0.08, 0.22, 8), gold);
    spike.position.set(Math.cos(a) * 0.33, 0.18, Math.sin(a) * 0.33);
    const gem = new Mesh(ball(0.05, 8), toyMaterial(k % 2 ? PALETTE.berry : '#2fb4cc', { rimStrength: 0.8 }));
    gem.position.set(Math.cos(a) * 0.35, 0.02, Math.sin(a) * 0.35);
    g.add(spike, gem);
  }
  return g;
}

/** A big round "pizza key" the child presses (a dough disc with a crust rim). */
export function keyModel(): { group: Group; top: Mesh } {
  const g = new Group();
  const rim = new Mesh(disc(0.62, 0.22, 36), toyMaterial(COLORS.crust, { finish: 'satin' }));
  rim.castShadow = true;
  const top = new Mesh(disc(0.52, 0.06, 36), toyMaterial(COLORS.cheese));
  top.position.y = 0.12;
  g.add(rim, top);
  return { group: g, top };
}
