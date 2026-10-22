/**
 * Post-processing per tier (D16):
 * - full (ultra):     GTAO contact shadows + screen-space reflections (water, glossy toys, table) + bloom
 * - partial (high):   GTAO + bloom
 * - min (balanced):   vignette only (direct scene pass, no extra targets)
 * - none (low):       direct render
 * Expensive passes run at half resolution. One MRT scene pass feeds every effect (no re-render).
 */

import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import {
  blendColor,
  float,
  metalness,
  mix,
  mrt,
  normalView,
  output,
  packNormalToRGB,
  pass,
  roughness,
  sample,
  screenUV,
  smoothstep,
  unpackRGBToNormal,
  vec2,
  vec4,
} from 'three/tsl';
import { type Camera, RenderPipeline, type Scene, type WebGPURenderer } from 'three/webgpu';
import { setLabelMask } from '../numbers/number-label';
import type { TierConfig } from '../quality/quality';
import type { Post } from './post-types';

/** Loaded on demand (separate chunk) only when a tier with contact shadows / reflections runs. */
export function createAdvancedPost(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  cfg: TierConfig,
): Post {
  if (cfg.post === 'none') {
    return { render: () => renderer.render(scene, camera), dispose: () => {} };
  }
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const d = screenUV.sub(0.5).length().mul(1.35);
  const vig = mix(float(1), float(0.86), smoothstep(0.45, 1.0, d));
  const disposers: { dispose(): void }[] = [];

  if (cfg.post === 'min') {
    pipeline.outputNode = scenePass.getTextureNode('output').mul(vig);
  } else {
    const full = cfg.post === 'full';
    scenePass.setMRT(
      mrt({
        output,
        normal: packNormalToRGB(normalView),
        labelMask: vec4(0, 0, 0, 0),
        ...(full ? { metalrough: vec2(metalness, roughness) } : {}),
      }),
    );
    const colorTex = scenePass.getTextureNode('output');
    const depthTex = scenePass.getTextureNode('depth');
    const normalTex = scenePass.getTextureNode('normal');
    const normal = sample((uv) => unpackRGBToNormal(normalTex.sample(uv)));

    // contact shadows / ambient occlusion: the "toys sit on the table" depth cue
    const aoPass = ao(depthTex, normal, camera);
    aoPass.resolutionScale = 0.5;
    aoPass.radius.value = 0.6;
    aoPass.thickness.value = 0.6;
    disposers.push(aoPass);
    const occl = aoPass.getTextureNode().sample(screenUV).r;
    const k = mix(float(0.55), float(1), occl);
    let lit = colorTex.mul(vec4(k, k, k, 1));

    if (full) {
      const mr = scenePass.getTextureNode('metalrough');
      const refl = ssr(lit, depthTex, normal, {
        metalnessNode: mr.r,
        roughnessNode: mr.g,
        reflectNonMetals: true,
        camera,
      });
      refl.resolutionScale = 0.5;
      refl.maxDistance.value = 6;
      refl.thickness.value = 0.05;
      refl.intensity.value = 0.65;
      disposers.push(refl);
      lit = blendColor(lit, refl);
    }
    const glow = bloom(lit, full ? 0.3 : 0.2, 0.45, 0.92);
    disposers.push(glow);
    // number labels write labelMask = 1 (alpha-blended): there the image keeps its original colours,
    // untouched by contact shadows and bloom (P9 place-value colours stay exact)
    setLabelMask(mrt({ labelMask: vec4(1, 1, 1, output.a) }));
    const mask = scenePass.getTextureNode('labelMask').r;
    pipeline.outputNode = mix(lit.add(glow), colorTex, mask).mul(vig);
  }
  return {
    render: () => pipeline.render(),
    dispose: () => {
      setLabelMask(null);
      for (const d of disposers) d.dispose();
      pipeline.dispose();
      scenePass.dispose();
    },
  };
}
