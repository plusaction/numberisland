/**
 * Island decorations (D40): ten little toys that appear on the island, in a fixed order, as the child's
 * coins grow. Procedural and cheap (a handful of meshes each); a few of them move.
 */
import { ConeGeometry, CylinderGeometry, Group, Mesh, TorusGeometry } from 'three/webgpu';
import type { DecorId } from '../../domain/meta';
import { ball, capsule, disc, roundedBox } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { toyMaterial, woodMaterial } from '../../engine/tsl/materials';

export interface Decor {
  group: Group;
  /** Optional idle motion. */
  update?(t: number): void;
}

/** Where each one stands: [angle°, radius]. Between the portals, clear of the paths. */
export const DECOR_SPOT: Record<DecorId, readonly [number, number]> = {
  flags: [25, 3.0],
  lanterns: [165, 3.1],
  balloons: [255, 2.9],
  bench: [300, 2.6],
  windmill: [72, 5.9],
  swing: [118, 3.0],
  fountain: [335, 2.7],
  kite: [215, 5.6],
  lighthouse: [15, 6.1],
  rainbow: [0, 0],
};

/** How much room each one takes on the ground (for the friend's stroll); 0 = out of reach / in the sky. */
export const DECOR_SIZE: Record<DecorId, number> = {
  flags: 0.95,
  lanterns: 0.4,
  balloons: 0.45,
  bench: 0.7,
  windmill: 0.7,
  swing: 0.85,
  fountain: 0.75,
  kite: 0.3,
  lighthouse: 0.6,
  rainbow: 0,
};

const post = (h: number, color = '#8a5a3c') => {
  const m = new Mesh(capsule(0.06, h), woodMaterial(color));
  m.position.y = h / 2 + 0.06;
  m.castShadow = true;
  return m;
};

