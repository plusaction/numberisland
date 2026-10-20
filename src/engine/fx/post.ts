/** Post-processing per tier (SPEC §7.1): bloom (high+), vignette (min+). Low tier renders directly. */

import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { float, mix, pass, screenUV, smoothstep } from 'three/tsl';
import { type Camera, RenderPipeline, type Scene, type WebGPURenderer } from 'three/webgpu';
import type { TierConfig } from '../quality/quality';

export interface Post {
  render(): void;
  dispose(): void;
}

export function createPost(renderer: WebGPURenderer, scene: Scene, camera: Camera, cfg: TierConfig): Post {
  if (cfg.post === 'none') {
    return { render: () => renderer.render(scene, camera), dispose: () => {} };
  }
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const withBloom =
    cfg.post === 'partial' || cfg.post === 'full'
      ? color.add(bloom(color, cfg.post === 'full' ? 0.35 : 0.22, 0.45, 0.82))
      : color;
  const d = screenUV.sub(0.5).length().mul(1.35);
  const vig = mix(float(1), float(0.84), smoothstep(0.45, 1.0, d));
  pipeline.outputNode = withBloom.mul(vig);
  return {
    render: () => pipeline.render(),
    dispose: () => {
      pipeline.dispose();
      scenePass.dispose();
    },
  };
}
