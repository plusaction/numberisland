/**
 * TSL material kit: physically based "real toy" surfaces (D16) — glossy plastic, satin wood, grainy sand,
 * brushed metal, wet jelly and Gerstner-wave water with sun glints. Everything is procedural (no texture
 * files, P1) and compiles on both WebGPU (WGSL) and WebGL2 (GLSL).
 *
 * Materials are cached and shared (`userData.shared`): fewer GPU pipelines and uploads, and identical
 * materials let static meshes be merged into one draw call (see `geo/merge.ts`). Shared materials are
 * never disposed by scene teardown.
 */

import {
  color,
  cos,
  float,
  mix,
  normalLocal,
  normalView,
  positionLocal,
  positionViewDirection,
  sin,
  smoothstep,
  texture,
  time,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import {
  BackSide,
  type BufferGeometry,
  Color,
  type ColorRepresentation,
  Mesh,
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  type Node,
} from 'three/webgpu';
import { WAVES_POND, type WaveParams } from '../water/waves';
import { noiseTexture } from './noise-texture';

/**
 * Shared animation clock for water (seconds). Advanced by `RenderWorld.frame`; CPU code reads `.value` so
 * floating objects use exactly the time the shader uses.
 */
export const waterTime = uniform(0);

/** Fresnel-style rim term (0 facing camera → 1 at silhouette). */
const rim = (power: number) =>
  float(1).sub(normalView.dot(positionViewDirection).abs().clamp(0, 1)).pow(power);

const cache = new Map<string, MeshPhysicalNodeMaterial | MeshStandardNodeMaterial>();
function shared<T extends MeshPhysicalNodeMaterial | MeshStandardNodeMaterial>(
  key: string,
  make: () => T,
): T {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const m = make();
  m.userData.shared = true;
  m.name = key;
  cache.set(key, m);
  return m;
}

/** Number of distinct cached materials (perf HUD / leak tests). */
export const sharedMaterialCount = () => cache.size;

/** GPU resources belonged to a lost device: let the next frame recompile/upload them. */
export function invalidateSharedMaterials() {
  for (const m of cache.values()) m.needsUpdate = true;
}

/**
 * Low tier (weak phones, software GPUs): every shared PBR material has a flat Lambert stand-in — one cheap
 * diffuse term, no texture lookups, no environment sampling, no vertex waves. `RenderWorld` swaps them in and
 * out when the quality governor crosses the low tier, so the same scenes run on any device.
 */
const lowCache = new Map<number, MeshLambertNodeMaterial>();
export function lowVariant(m: {
  userData: Record<string, unknown>;
  transparent: boolean;
}): MeshLambertNodeMaterial | null {
  const hex = m.userData.lowColor;
  if (typeof hex !== 'number') return null;
  const key = hex * 2 + (m.transparent ? 1 : 0);
  let low = lowCache.get(key);
  if (!low) {
    low = new MeshLambertNodeMaterial({
      color: hex,
      transparent: m.transparent,
      opacity: m.transparent ? 0.9 : 1,
    });
    low.userData.shared = true;
    low.userData.isLow = true;
    lowCache.set(key, low);
  }
  return low;
}

export type Finish = 'plastic' | 'matte' | 'satin';

/** Shared noise lookup in object space (xz + a bit of y so vertical faces are not streaked). */
const noiseAt = (scale: number) => {
  const p = positionLocal;
  return texture(noiseTexture(), vec2(p.x.add(p.y.mul(0.37)), p.z.sub(p.y.mul(0.29))).mul(scale));
};

/**
 * Toy plastic: standard PBR (one specular lobe — cheap on phones) with low roughness, so the sky
 * environment and the sun give it a glossy, real-plastic look. `rimStrength` keeps a soft self-light for
 * small bright pieces (fruit, selection ring).
 */
export function toyMaterial(
  hex: ColorRepresentation,
  opts: { roughness?: number; rimStrength?: number; finish?: Finish } = {},
): MeshStandardNodeMaterial {
  const finish = opts.finish ?? 'plastic';
  const key = `toy|${new Color(hex).getHexString()}|${finish}|${opts.roughness ?? ''}|${opts.rimStrength ?? ''}`;
  return shared(key, () => {
    const rough = opts.roughness ?? (finish === 'plastic' ? 0.3 : finish === 'satin' ? 0.5 : 0.8);
    const m = new MeshStandardNodeMaterial({ roughness: rough, metalness: 0 });
    m.userData.lowColor = new Color(hex).getHex();
    const base = color(new Color(hex));
    m.colorNode = base;
    if (opts.rimStrength) m.emissiveNode = base.mul(rim(2.5).mul(opts.rimStrength).add(0.05));
    return m;
  });
}

/** Satin wood with grain from the shared noise texture (poles, trunks, table tops). */
export function woodMaterial(
  hex: ColorRepresentation = '#a8744f',
  roughness = 0.55,
): MeshStandardNodeMaterial {
  return shared(`wood|${new Color(hex).getHexString()}|${roughness}`, () => {
    const m = new MeshStandardNodeMaterial({ roughness, metalness: 0 });
    m.userData.lowColor = new Color(hex).getHex();
    const p = positionLocal;
    const n = texture(noiseTexture(), vec2(p.x.add(p.z).mul(0.35), p.y.mul(2.5))).g;
    const rings = sin(p.x.mul(7).add(p.z.mul(3)).add(n.mul(9)))
      .mul(0.5)
      .add(0.5);
    const base = color(new Color(hex));
    m.colorNode = base.mul(mix(float(0.78), float(1.08), rings.mul(rings)));
    m.roughnessNode = mix(float(roughness * 0.75), float(roughness * 1.25), rings);
    return m;
  });
}

/**
 * Polished plank table top: planks along z with per-plank tint, fine grain along the plank and dark seams.
 * Low roughness so the toys reflect in it (env everywhere, screen-space reflections on ultra).
 */
export function tableMaterial(hex: ColorRepresentation = '#c89a6e'): MeshStandardNodeMaterial {
  return shared(`table|${new Color(hex).getHexString()}`, () => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.22, metalness: 0 });
    m.userData.lowColor = new Color(hex).getHex();
    const p = positionLocal;
    const w = 1.1; // plank width
    const plank = p.x.div(w).floor();
    const across = p.x.div(w).fract();
    const tintN = texture(noiseTexture(), vec2(plank.mul(0.137), 0.31)).b;
    const grain = texture(noiseTexture(), vec2(across.mul(0.05).add(plank.mul(0.21)), p.z.mul(0.03))).r;
    const seam = smoothstep(0.0, 0.025, across).mul(smoothstep(1.0, 0.975, across));
    const base = color(new Color(hex));
    m.colorNode = base
      .mul(mix(float(0.82), float(1.08), tintN))
      .mul(mix(float(0.9), float(1.05), grain))
      .mul(mix(float(0.55), float(1), seam));
    m.roughnessNode = mix(float(0.5), float(0.18), seam.mul(grain.mul(0.5).add(0.5)));
    return m;
  });
}

