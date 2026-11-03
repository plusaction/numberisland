/**
 * A toy number-fish (nose = +X): plump glossy body with a pale belly, a forked tail that wags, dorsal and side
 * fins, a little mouth and two big eyes (white, pupil, sparkle) — one on each side. Parts are batched per
 * material (`mergeStatic`) so each fish costs a handful of draw calls; the tail is its own group so it can swim.
 */
import { Color, Group, Mesh, Quaternion, Vector3 } from 'three/webgpu';
import { markStatic, mergeStatic } from '../../engine/geo/merge';
import { ball } from '../../engine/geo/shapes';
import { PALETTE } from '../../engine/palette';
import { metalMaterial, toyMaterial } from '../../engine/tsl/materials';

export interface FishModel {
  group: Group;
  /** Wag this around Y. */
  tail: Group;
  /** Both eyes, pivoting on the eye centre: squash Y to blink / smile, scale up to look surprised. */
  eyes: Group;
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

// body ellipsoid semi-axes (ball 0.42 scaled 1.45 × 0.95 × 0.72)
const AX = 0.42 * 1.45;
const AY = 0.42 * 0.95;
const AZ = 0.42 * 0.72;
const Z_AXIS = new Vector3(0, 0, 1);

/**
 * A flat lens lying ON the body surface at (x, y) on side `side`: centred on the ellipsoid, facing along its
 * normal and pressed thin, so eyes read as painted-in fish eyes instead of balls stuck on the side.
 */
function onSkin(
  radius: number,
  mat: ReturnType<typeof toyMaterial>,
  x: number,
  y: number,
  side: number,
  lift: number,
  flat = 0.28,
) {
  const z = side * AZ * Math.sqrt(Math.max(0, 1 - (x / AX) ** 2 - (y / AY) ** 2));
  const n = new Vector3(x / AX ** 2, y / AY ** 2, z / AZ ** 2).normalize();
  const m = new Mesh(ball(radius, 20), mat);
  m.position.set(x, y, z).addScaledVector(n, lift);
  m.quaternion.copy(new Quaternion().setFromUnitVectors(Z_AXIS, n));
  m.scale.set(1, 1, flat);
  return markStatic(m);
}

const EYE_X = 0.355;
const EYE_Y = 0.07;

// one finished model per colour; every fish is a cheap clone sharing its merged geometry and materials, so a
// new puzzle no longer merges and uploads fresh geometry for each fish (that stalled the frame on a new puzzle)
const templates = new Map<string, Group>();

/** `gold`: polished metal instead of glossy plastic (the golden fish). */
export function fishModel(hex: string, gold = false): FishModel {
  const key = `${hex}|${gold}`;
  let tpl = templates.get(key);
  if (!tpl) {
    tpl = buildFish(hex, gold);
    tpl.traverse((o) => {
      const g = (o as { geometry?: { userData: Record<string, unknown> } }).geometry;
      if (g) g.userData.shared = true; // owned by the template: scene teardown never disposes it
    });
    templates.set(key, tpl);
  }
  const group = tpl.clone();
  return {
    group,
    tail: group.getObjectByName('tail') as Group,
    eyes: group.getObjectByName('eyes') as Group,
  };
}

function buildFish(hex: string, gold: boolean): Group {
  const base = new Color(hex);
  const tone = (c: Color, finish: 'plastic' | 'satin') =>
    gold ? metalMaterial(c, 0.22) : toyMaterial(`#${c.getHexString()}`, { finish });
  const skin = tone(base, 'plastic');
  const belly = tone(base.clone().lerp(new Color('#ffffff'), gold ? 0.3 : 0.55), 'satin');
  const fin = tone(base.clone().offsetHSL(0, 0.05, -0.12), 'satin');
  const white = toyMaterial(PALETTE.white);
  const ink = toyMaterial(PALETTE.ink);
  const lip = toyMaterial(`#${base.clone().offsetHSL(0, 0.1, -0.3).getHexString()}`, { finish: 'satin' });
  const glint = toyMaterial('#ffffff', { rimStrength: 0.9 });
  const cheekMat = toyMaterial('#ff9fb8', { finish: 'matte' });

  const group = new Group();
  const body = part(0.42, skin, [0, 0, 0], [1.45, 0.95, 0.72]);
  body.castShadow = true;
  group.add(
    body,
    part(0.4, belly, [0.04, -0.13, 0], [1.25, 0.6, 0.66]),
    part(0.2, fin, [-0.08, 0.38, 0], [1.25, 0.8, 0.16], [0, 0, 0.35]),
    part(0.045, lip, [0.6, -0.06, 0], [0.45, 0.6, 1.0]),
  );
  for (const z of [-1, 1]) {
    group.add(
      part(0.13, fin, [0.08, -0.14, z * 0.27], [1.2, 0.45, 0.3], [0, z * 0.5, -0.3]),
      onSkin(0.055, cheekMat, 0.44, -0.11, z, 0.0, 0.2),
    );
  }
  mergeStatic(group);

  // eyes: white rim, big dark iris, one catch-light (upper front) — all flush with the skin
  const eyes = new Group();
  eyes.name = 'eyes';
  eyes.position.set(EYE_X, EYE_Y, 0);
  for (const z of [-1, 1]) {
    for (const m of [
      onSkin(0.1, white, 0.34, 0.07, z, 0.0),
      onSkin(0.074, ink, 0.355, 0.07, z, 0.018),
      onSkin(0.022, glint, 0.375, 0.1, z, 0.034, 0.6),
    ]) {
      m.position.sub(eyes.position);
      eyes.add(m);
    }
  }
  mergeStatic(eyes);
  group.add(eyes);

  // forked tail, hinged at the back of the body
  const tail = new Group();
  tail.name = 'tail';
  tail.position.x = -0.52;
  tail.add(
    part(0.12, fin, [-0.05, 0, 0], [1, 0.8, 0.35]),
    part(0.25, fin, [-0.22, 0.14, 0], [1.1, 0.5, 0.18], [0, 0, -0.6]),
    part(0.25, fin, [-0.22, -0.14, 0], [1.1, 0.5, 0.18], [0, 0, 0.6]),
  );
  mergeStatic(tail);
  group.add(tail);
  return group;
}
