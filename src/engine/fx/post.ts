/**
 * Post-processing per tier (D16). `none`/`min` are built in; the GTAO + SSR + bloom pipeline for high/ultra
 * lives in a lazy chunk (`post-advanced.ts`): until it has loaded the scene renders directly, so low tiers and
 * phones never download or compile it.
 */
import { float, mix, pass, screenUV, smoothstep } from 'three/tsl';
import { type Camera, RenderPipeline, type Scene, type WebGPURenderer } from 'three/webgpu';
import type { TierConfig } from '../quality/quality';

import type { Post } from './post-types';

export type { Post };

export function createPost(renderer: WebGPURenderer, scene: Scene, camera: Camera, cfg: TierConfig): Post {
  if (cfg.post === 'none') {
    return { render: () => renderer.render(scene, camera), dispose: () => {} };
  }
  if (cfg.post === 'min') {
    const pipeline = new RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    const d = screenUV.sub(0.5).length().mul(1.35);
    pipeline.outputNode = scenePass
      .getTextureNode('output')
      .mul(mix(float(1), float(0.86), smoothstep(0.45, 1.0, d)));
    return {
      render: () => pipeline.render(),
      dispose: () => {
        pipeline.dispose();
        scenePass.dispose();
      },
    };
  }
  let inner: Post | null = null;
  let disposed = false;
  void import('./post-advanced').then(({ createAdvancedPost }) => {
    if (!disposed) inner = createAdvancedPost(renderer, scene, camera, cfg);
  });
  return {
    render: () => (inner ? inner.render() : renderer.render(scene, camera)),
    dispose: () => {
      disposed = true;
      inner?.dispose();
    },
  };
}
