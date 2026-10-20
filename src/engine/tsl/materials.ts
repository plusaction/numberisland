/**
 * TSL material kit (SPEC §7.1): soft toy clay, jelly, water, inverted-hull outline.
 * All node graphs compile on both WebGPU (WGSL) and WebGL2 (GLSL) backends.
 */

import {
  color,
  float,
  mix,
  mx_noise_float,
  normalLocal,
  normalView,
  positionLocal,
  positionViewDirection,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import {
  BackSide,
  type BufferGeometry,
  Color,
  type ColorRepresentation,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu';
import { PALETTE } from '../palette';

/** Fresnel-style rim term (0 facing camera → 1 at silhouette). */
const rim = (power: number) =>
  float(1).sub(normalView.dot(positionViewDirection).abs().clamp(0, 1)).pow(power);

export function toyMaterial(
  hex: ColorRepresentation,
  opts: { roughness?: number; rimStrength?: number } = {},
) {
  const m = new MeshStandardNodeMaterial({ roughness: opts.roughness ?? 0.6, metalness: 0 });
  const base = color(new Color(hex));
  m.colorNode = base;
  // soft clay: warm rim light + a touch of self-light so shadows never go muddy
  m.emissiveNode = base.mul(0.06).add(color(PALETTE.cream).mul(rim(2.5).mul(opts.rimStrength ?? 0.22)));
  return m;
}

export interface JellyMaterial {
  material: MeshStandardNodeMaterial;
  /** 0 = calm, 1 = wobbling hard. Decays in the caller. */
  wobble: { value: number };
}

export function jellyMaterial(hex: ColorRepresentation): JellyMaterial {
  const m = new MeshStandardNodeMaterial({ roughness: 0.18, metalness: 0, transparent: true, opacity: 0.93 });
  const wobble = uniform(0);
  const base = color(new Color(hex));
  m.colorNode = base;
  // fake subsurface: glow in the core, brighter rim
  m.emissiveNode = base.mul(float(0.22).add(rim(1.6).mul(0.55)));
  const w = sin(time.mul(9).add(positionLocal.y.mul(5)))
    .mul(wobble)
    .mul(0.06);
  m.positionNode = positionLocal.add(normalLocal.mul(w));
  return { material: m, wobble };
}

export function waterMaterial(
  deep: ColorRepresentation = '#3fb8d4',
  shallow: ColorRepresentation = PALETTE.sea,
) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.12, metalness: 0, transparent: true, opacity: 0.88 });
  const p = positionLocal;
  const n = mx_noise_float(vec3(p.x.mul(0.9), p.y.mul(0.9), time.mul(0.35)));
  const wave = sin(p.x.mul(2.2).add(time.mul(1.4)))
    .mul(0.04)
    .add(sin(p.y.mul(1.7).add(time.mul(1.1))).mul(0.035));
  m.positionNode = p.add(vec3(0, 0, wave.add(n.mul(0.05))));
  const edge = uv().sub(0.5).length().mul(2); // 0 centre → 1 rim (circular pond)
  const foam = smoothstep(0.9, 0.97, edge.add(n.mul(0.03))).mul(0.6);
  const sparkle = smoothstep(0.55, 0.75, n).mul(0.25);
  m.colorNode = mix(color(new Color(deep)), color(new Color(shallow)), edge.add(n.mul(0.2)).clamp(0, 1))
    .add(sparkle)
    .add(foam.mul(0.8));
  m.emissiveNode = color(new Color(shallow)).mul(0.08).add(foam.mul(0.25));
  m.side = DoubleSide;
  return m;
}

/** Inverted-hull outline: a back-face copy pushed out along normals (works on every backend/tier). */
export function addOutline(target: Mesh, thickness = 0.035, hex: ColorRepresentation = PALETTE.ink): Mesh {
  const mat = new MeshBasicNodeMaterial({ side: BackSide });
  mat.colorNode = color(new Color(hex));
  mat.positionNode = positionLocal.add(normalLocal.mul(thickness));
  const hull = new Mesh(target.geometry as BufferGeometry, mat);
  hull.name = 'outline';
  hull.raycast = () => {};
  target.add(hull);
  return hull;
}
