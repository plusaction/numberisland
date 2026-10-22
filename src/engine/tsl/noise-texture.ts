/**
 * One shared, tileable noise texture generated in code at startup (no file, P1). Sampling it is far cheaper
 * per pixel than evaluating procedural noise in the shader (measured: the hub's frame time roughly halves in
 * software rendering), and it is created once and reused by every material.
 *   R: fine grain (period 64)   G: medium (period 16)   B: large patches (period 4)   A: cellular (caustics)
 */
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
} from 'three/webgpu';
import { createRng } from '../../domain/rng/rng';

const SIZE = 256;

function valueNoise(period: number, seed: string): Float32Array {
  const rng = createRng(seed);
  const lattice = Float32Array.from({ length: period * period }, () => rng.float());
  const out = new Float32Array(SIZE * SIZE);
  const s = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const fx = (x / SIZE) * period;
      const fy = (y / SIZE) * period;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = s(fx - x0);
      const ty = s(fy - y0);
      const at = (i: number, j: number) =>
        lattice[(((j % period) + period) % period) * period + (((i % period) + period) % period)] ?? 0;
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      out[y * SIZE + x] = a + (b - a) * ty;
    }
  }
  return out;
}

function cellular(cells: number, seed: string): Float32Array {
  const rng = createRng(seed);
  const pts = Array.from({ length: cells * cells }, () => [rng.float(), rng.float()] as const);
  const out = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const fx = (x / SIZE) * cells;
      const fy = (y / SIZE) * cells;
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      let d1 = 9;
      let d2 = 9;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = (((cx + i) % cells) + cells) % cells;
          const gy = (((cy + j) % cells) + cells) % cells;
          const p = pts[gy * cells + gx] ?? [0.5, 0.5];
          const d = Math.hypot(cx + i + p[0] - fx, cy + j + p[1] - fy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
          } else if (d < d2) d2 = d;
        }
      }
      out[y * SIZE + x] = Math.min(1, (d2 - d1) * 1.6); // bright web along cell borders → caustic lines
    }
  }
  return out;
}

let tex: DataTexture | null = null;

export function noiseTexture(): DataTexture {
  if (tex) return tex;
  const r = valueNoise(64, 'n-fine');
  const g = valueNoise(16, 'n-mid');
  const b = valueNoise(4, 'n-big');
  const a = cellular(8, 'n-cell');
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    data[i * 4] = Math.round((r[i] ?? 0) * 255);
    data[i * 4 + 1] = Math.round((g[i] ?? 0) * 255);
    data[i * 4 + 2] = Math.round((b[i] ?? 0) * 255);
    data[i * 4 + 3] = Math.round((1 - (a[i] ?? 0)) * 255);
  }
  tex = new DataTexture(data, SIZE, SIZE, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  tex.name = 'shared-noise';
  return tex;
}