export function decorModel(id: DecorId): Decor {
  const g = new Group();
  switch (id) {
    case 'flags': {
      const a = post(1.3);
      a.position.x = -0.8;
      const b = post(1.3);
      b.position.x = 0.8;
      g.add(a, b);
      const colors = [PALETTE.berry, PALETTE.sun, '#2fb4cc', '#7ee08a', PALETTE.lavender];
      colors.forEach((c, i) => {
        const f = new Mesh(new ConeGeometry(0.13, 0.26, 3), toyMaterial(c));
        f.rotation.z = Math.PI;
        f.position.set(-0.6 + i * 0.3, 1.25 - Math.sin((i / 4) * Math.PI) * 0.18, 0);
        g.add(f);
      });
      return { group: g };
    }
    case 'lanterns': {
      const lights: Mesh[] = [];
      [-0.6, 0, 0.6].forEach((x, i) => {
        const p = post(0.9 + (i % 2) * 0.3);
        p.position.x = x;
        const l = new Mesh(ball(0.18, 12), toyMaterial(i % 2 ? PALETTE.sun : '#ffb86b', { rimStrength: 1 }));
        l.position.set(x, 1.15 + (i % 2) * 0.3, 0);
        lights.push(l);
        g.add(p, l);
      });
      return {
        group: g,
        update: (t) => {
          lights.forEach((l, i) => {
            l.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.08);
          });
        },
      };
    }
    case 'balloons': {
      const bunch = new Group();
      [PALETTE.berry, '#2fb4cc', PALETTE.sun].forEach((c, i) => {
        const b = new Mesh(ball(0.28, 16), toyMaterial(c, { rimStrength: 0.5 }));
        b.position.set((i - 1) * 0.3, 1.5 + (i % 2) * 0.25, 0);
        b.scale.y = 1.15;
        bunch.add(b);
      });
      const string = new Mesh(new CylinderGeometry(0.012, 0.012, 1.3, 5), toyMaterial(PALETTE.white));
      string.position.y = 0.75;
      g.add(bunch, string, new Mesh(disc(0.2, 0.12, 12), toyMaterial('#b9a48e', { finish: 'matte' })));
      return { group: g, update: (t) => bunch.rotation.set(0, 0, Math.sin(t * 1.3) * 0.08) };
    }
    case 'bench': {
      const seat = new Mesh(roundedBox(1.2, 0.1, 0.4, 0.04), woodMaterial('#c98a5c'));
      seat.position.y = 0.42;
      seat.castShadow = true;
      const back = new Mesh(roundedBox(1.2, 0.36, 0.08, 0.03), woodMaterial('#c98a5c'));
      back.position.set(0, 0.72, -0.18);
      g.add(seat, back);
      for (const x of [-0.5, 0.5]) {
        const leg = new Mesh(roundedBox(0.1, 0.36, 0.36, 0.03), toyMaterial('#6b7280', { finish: 'matte' }));
        leg.position.set(x, 0.2, 0);
        g.add(leg);
      }
      return { group: g };
    }
    case 'windmill': {
      const tower = new Mesh(
        new CylinderGeometry(0.28, 0.5, 1.9, 8),
        toyMaterial('#fff1d9', { finish: 'matte' }),
      );
      tower.position.y = 0.95;
      tower.castShadow = true;
      const cap = new Mesh(new ConeGeometry(0.42, 0.5, 8), toyMaterial('#e2695a'));
      cap.position.y = 2.15;
      const blades = new Group();
      for (let i = 0; i < 4; i++) {
        const blade = new Mesh(
          roundedBox(0.16, 0.95, 0.04, 0.03),
          toyMaterial(PALETTE.white, { finish: 'satin' }),
        );
        blade.position.y = 0.5;
        const arm = new Group();
        arm.rotation.z = (i / 4) * Math.PI * 2;
        arm.add(blade);
        blades.add(arm);
      }
      blades.position.set(0, 1.75, 0.34);
      g.add(tower, cap, blades);
      return { group: g, update: (t) => blades.rotation.set(0, 0, t * 0.9) };
    }
    case 'swing': {
      for (const x of [-0.55, 0.55]) {
        const p = post(1.5);
        p.position.x = x;
        g.add(p);
      }
      const bar = new Mesh(roundedBox(1.3, 0.1, 0.1, 0.04), woodMaterial('#8a5a3c'));
      bar.position.y = 1.6;
      const seat = new Group();
      const plank = new Mesh(roundedBox(0.5, 0.06, 0.22, 0.02), toyMaterial(PALETTE.berry));
      plank.position.y = -1.05;
      for (const x of [-0.2, 0.2]) {
        const rope = new Mesh(new CylinderGeometry(0.012, 0.012, 1.05, 5), toyMaterial(PALETTE.white));
        rope.position.set(x, -0.52, 0);
        seat.add(rope);
      }
      seat.add(plank);
      seat.position.y = 1.58;
      g.add(bar, seat);
      return { group: g, update: (t) => seat.rotation.set(Math.sin(t * 1.6) * 0.35, 0, 0) };
    }
    case 'fountain': {
      const bowl = new Mesh(disc(0.6, 0.22, 24), toyMaterial('#cfd6e4', { finish: 'satin' }));
      bowl.position.y = 0.12;
      const water = new Mesh(disc(0.5, 0.05, 24), toyMaterial('#7fd6ee', { rimStrength: 0.5 }));
      water.position.y = 0.24;
      const stem = new Mesh(capsule(0.07, 0.4), toyMaterial('#cfd6e4', { finish: 'satin' }));
      stem.position.y = 0.5;
      const drop = new Mesh(ball(0.12, 12), toyMaterial('#bfefff', { rimStrength: 0.8 }));
      g.add(bowl, water, stem, drop);
      return { group: g, update: (t) => drop.position.set(0, 0.85 + Math.abs(Math.sin(t * 3)) * 0.3, 0) };
    }
    case 'kite': {
      const kite = new Group();
      const body = new Mesh(new ConeGeometry(0.34, 0.1, 4), toyMaterial(PALETTE.berry, { rimStrength: 0.4 }));
      body.rotation.x = Math.PI / 2;
      body.scale.set(1, 1, 1.4);
      const tail = new Mesh(new ConeGeometry(0.06, 0.5, 4), toyMaterial(PALETTE.sun));
      tail.position.y = -0.55;
      kite.add(body, tail);
      kite.position.y = 3.0;
      g.add(kite);
      return {
        group: g,
        update: (t) => {
          kite.position.set(Math.sin(t * 0.9) * 0.4, 3.0 + Math.sin(t * 1.4) * 0.2, 0);
          kite.rotation.z = Math.sin(t * 0.9) * 0.3;
        },
      };
    }
    case 'lighthouse': {
      [0, 1, 2].forEach((i) => {
        const band = new Mesh(
          new CylinderGeometry(0.34 - i * 0.05, 0.4 - i * 0.05, 0.7, 12),
          toyMaterial(i % 2 ? PALETTE.white : '#e2695a', { finish: 'satin' }),
        );
        band.position.y = 0.35 + i * 0.7;
        band.castShadow = true;
        g.add(band);
      });
      const lamp = new Mesh(ball(0.22, 12), toyMaterial(PALETTE.sun, { rimStrength: 1 }));
      lamp.position.y = 2.35;
      const cap = new Mesh(new ConeGeometry(0.3, 0.3, 10), toyMaterial('#3b4a6b'));
      cap.position.y = 2.7;
      g.add(lamp, cap);
      return { group: g, update: (t) => lamp.scale.setScalar(1 + Math.max(0, Math.sin(t * 2.5)) * 0.25) };
    }
    case 'rainbow': {
      ['#ff6f91', '#ffc93c', '#7ee08a', '#2fb4cc', '#b9a6f2'].forEach((c, i) => {
        const arc = new Mesh(
          new TorusGeometry(6.4 - i * 0.22, 0.1, 6, 40, Math.PI),
          toyMaterial(c, { rimStrength: 0.7 }),
        );
        g.add(arc);
      });
      g.position.y = 0.2;
      return { group: g };
    }
  }
}
