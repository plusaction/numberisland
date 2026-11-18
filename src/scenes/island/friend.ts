/**
 * "괴물 친구" — the friendly jelly monster who greets the child on the first screens and reacts to
 * placement answers (jump + sparkles when right, a puzzled wobble when not — never scary, P2).
 */
import { ConeGeometry, Group, Mesh, Vector3 } from 'three/webgpu';

const FORWARD = new Vector3(0, 0, 1);

import { Spring } from '../../engine/fx/juice';
import { ball, capsule } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { jellyMaterial, toyMaterial } from '../../engine/tsl/materials';

export interface Friend {
  group: Group;
  update(dt: number, t: number, reducedMotion: boolean): void;
  cheer(ok: boolean): void;
  /** Where to look (a world point), or null to look straight ahead. The pupils glide there. */
  lookAt(target: Vector3 | null): void;
  /** Wide eyes for a moment (a near bump, a snack). */
  surprise(): void;
}

export function createFriend(): Friend {
  const g = new Group();
  g.name = 'monster-friend';
  const jelly = jellyMaterial('#9b7cf0');
  const body = new Mesh(ball(0.62, 40), jelly.material);
  body.castShadow = true;
  body.position.y = 0.6;
  body.scale.set(1, 0.88, 1);
  // face parts sit ON the jelly: each is placed on the body's surface and turned to face out along it,
  // so from the side they hug the body instead of sticking out like marbles
  const face = new Group();
  const R = 0.62;
  const onSurface = (o: Group | Mesh, x: number, y: number, sink: number) => {
    const n = new Vector3(x, y, Math.sqrt(Math.max(0.05, 1 - x * x - y * y))).normalize();
    o.position.copy(n).multiplyScalar(R - sink);
    o.quaternion.setFromUnitVectors(FORWARD, n);
  };
  const eyes: { group: Group; pupil: Mesh; shine: Mesh }[] = [];
  for (const x of [-0.36, 0.36]) {
    const eye = new Group();
    const white = new Mesh(ball(0.17, 24), toyMaterial(PALETTE.white));
    white.scale.set(1, 1.12, 0.42);
    const pupil = new Mesh(ball(0.09, 18), toyMaterial(PALETTE.ink));
    pupil.scale.set(1, 1.1, 0.45);
    pupil.position.z = 0.055;
    const shine = new Mesh(ball(0.032, 10), toyMaterial(PALETTE.white));
    shine.position.set(0.035, 0.045, 0.09);
    eye.add(white, pupil, shine);
    onSurface(eye, x, 0.2, 0.035);
    face.add(eye);
    eyes.push({ group: eye, pupil, shine });
    const cheek = new Mesh(ball(0.085, 12), toyMaterial('#ff9fb8', { finish: 'matte' }));
    cheek.scale.set(1, 0.6, 0.3);
    const cheekHold = new Group();
    cheekHold.add(cheek);
    onSurface(cheekHold, x * 1.45, -0.08, 0.01);
    face.add(cheekHold);
  }
  const mouth = new Mesh(capsule(0.03, 0.12), toyMaterial(PALETTE.ink));
  mouth.rotation.z = Math.PI / 2;
  const mouthHold = new Group();
  mouthHold.add(mouth);
  onSurface(mouthHold, 0, -0.16, 0.0);
  face.add(mouthHold);
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
  let blinkIn = 1.5;
  let blinkT = 1;
  let wide = 0;
  let gazeX = 0;
  let gazeY = 0;
  let wantX = 0;
  let wantY = 0;
  const local = new Vector3();
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
      // blinking (now and then, sometimes twice) and the pupils gliding toward what it looks at
      blinkIn -= dt;
      if (blinkIn <= 0) {
        blinkT = 0;
        blinkIn = 2.2 + ((((Math.sin(t * 12.9898) * 43758.5453) % 1) + 1) % 1) * 3;
        if (blinkIn > 4.6) blinkIn = 0.25; // a double blink
      }
      blinkT += dt;
      const lid = blinkT < 0.14 ? 1 - Math.sin((blinkT / 0.14) * Math.PI) * 0.9 : 1;
      wide += (0 - wide) * Math.min(1, dt * 2.5);
      gazeX += (wantX - gazeX) * Math.min(1, dt * 8);
      gazeY += (wantY - gazeY) * Math.min(1, dt * 8);
      for (const e of eyes) {
        e.group.scale.set(1 + wide * 0.18, lid * (1 + wide * 0.22), 1);
        e.pupil.position.set(gazeX * 0.065, gazeY * 0.06, 0.055);
        e.pupil.scale.set(1 - wide * 0.25, (1 - wide * 0.25) * 1.1, 0.45);
        e.shine.position.set(0.035 + gazeX * 0.04, 0.045 + gazeY * 0.035, 0.09);
      }
      jelly.wobble.value *= Math.exp(-dt * 2.5);
    },
    lookAt(target) {
      if (!target) {
        wantX = wantY = 0;
        return;
      }
      // the target in the body's own frame: left/right and up/down of straight ahead
      body.updateWorldMatrix(true, false);
      local.copy(target);
      body.worldToLocal(local);
      const len = Math.hypot(local.x, local.y, local.z) || 1;
      wantX = Math.max(-1, Math.min(1, (local.x / len) * 1.8));
      wantY = Math.max(-1, Math.min(1, ((local.y - 0.2) / len) * 1.8));
      // behind it: eyes glance to that side
      if (local.z < 0) wantX = Math.sign(local.x || 1);
    },
    surprise() {
      wide = 1;
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
