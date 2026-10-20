/**
 * One particle API for confetti / sparkle / dust / droplet (SPEC §7.4).
 * WebGPU tiers use TSL compute (instancedArray + Fn().compute()); WebGL2 tiers use a CPU InstancedMesh.
 */
import type { Object3D, Vector3Like, WebGPURenderer } from 'three/webgpu';

export type ParticleKind = 'confetti' | 'sparkle' | 'dust' | 'droplet';

export interface KindSpec {
  colors: readonly string[];
  speed: [number, number];
  up: number;
  gravity: number;
  life: number;
  size: number;
  drag: number;
}

export const KINDS: Record<ParticleKind, KindSpec> = {
  confetti: {
    colors: ['#ff8fab', '#ffd166', '#8bd48f', '#6fd0e3', '#b9a6f2', '#ffb38a'],
    speed: [2, 5],
    up: 4,
    gravity: 7,
    life: 1.6,
    size: 0.09,
    drag: 1.2,
  },
  sparkle: {
    colors: ['#fff6c2', '#ffd166', '#ffffff'],
    speed: [0.6, 2],
    up: 1.6,
    gravity: -0.6,
    life: 0.9,
    size: 0.07,
    drag: 2,
  },
  dust: {
    colors: ['#e9d8c2', '#d9c4a8', '#f4ead9'],
    speed: [0.4, 1.2],
    up: 0.6,
    gravity: 0.3,
    life: 0.8,
    size: 0.12,
    drag: 3,
  },
  droplet: {
    colors: ['#bdeefa', '#7fd8ec', '#ffffff'],
    speed: [1.2, 3],
    up: 3.5,
    gravity: 9,
    life: 1.1,
    size: 0.07,
    drag: 0.6,
  },
};

export const KIND_INDEX: Record<ParticleKind, number> = { confetti: 0, sparkle: 1, dust: 2, droplet: 3 };

export interface ParticleSystem {
  readonly object: Object3D;
  readonly gpu: boolean;
  emit(kind: ParticleKind, pos: Vector3Like, count: number): void;
  update(dt: number, renderer: WebGPURenderer): void;
  /** Number of live particles (CPU) or capacity (GPU). */
  readonly active: number;
  dispose(): void;
}
