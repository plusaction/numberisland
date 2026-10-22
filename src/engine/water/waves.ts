/**
 * Gerstner wave sets shared by the water shader (GPU) and floating objects (CPU), so a fish or a
 * bobber sits exactly on the visible surface. Pure math — no three.js import.
 */
export interface Wave {
  /** Direction on the XZ plane (normalised in the shader and here). */
  dir: readonly [number, number];
  /** Wavelength (world units). */
  length: number;
  /** Height amplitude. */
  amp: number;
  /** 0 = sine, 1 = sharp crests (horizontal pinch). */
  steep: number;
  /** Multiplier on the deep-water phase speed (toy scale looks better slower). */
  speed: number;
}

export interface WaveParams {
  name: string;
  list: readonly Wave[];
  /** Height above which crests get foam. */
  foamAt: number;
}

/** Small pond: gentle slosh. */
export const WAVES_POND: WaveParams = {
  name: 'pond',
  foamAt: 0.05,
  list: [
    { dir: [1, 0.3], length: 3.1, amp: 0.035, steep: 0.5, speed: 0.55 },
    { dir: [-0.4, 1], length: 2.2, amp: 0.025, steep: 0.45, speed: 0.6 },
    { dir: [0.7, -0.8], length: 1.3, amp: 0.012, steep: 0.4, speed: 0.7 },
    { dir: [-1, -0.2], length: 0.8, amp: 0.006, steep: 0.3, speed: 0.8 },
  ],
};

/** Sea around the hub island: longer rolling swell. */
export const WAVES_SEA: WaveParams = {
  name: 'sea',
  foamAt: 0.1,
  list: [
    { dir: [1, 0.2], length: 7, amp: 0.09, steep: 0.55, speed: 0.45 },
    { dir: [-0.3, 1], length: 4.5, amp: 0.06, steep: 0.5, speed: 0.5 },
    { dir: [0.8, -0.7], length: 2.4, amp: 0.025, steep: 0.45, speed: 0.6 },
    { dir: [-1, -0.4], length: 1.2, amp: 0.01, steep: 0.35, speed: 0.75 },
  ],
};

/** Surface height (relative to the plane) at local (x, z) and time t — matches the shader's dy. */
export function waveHeight(params: WaveParams, x: number, z: number, t: number): number {
  let y = 0;
  for (const w of params.list) {
    const len = Math.hypot(w.dir[0], w.dir[1]) || 1;
    const k = (2 * Math.PI) / w.length;
    const c = Math.sqrt(9.8 / k) * w.speed;
    const f = k * ((w.dir[0] / len) * x + (w.dir[1] / len) * z) - t * c * k;
    y += Math.sin(f) * w.amp;
  }
  return y;
}
