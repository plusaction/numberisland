/**
 * "괴물 친구" — the friendly jelly monster who greets the child on the first screens and reacts to
 * placement answers (jump + sparkles when right, a puzzled wobble when not — never scary, P2).
 */
import { ConeGeometry, Group, Mesh } from 'three/webgpu';
import { Spring } from '../../engine/fx/juice';
import { ball, capsule } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { jellyMaterial, toyMaterial } from '../../engine/tsl/materials';

export interface Friend {
  group: Group;
  update(dt: number, t: number, reducedMotion: boolean): void;
  cheer(ok: boolean): void;
}

export function createFriend(): Friend {
  const g = new Group();
  const jelly = jellyMaterial('#9b7cf0');
  const body = new Mesh(ball(0.62, 40), jelly.material);
  body.castShadow = true;
  body.position.y = 0.6;
  body.scale.set(1, 0.88, 1);
  const face = new Group();
  for (const x of [-0.22, 0.22]) {
    const white = new Mesh(ball(0.16, 20), toyMaterial(PALETTE.white));
    white.position.set(x, 0.12, 0.5);
    const pupil = new Mesh(ball(0.085, 16), toyMaterial(PALETTE.ink));
    pupil.position.set(x, 0.12, 0.64);
    const shine = new Mesh(ball(0.03, 8), toyMaterial(PALETTE.white));
    shine.position.set(x + 0.03, 0.16, 0.71);
    const cheek = new Mesh(ball(0.08, 12), toyMaterial('#ff9fb8', { finish: 'matte' }));
    cheek.position.set(x * 1.7, -0.06, 0.5);
    cheek.scale.set(1, 0.6, 0.4);
    face.add(white, pupil, shine, cheek);
  }
  const mouth = new Mesh(capsule(0.03, 0.12), toyMaterial(PALETTE.ink));
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0, -0.12, 0.58);
  face.add(mouth);
  body.add(face);
  for (const x of [-0.3, 0.3]) {
    const horn = new Mesh(new ConeGeometry(0.09, 0.26, 16), toyMaterial(PALETTE.sun));
    horn.position.set(x, 0.58, 0.05);
    horn.rotation.z = -x * 0.8;
    horn.castShadow = true;
    body.add(horn);
    const foot = new Mesh(ball(0.17, 16), toyMaterial('#7d5fd6'));
    foot.position.set(x * 0.9, 0.1, 0.18);
    foot.scale.set(1, 0.55, 1.2);
    g.add(foot);
  }
  g.add(body);
  const squash = new Spring(0, 170, 9);
  let jumpT = 1;
  let shakeT = 1;
  return {
    group: g,
    update(dt, t, reduced) {
      const s = squash.update(dt);
      const breathe = reduced ? 0 : Math.sin(t * 2.4) * 0.025;
      body.scale.set(1 - s * 0.12 - breathe, 0.88 + s * 0.16 + breathe, 1 - s * 0.12 - breathe);
      jumpT = Math.min(1, jumpT + dt * 1.6);
      shakeT = Math.min(1, shakeT + dt * 1.8);
      body.position.y = 0.6 + (reduced ? 0 : Math.sin(jumpT * Math.PI) * 0.9);
      g.rotation.z = reduced ? 0 : Math.sin(shakeT * Math.PI * 4) * (1 - shakeT) * 0.25;
      face.rotation.y = reduced ? 0 : Math.sin(t * 0.7) * 0.15;
      jelly.wobble.value *= Math.exp(-dt * 2.5);
    },
    cheer(ok) {
      if (ok) {
        jumpT = 0;
        squash.impulse(-6);
        jelly.wobble.value = 1;
      } else {
        shakeT = 0;
        jelly.wobble.value = 0.6;
      }
    },
  };
}
