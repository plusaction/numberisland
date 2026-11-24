/**
 * Little toy animals and living props for the maps (D62): a handful of shared-geometry meshes each, glossy
 * toy plastic, faces with two eyes. Original, generic animals (P3). Front faces +Z.
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { ball, capsule, disc, roundedBox } from '../geo/shapes';
import { toyMaterial } from '../tsl/materials';

const eyeWhite = () => toyMaterial('#ffffff', { finish: 'satin' });
const eyeDark = () => toyMaterial('#2a2440', { finish: 'satin' });

function eyes(g: Group, y: number, z: number, gap: number, r = 0.05) {
  for (const sx of [-1, 1]) {
    const w = new Mesh(ball(r, 10), eyeWhite());
    w.position.set(sx * gap, y, z);
    const p = new Mesh(ball(r * 0.55, 8), eyeDark());
    p.position.set(sx * gap, y, z + r * 0.6);
    g.add(w, p);
  }
}

export function frog(scale = 1): Group {
  const g = new Group();
  const body = new Mesh(ball(0.22, 14), toyMaterial('#5fcf6a'));
  body.scale.set(1.1, 0.75, 1);
  body.position.y = 0.16;
  const belly = new Mesh(ball(0.17, 12), toyMaterial('#e7f7c9', { finish: 'satin' }));
  belly.scale.set(1, 0.6, 0.6);
  belly.position.set(0, 0.12, 0.1);
  g.add(body, belly);
  for (const sx of [-1, 1]) {
    const bump = new Mesh(ball(0.08, 10), toyMaterial('#5fcf6a'));
    bump.position.set(sx * 0.1, 0.3, 0.08);
    g.add(bump);
  }
  eyes(g, 0.33, 0.13, 0.1, 0.045);
  g.scale.setScalar(scale);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

export function duck(scale = 1, color = '#ffd84a'): Group {
  const g = new Group();
  const body = new Mesh(ball(0.24, 14), toyMaterial(color));
  body.scale.set(0.9, 0.75, 1.25);
  body.position.y = 0.12;
  const head = new Mesh(ball(0.14, 12), toyMaterial(color));
  head.position.set(0, 0.34, 0.2);
  const beak = new Mesh(ball(0.07, 10), toyMaterial('#ff9a3c'));
  beak.scale.set(1.2, 0.5, 1.1);
  beak.position.set(0, 0.32, 0.35);
  const tail = new Mesh(new ConeGeometry(0.08, 0.16, 8), toyMaterial(color));
  tail.rotation.x = -1.1;
  tail.position.set(0, 0.22, -0.3);
  g.add(body, head, beak, tail);
  eyes(g, 0.39, 0.3, 0.06, 0.03);
  g.scale.setScalar(scale);
  return g;
}

export function penguin(scale = 1): Group {
  const g = new Group();
  const body = new Mesh(capsule(0.2, 0.26), toyMaterial('#2c3350'));
  body.position.y = 0.33;
  const belly = new Mesh(ball(0.17, 12), toyMaterial('#ffffff', { finish: 'satin' }));
  belly.scale.set(1, 1.35, 0.55);
  belly.position.set(0, 0.3, 0.12);
  const beak = new Mesh(new ConeGeometry(0.05, 0.12, 8), toyMaterial('#ffae3c'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.5, 0.21);
  g.add(body, belly, beak);
  for (const sx of [-1, 1]) {
    const foot = new Mesh(ball(0.07, 8), toyMaterial('#ffae3c'));
    foot.scale.set(1, 0.35, 1.4);
    foot.position.set(sx * 0.09, 0.03, 0.08);
    const wing = new Mesh(ball(0.08, 8), toyMaterial('#2c3350'));
    wing.scale.set(0.4, 1.4, 0.8);
    wing.position.set(sx * 0.21, 0.32, 0);
    g.add(foot, wing);
  }
  eyes(g, 0.57, 0.16, 0.07, 0.035);
  g.scale.setScalar(scale);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

export function crab(scale = 1): Group {
  const g = new Group();
  const body = new Mesh(ball(0.2, 14), toyMaterial('#ff6b5c'));
  body.scale.set(1.3, 0.55, 1);
  body.position.y = 0.12;
  g.add(body);
  for (const sx of [-1, 1]) {
    const claw = new Mesh(ball(0.09, 10), toyMaterial('#ff6b5c'));
    claw.scale.set(1, 0.8, 1.2);
    claw.position.set(sx * 0.3, 0.16, 0.12);
    const stalk = new Mesh(capsule(0.015, 0.1), toyMaterial('#ff6b5c'));
    stalk.position.set(sx * 0.07, 0.25, 0.08);
    g.add(claw, stalk);
    for (let k = 0; k < 2; k++) {
      const leg = new Mesh(capsule(0.02, 0.12), toyMaterial('#e2554a'));
      leg.rotation.z = sx * 1.1;
      leg.position.set(sx * 0.24, 0.06, -0.05 + k * 0.1);
      g.add(leg);
    }
  }
  eyes(g, 0.32, 0.1, 0.07, 0.035);
  g.scale.setScalar(scale);
  return g;
}

export function cat(scale = 1, color = '#ffb36b'): Group {
  const g = new Group();
  const body = new Mesh(ball(0.3, 14), toyMaterial(color));
  body.scale.set(1.3, 0.7, 0.9);
  body.position.y = 0.2;
  const head = new Mesh(ball(0.2, 14), toyMaterial(color));
  head.position.set(0.34, 0.28, 0.08);
  g.add(body, head);
  for (const dz of [-0.08, 0.1]) {
    const ear = new Mesh(new ConeGeometry(0.07, 0.13, 6), toyMaterial(color));
    ear.position.set(0.36, 0.48, dz + 0.08);
    g.add(ear);
  }
  const tail = new Mesh(capsule(0.05, 0.4), toyMaterial(color));
  tail.rotation.set(0, 0, 1.2);
  tail.position.set(-0.4, 0.12, 0.2);
  g.add(tail);
  // sleeping: closed eyes are two little dark arcs
  for (const dz of [-0.06, 0.1]) {
    const lid = new Mesh(roundedBox(0.02, 0.015, 0.06, 0.005), eyeDark());
    lid.position.set(0.53, 0.3, dz + 0.06);
    g.add(lid);
  }
  g.scale.setScalar(scale);
  return g;
}

export function snail(scale = 1): Group {
  const g = new Group();
  const foot = new Mesh(capsule(0.08, 0.35), toyMaterial('#c9e58a'));
  foot.rotation.x = Math.PI / 2;
  foot.position.y = 0.07;
  const shell = new Mesh(ball(0.18, 14), toyMaterial('#ff9fc5'));
  shell.scale.set(0.7, 1, 1);
  shell.position.set(0, 0.24, -0.05);
  const swirl = new Mesh(ball(0.09, 10), toyMaterial('#ffd1e3'));
  swirl.scale.set(0.3, 1, 1);
  swirl.position.set(0.12, 0.25, -0.05);
  g.add(foot, shell, swirl);
  for (const sx of [-1, 1]) {
    const st = new Mesh(capsule(0.015, 0.12), toyMaterial('#c9e58a'));
    st.position.set(sx * 0.04, 0.2, 0.22);
    const tip = new Mesh(ball(0.03, 8), eyeDark());
    tip.position.set(sx * 0.04, 0.28, 0.22);
    g.add(st, tip);
  }
  g.scale.setScalar(scale);
  return g;
}

export function squirrel(scale = 1): Group {
  const g = new Group();
  const body = new Mesh(ball(0.2, 12), toyMaterial('#c9844f'));
  body.scale.set(0.9, 1.1, 0.9);
  body.position.y = 0.22;
  const head = new Mesh(ball(0.14, 12), toyMaterial('#c9844f'));
  head.position.set(0, 0.46, 0.06);
  const tail = new Mesh(ball(0.2, 12), toyMaterial('#a8663a'));
  tail.scale.set(0.6, 1.5, 0.7);
  tail.position.set(0, 0.35, -0.22);
  const nut = new Mesh(ball(0.06, 8), toyMaterial('#8a5a3c'));
  nut.position.set(0, 0.3, 0.2);
  g.add(body, head, tail, nut);
  eyes(g, 0.5, 0.17, 0.06, 0.03);
  g.scale.setScalar(scale);
  return g;
}

export function snowman(scale = 1): Group {
  const g = new Group();
  const white = toyMaterial('#ffffff', { finish: 'satin' });
  const low = new Mesh(ball(0.32, 16), white);
  low.position.y = 0.3;
  const mid = new Mesh(ball(0.23, 16), white);
  mid.position.y = 0.72;
  const head = new Mesh(ball(0.17, 14), white);
  head.position.y = 1.03;
  const nose = new Mesh(new ConeGeometry(0.035, 0.16, 8), toyMaterial('#ff8a3c'));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.03, 0.2);
  const hat = new Mesh(new CylinderGeometry(0.12, 0.12, 0.18, 14), toyMaterial('#3b3355'));
  hat.position.y = 1.24;
  const brim = new Mesh(disc(0.19, 0.03, 16), toyMaterial('#3b3355'));
  brim.position.y = 1.15;
  const scarf = new Mesh(disc(0.2, 0.07, 16), toyMaterial('#ff5f7e'));
  scarf.position.y = 0.9;
  g.add(low, mid, head, nose, hat, brim, scarf);
  eyes(g, 1.08, 0.14, 0.06, 0.03);
  g.scale.setScalar(scale);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

/** A self-lit toadstool for caves and night maps (glows in every tier). */
export function glowShroom(scale = 1, color = '#7fe8ff'): Group {
  const g = new Group();
  const stem = new Mesh(
    new CylinderGeometry(0.06, 0.08, 0.3, 10),
    toyMaterial('#f3efe6', { finish: 'satin' }),
  );
  stem.position.y = 0.15;
  const cap = new Mesh(ball(0.2, 14), new MeshBasicNodeMaterial({ color }));
  cap.scale.set(1, 0.55, 1);
  cap.position.y = 0.32;
  g.add(stem, cap);
  for (let i = 0; i < 3; i++) {
    const dot = new Mesh(ball(0.035, 8), new MeshBasicNodeMaterial({ color: '#ffffff' }));
    const a = i * 2.1;
    dot.position.set(Math.cos(a) * 0.11, 0.39, Math.sin(a) * 0.11);
    g.add(dot);
  }
  g.scale.setScalar(scale);
  return g;
}

