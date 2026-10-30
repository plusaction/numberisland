/**
 * A toy number-fish (nose = +X): plump glossy body with a pale belly, a forked tail that wags, dorsal and side
 * fins, a little mouth and two big eyes (white, pupil, sparkle) — one on each side. Parts are batched per
 * material (`mergeStatic`) so each fish costs a handful of draw calls; the tail is its own group so it can swim.
 */
import { Color, Group, Mesh } from 'three/webgpu';
import { markStatic, mergeStatic } from '../../engine/geo/merge';
import { ball } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { toyMaterial } from '../../engine/tsl/materials';

export interface FishModel {
  group: Group;
  /** Wag this around Y. */
  tail: Group;
}

const part = (
  radius: number,
  mat: ReturnType<typeof toyMaterial>,
  pos: [number, number, number],
  scale: [number, number, number],
  rot: [number, number, number] = [0, 0, 0],
) => {
  const m = new Mesh(ball(radius, 20), mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  return markStatic(m);
};

export function fishModel(hex: string): FishModel {
  const base = new Color(hex);
  const skin = toyMaterial(hex);
  const belly = toyMaterial(`#${base.clone().lerp(new Color('#ffffff'), 0.55).getHexString()}`, {
    finish: 'satin',
  });
  const fin = toyMaterial(`#${base.clone().offsetHSL(0, 0.05, -0.12).getHexString()}`, { finish: 'satin' });
  const white = toyMaterial(PALETTE.white);
  const ink = toyMaterial(PALETTE.ink);
  const glint = toyMaterial('#ffffff', { rimStrength: 0.9 });
  const cheekMat = toyMaterial('#ff9fb8', { finish: 'matte' });

  const group = new Group();
  const body = part(0.42, skin, [0, 0, 0], [1.45, 0.95, 0.72]);
  body.castShadow = true;
  group.add(
    body,
    part(0.4, belly, [0.04, -0.13, 0], [1.25, 0.6, 0.66]),
    part(0.2, fin, [-0.08, 0.38, 0], [1.25, 0.8, 0.16], [0, 0, 0.35]),
    part(0.06, ink, [0.6, -0.05, 0], [0.5, 0.55, 1.6]),
  );
  for (const z of [-1, 1]) {
    group.add(
      part(0.13, fin, [0.08, -0.14, z * 0.27], [1.2, 0.45, 0.3], [0, z * 0.5, -0.3]),
      part(0.11, white, [0.36, 0.1, z * 0.21], [1, 1, 1]),
      part(0.066, ink, [0.39, 0.1, z * 0.3], [1, 1, 0.8]),
      part(0.022, glint, [0.42, 0.14, z * 0.35], [1, 1, 1]),
      part(0.06, cheekMat, [0.44, -0.07, z * 0.23], [1, 0.7, 0.4]),
    );
  }
  mergeStatic(group);

  // forked tail, hinged at the back of the body
  const tail = new Group();
  tail.position.x = -0.52;
  tail.add(
    part(0.12, fin, [-0.05, 0, 0], [1, 0.8, 0.35]),
    part(0.25, fin, [-0.22, 0.14, 0], [1.1, 0.5, 0.18], [0, 0, -0.6]),
    part(0.25, fin, [-0.22, -0.14, 0], [1.1, 0.5, 0.18], [0, 0, 0.6]),
  );
  mergeStatic(tail);
  group.add(tail);
  return { group, tail };
}