/** Fine sand / soil: grain + patches, optional animated caustics (two scrolling cell layers, min-blended). */
export function sandMaterial(hex: ColorRepresentation, caustics = false): MeshStandardNodeMaterial {
  return shared(`sand|${new Color(hex).getHexString()}|${caustics}`, () => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
    m.userData.lowColor = new Color(hex).getHex();
    const fine = noiseAt(2.2);
    const big = noiseAt(0.18);
    const base = color(new Color(hex));
    m.colorNode = base.mul(mix(float(0.86), float(1.06), big.b)).mul(mix(float(0.93), float(1.04), fine.r));
    m.roughnessNode = mix(float(0.8), float(0.97), fine.r);
    if (caustics) {
      const p = positionLocal;
      const uvA = vec2(p.x, p.z)
        .mul(0.09)
        .add(vec2(time.mul(0.012), time.mul(0.008)));
      const uvB = vec2(p.z, p.x)
        .mul(0.11)
        .sub(vec2(time.mul(0.01), time.mul(0.014)));
      const c = texture(noiseTexture(), uvA).a.min(texture(noiseTexture(), uvB).a);
      m.emissiveNode = vec3(1, 0.98, 0.9).mul(smoothstep(0.55, 0.95, c).mul(0.45));
    }
    return m;
  });
}

