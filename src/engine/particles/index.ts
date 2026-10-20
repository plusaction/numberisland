import type { Rng } from '../../domain/rng/rng';
import type { TierConfig } from '../quality/quality';
import { createCpuParticles } from './cpu';
import { createGpuParticles } from './gpu';
import type { ParticleSystem } from './particles';

export type { ParticleKind, ParticleSystem } from './particles';

/** Choose the implementation by feature: compute needs the WebGPU backend + a GPU tier. */
export function createParticles(cfg: TierConfig, backendIsWebGPU: boolean, rng: Rng): ParticleSystem {
  if (backendIsWebGPU && cfg.gpuParticles) {
    try {
      return createGpuParticles(cfg.maxParticles);
    } catch (err) {
      console.warn('[particles] compute unavailable, using CPU path', err);
    }
  }
  return createCpuParticles(Math.min(cfg.maxParticles, 2000), rng);
}
