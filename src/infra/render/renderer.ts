/**
 * Renderer bootstrap: WebGPU first, WebGL2 fallback (automatic or `?renderer=webgl`).
 * Handles WebGPU device loss / WebGL context loss by notifying the app, which recreates the renderer
 * (forcing WebGL2 after a WebGPU loss) and returns to the same screen (SPEC §6.5).
 */
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  PCFShadowMap,
  SRGBColorSpace,
  WebGPURenderer,
} from 'three/webgpu';
import { installWebGPUCompat } from './webgpu-compat';

export type Backend = 'webgpu' | 'webgl2';

export interface RendererHandle {
  renderer: WebGPURenderer;
  backend: Backend;
  canvas: HTMLCanvasElement;
  dispose(): void;
}

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  forceWebGL?: boolean;
  dprCap?: number;
  onLost?: (info: { backend: Backend; reason: string }) => void;
}

export function wantsForcedWebGL(search: string = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('renderer') === 'webgl';
}

/**
 * WebGPU is preferred, but a *software* WebGPU adapter (`isFallbackAdapter`, e.g. SwiftShader on machines
 * without a usable GPU driver) is much slower than hardware WebGL2 through ANGLE — pick WebGL2 then.
 */
async function webgpuIsHardware(): Promise<boolean> {
  const gpu = (globalThis.navigator as { gpu?: { requestAdapter(o?: object): Promise<unknown> } } | undefined)
    ?.gpu;
  if (!gpu) return false;
  try {
    const adapter = (await gpu.requestAdapter({ powerPreference: 'high-performance' })) as {
      info?: { isFallbackAdapter?: boolean };
      isFallbackAdapter?: boolean;
    } | null;
    if (!adapter) return false;
    return !(adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter ?? false);
  } catch {
    return false;
  }
}

export async function createRenderer(opts: RendererOptions): Promise<RendererHandle> {
  const forceWebGL = (opts.forceWebGL ?? wantsForcedWebGL()) || !(await webgpuIsHardware());
  installWebGPUCompat();
  const renderer = new WebGPURenderer({ canvas: opts.canvas, antialias: true, forceWebGL, alpha: false });
  await renderer.init();
  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
    ? 'webgpu'
    : 'webgl2';
  // Tone mapping chosen by side-by-side comparison (DECISIONS D9); `?tm=agx` keeps the alternative for review.
  const tm = new URLSearchParams(globalThis.location?.search ?? '').get('tm');
  renderer.toneMapping = tm === 'agx' ? AgXToneMapping : ACESFilmicToneMapping;
  renderer.toneMappingExposure = tm === 'agx' ? 1.05 : 0.95;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap; // soft look via shadow.radius (PCFSoft removed in r18x)
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, opts.dprCap ?? 1.5));

  let lostFired = false;
  const fireLost = (reason: string) => {
    if (lostFired) return;
    lostFired = true;
    opts.onLost?.({ backend, reason });
  };
  renderer.onDeviceLost = (info: { message?: string; reason?: string | null }) => {
    fireLost(info.reason ?? info.message ?? 'device lost');
  };
  const onCtxLost = (e: Event) => {
    e.preventDefault();
    fireLost('webglcontextlost');
  };
  opts.canvas.addEventListener('webglcontextlost', onCtxLost);

  return {
    renderer,
    backend,
    canvas: opts.canvas,
    dispose() {
      opts.canvas.removeEventListener('webglcontextlost', onCtxLost);
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
  };
}