/** Grass / foliage: matte, two-scale colour variation; instance colours tint it per bush. */
export function grassMaterial(hex: ColorRepresentation): MeshStandardNodeMaterial {
  return shared(`grass|${new Color(hex).getHexString()}`, () => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0 });
    m.userData.lowColor = new Color(hex).getHex();
    const n = noiseAt(0.6);
    const base = color(new Color(hex));
    m.colorNode = base
      .mul(mix(float(0.78), float(1.1), n.g))
      .mul(mix(float(0.92), float(1.05), noiseAt(3).r));
    return m;
  });
}

/** Painted / brushed metal (bomb shells, buckets, rims). */
export function metalMaterial(hex: ColorRepresentation, roughness = 0.32): MeshStandardNodeMaterial {
  return shared(`metal|${new Color(hex).getHexString()}|${roughness}`, () => {
    const m = new MeshStandardNodeMaterial({ roughness, metalness: 0.85 });
    m.userData.lowColor = new Color(hex).getHex();
    const p = positionLocal;
    const brush = texture(noiseTexture(), vec2(p.x.add(p.z).mul(4), p.y.mul(0.05))).r;
    m.colorNode = color(new Color(hex));
    m.roughnessNode = float(roughness).add(brush.mul(0.14));
    return m;
  });
}

export interface JellyMaterial {
  material: MeshPhysicalNodeMaterial;
  /** 0 = calm, 1 = wobbling hard. Decays in the caller. */
  wobble: { value: number };
}

/** Wet, glossy jelly: clear coat + sheen + thin-film shimmer + faked subsurface glow (per slime: own wobble). */
export function jellyMaterial(hex: ColorRepresentation): JellyMaterial {
  const m = new MeshPhysicalNodeMaterial({
    roughness: 0.14,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.94,
  });
  const wobble = uniform(0);
  const base = color(new Color(hex));
  m.colorNode = base;
  m.emissiveNode = base.mul(float(0.16).add(rim(1.6).mul(0.4)));
  // gooey wobble: slower, deeper ripples running up the body
  const w = sin(time.mul(7).add(positionLocal.y.mul(4.5)))
    .mul(wobble)
    .mul(0.1);
  m.positionNode = positionLocal.add(normalLocal.mul(w));
  return { material: m, wobble };
}

/**
 * Gerstner-wave water for a horizontal plane (`geo/shapes.waterPlane`): rolling displacement with
 * analytic normals, Fresnel sky reflection from the environment map, sun glints, crest/edge foam and a
 * soft round edge. The same wave set is evaluated on the CPU (`water/waves.ts`) so floating things bob
 * exactly on the surface.
 */
