/**
 * Card-battle props: holographic number cards, the + / − chips, score gems and the three toy monsters.
 *
 * The card face is a holo foil (TSL): a rainbow that slides with the viewing angle and the card's height,
 * plus twinkling glints from the shared noise texture — it shimmers as cards tilt, fly and flip. One shared
 * material per tint keeps it to a couple of draw calls per card (face + back), all original toys (P3).
 */
import { color, cos, float, mix, normalView, sin, smoothstep, texture, time, uv, vec3 } from 'three/tsl';
import { ConeGeometry, Group, Mesh, MeshStandardNodeMaterial, OctahedronGeometry } from 'three/webgpu';
import { ball, capsule, roundedBox } from '../../engine/geo/shapes';
import { NumberLabel } from '../../engine/numbers/number-label';
import { PALETTE } from '../../engine/palette';
import { jellyMaterial, metalMaterial, toyMaterial } from '../../engine/tsl/materials';
import { noiseTexture } from '../../engine/tsl/noise-texture';
import type { BotId } from './rules';

const holoCache = new Map<string, MeshStandardNodeMaterial>();
/** Holographic foil: angle-dependent rainbow + glints, over a soft base tint. */
export function holoMaterial(base: string, strength = 0.5): MeshStandardNodeMaterial {
  const key = `${base}|${strength}`;
  const hit = holoCache.get(key);
  if (hit) return hit;
  const m = new MeshStandardNodeMaterial({ roughness: 0.22, metalness: 0.3 });
  const phase = normalView.x.mul(2.4).add(normalView.y.mul(1.6)).add(uv().y.mul(1.3)).add(time.mul(0.12));
  const rainbow = vec3(0.55).add(vec3(0.45).mul(cos(vec3(phase.mul(6.283)).add(vec3(0, 2.094, 4.189)))));
  const n = texture(noiseTexture(), uv().mul(2.5)).r;
  const glint = smoothstep(0.8, 0.95, n).mul(sin(time.mul(3).add(n.mul(40))).max(0));
  m.colorNode = mix(color(base), rainbow, float(strength));
  m.emissiveNode = rainbow.mul(0.16).add(vec3(glint.mul(0.9)));
  m.userData.shared = true;
  holoCache.set(key, m);
  return m;
}

export interface Card {
  group: Group;
  label: NumberLabel;
  setValue(v: number): void;
}

const FACE = roundedBox(1.25, 1.75, 0.05, 0.12);
const RIM = roundedBox(1.37, 1.87, 0.04, 0.15);

/** A standing card: holo face (+z) with a big place-coloured number, a starry navy back (−z). */
export function card(tint: string, value: number): Card {
  const group = new Group();
  const rim = new Mesh(RIM, toyMaterial(PALETTE.white));
  const face = new Mesh(FACE, holoMaterial(tint));
  face.position.z = 0.025;
  face.castShadow = true;
  const back = new Mesh(FACE, holoMaterial('#2b2f6b', 0.25));
  back.position.z = -0.025;
  const star = new Mesh(new OctahedronGeometry(0.28), metalMaterial('#f2b632', 0.2));
  star.position.z = -0.08;
  star.scale.z = 0.3;
  const label = new NumberLabel(value, { size: 0.82, placeColors: true });
  // well in front of the face: the label always faces the camera, the card is tilted back — closer to the
  // face its top would sink behind the card
  label.position.set(0, -0.05, 0.42);
  group.add(rim, face, back, star, label);
  return {
    group,
    label,
    setValue(v) {
      label.set(v);
    },
  };
}

/** A score gem slot (empty = dim glass, won = bright). */
export function gem(won: boolean, hex: string): Mesh {
  const m = new Mesh(
    new OctahedronGeometry(0.26),
    won ? toyMaterial(hex, { rimStrength: 0.9 }) : toyMaterial('#d8d3e6', { finish: 'matte' }),
  );
  m.scale.y = 1.3;
  m.castShadow = true;
  return m;
}

export interface Bot {
  group: Group;
  body: Mesh;
  /** A little "…" thinking bubble. */
  think: Group;
}

const BOT_TINT: Record<BotId, string> = { chick: '#ffd23f', octopus: '#ff8fc8', robot: '#8fb7e8' };

/** The three original monsters (jelly bodies, each with its own look). */
export function botModel(id: BotId): Bot {
  const group = new Group();
  const tint = BOT_TINT[id];
  const body = new Mesh(ball(0.85, 40), jellyMaterial(tint).material);
  body.position.y = 0.85;
  body.scale.set(1, 0.9, 1);
  body.castShadow = true;
  group.add(body);
  const ink = toyMaterial(PALETTE.ink);
  const white = toyMaterial(PALETTE.white);
  for (const x of [-0.3, 0.3]) {
    const w = new Mesh(ball(0.2, 16), white);
    w.position.set(x, 1.0, 0.68);
    const p = new Mesh(ball(0.11, 12), ink);
    p.position.set(x, 1.0, 0.86);
    group.add(w, p);
  }
  if (id === 'chick') {
    const beak = new Mesh(new ConeGeometry(0.14, 0.3, 12), toyMaterial('#ff8a3d'));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.78, 0.9);
    group.add(beak);
    for (const [x, r] of [
      [-0.12, 0.4],
      [0.08, -0.2],
    ] as const) {
      const tuft = new Mesh(capsule(0.06, 0.25), toyMaterial(tint));
      tuft.position.set(x, 1.72, 0);
      tuft.rotation.z = r;
      group.add(tuft);
    }
  } else if (id === 'octopus') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leg = new Mesh(capsule(0.12, 0.45), jellyMaterial(tint).material);
      leg.position.set(Math.sin(a) * 0.62, 0.22, Math.cos(a) * 0.62);
      leg.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
      group.add(leg);
    }
    const bow = new Mesh(ball(0.16, 12), toyMaterial(PALETTE.sun));
    bow.position.set(0.45, 1.55, 0.2);
    group.add(bow);
  } else {
    const visor = new Mesh(roundedBox(1.0, 0.36, 0.2, 0.12), toyMaterial('#2b2f6b', { rimStrength: 0.6 }));
    visor.position.set(0, 1.0, 0.72);
    const antenna = new Mesh(capsule(0.03, 0.4), metalMaterial('#cfd6e4'));
    antenna.position.set(0, 1.85, 0);
    const tip = new Mesh(ball(0.1, 12), toyMaterial(PALETTE.berry, { rimStrength: 1 }));
    tip.position.set(0, 2.12, 0);
    group.add(visor, antenna, tip);
  }
  const think = new Group();
  for (let i = 0; i < 3; i++) {
    const dot = new Mesh(ball(0.09, 10), white);
    dot.position.set(-0.25 + i * 0.25, 0, 0);
    think.add(dot);
  }
  think.position.set(0.9, 2.1, 0.3);
  group.add(think);
  return { group, body, think };
}
