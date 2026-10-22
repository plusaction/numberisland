/** Quality tiers with frame-time EMA auto adjust + hysteresis (SPEC §7.2). */
import type { Backend } from '../../infra/render/renderer';

export type Tier = 'ultra' | 'high' | 'balanced' | 'low';
export const TIERS: readonly Tier[] = ['low', 'balanced', 'high', 'ultra'];

export interface TierConfig {
  dprCap: number;
  post: 'none' | 'min' | 'partial' | 'full';
  gpuParticles: boolean;
  maxParticles: number;
  shadows: 'soft' | 'basic' | 'off';
  shadowMapSize: number;
  /** Decorative rigid-body bursts (coins, candy, drops). */
  physics: boolean;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  ultra: {
    dprCap: 1.75,
    post: 'full',
    gpuParticles: true,
    maxParticles: 50_000,
    shadows: 'soft',
    shadowMapSize: 2048,
    physics: true,
  },
  high: {
    dprCap: 1.5,
    post: 'partial',
    gpuParticles: true,
    maxParticles: 20_000,
    shadows: 'soft',
    shadowMapSize: 2048,
    physics: true,
  },
  balanced: {
    dprCap: 1.25,
    post: 'min',
    gpuParticles: false,
    maxParticles: 2_000,
    shadows: 'basic',
    shadowMapSize: 1024,
    physics: true,
  },
  low: {
    dprCap: 1,
    post: 'none',
    gpuParticles: false,
    maxParticles: 600,
    shadows: 'basic',
    shadowMapSize: 512,
    physics: false,
  },
};

/** Phones/tablets (coarse pointer): lower pixel ratio cap and start one tier lower (thermals, battery). */
export const isMobile = (): boolean => globalThis.matchMedia?.('(pointer: coarse)').matches ?? false;
export const MOBILE_DPR_CAP = 1.25;

export function initialTier(backend: Backend, mobile = false): Tier {
  if (mobile) return 'balanced';
  return backend === 'webgpu' ? 'high' : 'balanced';
}

/**
 * Highest tier a backend may reach. WebGL2 can run contact shadows (high, CPU particles) when the governor
 * measures headroom; screen-space reflections + compute particles (ultra) are WebGPU only.
 */
export function maxTier(backend: Backend): Tier {
  return backend === 'webgpu' ? 'ultra' : 'high';
}

export interface QualityGovernor {
  tier: Tier;
  locked: boolean;
  /** Feed a frame time; returns the new tier if it changed. */
  sample(frameMs: number): Tier | null;
}

/**
 * Down-tier when EMA > 24 ms (≈ <42 fps) for 2 s; up-tier when EMA < 12 ms for 6 s.
 * Hysteresis prevents oscillation; a locked governor never changes (parent setting).
 */
export function createGovernor(
  backend: Backend,
  start?: Tier,
  locked = false,
  mobile = false,
): QualityGovernor {
  let ema = 16.7;
  let slowFor = 0;
  let fastFor = 0;
  let cooldown = 0;
  /** Tiers we had to leave for being too slow: never upgrade back into them this session. */
  const failed = new Set<Tier>();
  const changed = (t: Tier) => {
    gov.tier = t;
    ema = 16.7;
    slowFor = 0;
    fastFor = 0;
    cooldown = 10_000;
    return t;
  };
  const top = TIERS.indexOf(maxTier(backend));
  const gov: QualityGovernor = {
    tier: start ?? initialTier(backend, mobile),
    locked,
    sample(frameMs) {
      ema = ema * 0.9 + frameMs * 0.1;
      if (gov.locked) return null;
      if (cooldown > 0) {
        cooldown -= frameMs;
        return null;
      }
      const idx = TIERS.indexOf(gov.tier);
      if (ema > 24) {
        slowFor += frameMs;
        fastFor = 0;
      } else if (ema < 12) {
        fastFor += frameMs;
        slowFor = 0;
      } else {
        slowFor = 0;
        fastFor = 0;
      }
      if (slowFor > 2000 && idx > 0) {
        failed.add(gov.tier);
        return changed(TIERS[idx - 1] as Tier);
      }
      const up = TIERS[idx + 1] as Tier | undefined;
      if (fastFor > 6000 && idx < top && up && !failed.has(up)) return changed(up);
      if (fastFor > 6000) fastFor = 0;
      return null;
    },
  };
  return gov;
}

/** `?tier=` from the URL, validated (unknown values are ignored). */
export function tierFromUrl(search: string = globalThis.location?.search ?? ''): Tier | undefined {
  const t = new URLSearchParams(search).get('tier');
  return t && (TIERS as readonly string[]).includes(t) ? (t as Tier) : undefined;
}