export function waterMaterial(
  deep: ColorRepresentation = '#11789e',
  shallow: ColorRepresentation = '#3cc0d6',
  radius = 4.6,
  waves: WaveParams = WAVES_POND,
  /** Open sea: no see-through (saves a full-screen blended layer and the seabed under it). */
  opaque = false,
): MeshStandardNodeMaterial {
  const key = `water|${new Color(deep).getHexString()}|${new Color(shallow).getHexString()}|${radius}|${waves.name}|${opaque}`;
  return shared(key, () => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.05, metalness: 0, transparent: !opaque });
    m.userData.lowColor = new Color(opaque ? deep : shallow).getHex();
    const p = positionLocal;
    const xz = vec2(p.x, p.z);
    type N = Node<'float'>;
    const tx: N[] = [];
    const ty: N[] = [];
    const tz: N[] = [];
    const tnx: N[] = [];
    const tnz: N[] = [];
    const tny: N[] = [];
    for (const w of waves.list) {
      const k = (2 * Math.PI) / w.length;
      const c = Math.sqrt(9.8 / k) * w.speed;
      const d = vec2(w.dir[0], w.dir[1]).normalize();
      const f = d
        .dot(xz)
        .mul(k)
        .sub(waterTime.mul(c * k));
      const cf = cos(f);
      const sf = sin(f);
      const qa = w.steep * w.amp;
      tx.push(d.x.mul(cf).mul(qa));
      tz.push(d.y.mul(cf).mul(qa));
      ty.push(sf.mul(w.amp));
      tnx.push(d.x.mul(cf).mul(-k * w.amp));
      tnz.push(d.y.mul(cf).mul(-k * w.amp));
      tny.push(sf.mul(w.steep * k * w.amp));
    }
    const sum = (t: N[]) => t.reduce((a, b) => a.add(b) as N);
    const dx = sum(tx);
    const dy = sum(ty);
    const dz = sum(tz);
    const nx = sum(tnx);
    const nz = sum(tnz);
    const ny = float(1).sub(sum(tny));
    const r = xz.length();
    // keep the shoreline still so the water never pulls away from the bank
    const shore = smoothstep(radius, radius * 0.82, r);
    m.positionNode = p.add(vec3(dx, dy, dz).mul(shore));
    const n = vec3(nx.mul(shore), ny, nz.mul(shore)).normalize();
    m.normalNode = transformNormalToView(n);
    const facing = normalView.dot(positionViewDirection).abs().clamp(0, 1);
    const fresnel = float(0.02).add(float(0.98).mul(float(1).sub(facing).pow(5)));
    const crest = smoothstep(waves.foamAt * 1.3, waves.foamAt * 2.2, dy).mul(0.45);
    const scrollA = xz.mul(0.35).add(vec2(waterTime.mul(0.02), waterTime.mul(0.013)));
    const scrollB = xz.mul(0.5).sub(vec2(waterTime.mul(0.017), waterTime.mul(0.021)));
    const ripple = texture(noiseTexture(), scrollA).g;
    const edge = smoothstep(radius * 0.93, radius * 0.99, r.add(ripple.mul(0.12)));
    const foam = crest.add(edge).clamp(0, 1);
    // pond: deep in the middle; open sea: shallow turquoise around the island, deep blue further out
    const body = opaque
      ? mix(color(new Color(shallow)), color(new Color(deep)), smoothstep(radius * 0.36, radius * 0.75, r))
      : mix(color(new Color(deep)), color(new Color(shallow)), smoothstep(radius * 0.45, radius * 1.05, r));
    m.colorNode = mix(body, vec3(1, 1, 1), foam.mul(0.85));
    m.roughnessNode = mix(float(0.04), float(0.6), foam);
    // tiny sparkling glints (sun on wave facets), strongest at grazing angles
    const sparkle = texture(noiseTexture(), scrollA.mul(6)).r.mul(texture(noiseTexture(), scrollB.mul(7)).r);
    const glint = smoothstep(0.5, 0.75, sparkle);
    m.emissiveNode = vec3(1, 0.97, 0.88)
      .mul(glint.mul(fresnel.add(0.15)).mul(1.4))
      .add(body.mul(0.06));
    if (!opaque)
      m.opacityNode = mix(float(0.86), float(0.99), fresnel.add(foam).clamp(0, 1)).mul(
        smoothstep(radius, radius * 0.97, r),
      );
    return m;
  });
}

/**
 * Inverted-hull outline: a back-face copy pushed out along normals. The realistic look (D16) no longer
 * outlines the scene; kept for gameplay highlights only (one extra draw call per use).
 */
export function addOutline(target: Mesh, thickness = 0.035, hex: ColorRepresentation = '#3b3355'): Mesh {
  const mat = new MeshBasicNodeMaterial({ side: BackSide });
  mat.colorNode = color(new Color(hex));
  mat.positionNode = positionLocal.add(normalLocal.mul(thickness));
  const hull = new Mesh(target.geometry as BufferGeometry, mat);
  hull.name = 'outline';
  hull.raycast = () => {};
  target.add(hull);
  return hull;
}
