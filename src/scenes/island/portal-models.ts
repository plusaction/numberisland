/** Procedural mini models for the 8 stage portals (SPEC §10: "스테이지 아이콘(3D 미니 모형)"). */
import { ConeGeometry, Group, Mesh, TorusGeometry } from 'three/webgpu';
import type { StageId } from '../../domain/stage/types';
import { ball, capsule, disc, roundedBox, waterPlane } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { jellyMaterial, toyMaterial, waterMaterial } from '../../engine/tsl/materials';

function m(geo: ConstructorParameters<typeof Mesh>[0], color: string, _outline = true): Mesh {
  const mesh = new Mesh(geo, toyMaterial(color));
  mesh.castShadow = true;
  return mesh;
}

export function portalModel(stage: StageId): Group {
  const g = new Group();
  switch (stage) {
    case 'bomb': {
      const body = m(ball(0.42), '#5b5f8f');
      body.position.y = 0.45;
      const fuse = m(capsule(0.05, 0.25), PALETTE.cocoa, false);
      fuse.position.set(0.1, 0.92, 0);
      fuse.rotation.z = -0.4;
      const spark = m(ball(0.08), PALETTE.sun, false);
      spark.position.set(0.2, 1.08, 0);
      const colors = [PALETTE.berry, PALETTE.leaf, PALETTE.sea];
      colors.forEach((c, i) => {
        const wire = m(new TorusGeometry(0.43, 0.035, 8, 32), c, false);
        wire.position.y = 0.45;
        wire.rotation.set(Math.PI / 2, 0, 0.5 * i - 0.5);
        g.add(wire);
      });
      g.add(body, fuse, spark);
      break;
    }
    case 'zombie': {
      const body = m(capsule(0.28, 0.35), '#9ad48a');
      body.position.y = 0.55;
      const eyeL = m(ball(0.07), PALETTE.white, false);
      eyeL.position.set(-0.1, 0.75, 0.25);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.1;
      const balloon = m(ball(0.2), PALETTE.berry);
      balloon.position.set(0, 1.35, 0);
      const str = m(capsule(0.01, 0.3), PALETTE.ink, false);
      str.position.set(0, 1.05, 0);
      g.add(body, eyeL, eyeR, balloon, str);
      break;
    }
    case 'fishing': {
      const pond = new Mesh(waterPlane(0.6, 24), waterMaterial(undefined, undefined, 0.6));
      pond.position.y = 0.12;
      const fish = m(capsule(0.12, 0.25), PALETTE.peach);
      fish.rotation.z = Math.PI / 2;
      fish.position.set(0.05, 0.42, 0);
      const tail = m(new ConeGeometry(0.12, 0.2, 12), PALETTE.peach, false);
      tail.rotation.z = -Math.PI / 2;
      tail.position.set(-0.32, 0.42, 0);
      g.add(pond, fish, tail);
      break;
    }
    case 'slime': {
      const a = new Mesh(ball(0.3), jellyMaterial(PALETTE.berry).material);
      a.position.set(-0.18, 0.3, 0);
      a.scale.y = 0.8;
      const b = new Mesh(ball(0.22), jellyMaterial(PALETTE.sea).material);
      b.position.set(0.25, 0.22, 0.05);
      b.scale.y = 0.8;
      a.castShadow = b.castShadow = true;
      g.add(a, b);
      break;
    }
    case 'escape': {
      const door = m(roundedBox(0.6, 0.9, 0.12), PALETTE.cocoa);
      door.position.y = 0.5;
      const lock = m(roundedBox(0.28, 0.24, 0.14), PALETTE.sun);
      lock.position.set(0, 0.45, 0.1);
      const shackle = m(new TorusGeometry(0.1, 0.03, 8, 24, Math.PI), '#c9c9d9', false);
      shackle.position.set(0, 0.58, 0.1);
      g.add(door, lock, shackle);
      break;
    }
    case 'pizza': {
      const pie = m(disc(0.45, 0.08), '#f6c26b');
      pie.position.y = 0.2;
      for (let i = 0; i < 5; i++) {
        const t = m(disc(0.07, 0.04, 16), '#e8505b', false);
        const a = (i / 5) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.25, 0.26, Math.sin(a) * 0.25);
        g.add(t);
      }
      g.add(pie);
      break;
    }
    case 'cardbattle': {
      [-0.3, 0, 0.3].forEach((x, i) => {
        const c = m(
          roundedBox(0.34, 0.5, 0.04, 0.04),
          [PALETTE.sky, PALETTE.white, PALETTE.lavender][i] as string,
        );
        c.position.set(x, 0.45, i * 0.02);
        c.rotation.z = -x * 0.8;
        g.add(c);
      });
      break;
    }
    case 'race': {
      const body = m(capsule(0.16, 0.45), PALETTE.berry);
      body.rotation.z = -Math.PI / 2.6;
      body.position.y = 0.5;
      const nose = m(new ConeGeometry(0.16, 0.25, 16), PALETTE.white, false);
      nose.position.set(0.36, 0.72, 0);
      nose.rotation.z = -Math.PI / 2.6;
      const flame = m(new ConeGeometry(0.1, 0.25, 12), PALETTE.sun, false);
      flame.position.set(-0.36, 0.3, 0);
      flame.rotation.z = Math.PI - Math.PI / 2.6;
      g.add(body, nose, flame);
      break;
    }
  }
  return g;
}
