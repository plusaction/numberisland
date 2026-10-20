/**
 * Deterministic RNG: xoshiro128** seeded via splitmix32. Pure, serialisable, forkable.
 * Same seed + same call sequence ⇒ same output on every platform (P6).
 */
export interface Rng {
  /** Uniform uint32. */
  u32(): number;
  /** Uniform float in [0, 1). */
  float(): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** Independent sub-stream derived from this stream's seed and a label (does not advance this stream). */
  fork(label: string): Rng;
  state(): RngState;
}

export type RngState = readonly [number, number, number, number];

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** FNV-1a 32-bit hash for string seeds/labels. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

export function createRng(seed: number | string | RngState): Rng {
  let s0: number;
  let s1: number;
  let s2: number;
  let s3: number;
  let baseSeed: number;
  if (Array.isArray(seed)) {
    [s0, s1, s2, s3] = seed as RngState;
    baseSeed = (s0 ^ s1 ^ s2 ^ s3) >>> 0;
  } else {
    baseSeed = typeof seed === 'string' ? hashString(seed) : (seed as number) >>> 0;
    const sm = splitmix32(baseSeed);
    s0 = sm();
    s1 = sm();
    s2 = sm();
    s3 = sm();
    if ((s0 | s1 | s2 | s3) === 0) s0 = 1;
  }

  const u32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;
    s2 = (s2 ^ t) >>> 0;
    s3 = rotl(s3, 11);
    return result;
  };
  const float = () => u32() / 4294967296;
  const int = (min: number, max: number) => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`rng.int invalid range [${min}, ${max}]`);
    }
    return min + Math.floor(float() * (max - min + 1));
  };
  const rng: Rng = {
    u32,
    float,
    int,
    chance: (p) => float() < p,
    pick: (items) => {
      if (items.length === 0) throw new RangeError('rng.pick on empty list');
      return items[int(0, items.length - 1)] as (typeof items)[number];
    },
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        const tmp = out[i] as (typeof out)[number];
        out[i] = out[j] as (typeof out)[number];
        out[j] = tmp;
      }
      return out;
    },
    fork: (label) => createRng((baseSeed ^ hashString(label)) >>> 0),
    state: () => [s0, s1, s2, s3] as const,
  };
  return rng;
}
