/**
 * Renderer bootstrap: WebGPU first, WebGL2 fallback (automatic or `?renderer=webgl`).
 * Handles WebGPU device loss / WebGL context loss by notifying the app, which recreates the renderer
 * (forcing WebGL2 after a WebGPU loss) and returns to the same screen (SPEC §6.5).
 */
import { AgXToneMapping, PCFSoftShadowMap, SRGBColorSpace, WebGPURenderer } from 'three/webgpu';

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

export async function createRenderer(opts: RendererOptions): Promise<RendererHandle> {
  const forceWebGL = opts.forceWebGL ?? wantsForcedWebGL();
  const renderer = new WebGPURenderer({ canvas: opts.canvas, antialias: true, forceWebGL, alpha: false });
  await renderer.init();
  const backend: Backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
    ? 'webgpu'
    : 'webgl2';
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
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