/** A simple toy tree (round crown or pine) — tinted per map (spring green, snowy, autumn…). */
export function tree(kind: 'round' | 'pine', crown: string, scale = 1, snow = false): Group {
  const g = new Group();
  const trunk = new Mesh(
    new CylinderGeometry(0.1, 0.14, 0.7, 10),
    toyMaterial('#8a5a3c', { finish: 'satin' }),
  );
  trunk.position.y = 0.35;
  g.add(trunk);
  if (kind === 'round') {
    const c = new Mesh(ball(0.55, 16), toyMaterial(crown, { finish: 'satin' }));
    c.position.y = 1.05;
    g.add(c);
    if (snow) {
      const cap = new Mesh(ball(0.5, 14), toyMaterial('#ffffff', { finish: 'matte' }));
      cap.scale.set(1, 0.45, 1);
      cap.position.y = 1.4;
      g.add(cap);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const c = new Mesh(new ConeGeometry(0.55 - i * 0.13, 0.6, 10), toyMaterial(crown, { finish: 'satin' }));
      c.position.y = 0.85 + i * 0.35;
      g.add(c);
      if (snow) {
        const sc = new Mesh(
          new ConeGeometry(0.3 - i * 0.07, 0.22, 10),
          toyMaterial('#ffffff', { finish: 'matte' }),
        );
        sc.position.y = 1.08 + i * 0.35;
        g.add(sc);
      }
    }
  }
  g.scale.setScalar(scale);
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}
