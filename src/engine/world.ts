/**
 * RenderWorld: renderer + scene + camera + lights + post + particles + quality governor.
 * Owns resize, tier switching and renderer recovery after device/context loss (SPEC §6.5, §7.2).
 */

import { color, mix, screenUV, smoothstep } from 'three/tsl';
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { createRng } from '../domain/rng/rng';
import { type Backend, createRenderer, type RendererHandle } from '../infra/render/renderer';
import { createPost, type Post } from './fx/post';
import { refreshDigitAtlas } from './numbers/number-label';
import { PALETTE } from './palette';
import { createParticles, type ParticleSystem } from './particles';
import {
  createGovernor,
  maxTier,
  type QualityGovernor,
  TIER_CONFIG,
  TIERS,
  type Tier,
} from './quality/quality';

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  forceWebGL?: boolean;
  tier?: Tier;
  lockTier?: boolean;
  onBackendChange?: (b: Backend) => void;
  onRecovered?: () => void;
  /** Rendering cannot continue at all (both backends failed): show the kid-safe error screen. */
  onFatal?: (err: unknown) => void;
  /** Called when recovery swapped the canvas element (input listeners must re-attach). */
  onCanvasReplaced?: (canvas: HTMLCanvasElement) => void;
}

export interface SkyPreset {
  top: string;
  bottom: string;
}

export const SKIES = {
  day: { top: '#9fd8ff', bottom: '#fff1d6' },
  sunset: { top: '#ffb8a8', bottom: '#ffe9b8' },
  night: { top: '#4b4f8f', bottom: '#b9a6f2' },
} as const satisfies Record<string, SkyPreset>;

export class RenderWorld {
  handle!: RendererHandle;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(40, 16 / 9, 0.1, 200);
  /** Number of renderer recoveries (debug HUD / tests). */
  recoveries = 0;
  readonly sun = new DirectionalLight('#fff4e0', 2.4);
  readonly hemi = new HemisphereLight('#dff3ff', '#f2d9b8', 1.5);
  particles!: ParticleSystem;
  governor!: QualityGovernor;
  private post!: Post;
  private resizeObs: ResizeObserver | null = null;
  private recovering = false;
  private particlesLost = false;
  /** Both backends failed; frame() is a no-op. */
  fatal = false;
  private disposed = false;
  drawCalls = 0;

  private constructor(private opts: WorldOptions) {
    this.scene.add(this.sun, this.sun.target, this.hemi);
    this.sun.position.set(6, 12, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.radius = 4;
    this.sun.shadow.bias = -0.0008;
    const s = this.sun.shadow.camera;
    s.left = -10;
    s.right = 10;
    s.top = 10;
    s.bottom = -10;
    s.near = 1;
    s.far = 40;
    this.setSky(SKIES.day);
  }

  static async create(opts: WorldOptions): Promise<RenderWorld> {
    const w = new RenderWorld(opts);
    await w.boot(opts.forceWebGL ?? false);
    return w;
  }

  get renderer(): WebGPURenderer {
    return this.handle.renderer;
  }

  get backend(): Backend {
    return this.handle.backend;
  }

  get tier(): Tier {
    return this.governor.tier;
  }

  private async boot(forceWebGL: boolean) {
    this.handle = await createRenderer({
      canvas: this.opts.canvas,
      ...(forceWebGL ? { forceWebGL: true } : {}),
      onLost: (info) => {
        console.warn('[render] lost', info);
        void this.recover(info.backend === 'webgpu');
      },
    });
    this.opts.onBackendChange?.(this.handle.backend);
    // Governor is per backend: after a WebGPU → WebGL2 fallback the tier is clamped to what WebGL2 can do.
    const prev = this.governor?.tier ?? this.opts.tier;
    const top = maxTier(this.handle.backend);
    const start = prev && TIERS.indexOf(prev) <= TIERS.indexOf(top) ? prev : top;
    this.governor = createGovernor(
      this.handle.backend,
      prev ? start : undefined,
      this.opts.lockTier ?? false,
    );
    this.applyTier();
    this.resize();
    if (!this.resizeObs && typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.resize());
      this.resizeObs.observe(this.opts.canvas);
    }
  }

  /** Rebuild after loss: WebGPU loss falls back to WebGL2. Scene graph is kept, so we return to the same screen. */
  private async recover(wasWebGPU: boolean) {
    if (this.recovering || this.disposed) return;
    this.recovering = true;
    try {
      this.post?.dispose();
      this.scene.remove(this.particles.object);
      this.particles.dispose();
      this.particlesLost = true;
      this.handle.dispose();
      // A canvas keeps its first context type forever: WebGPU → WebGL2 needs a fresh canvas element.
      const old = this.opts.canvas;
      const fresh = old.cloneNode(false) as HTMLCanvasElement;
      old.replaceWith(fresh);
      this.resizeObs?.disconnect();
      this.resizeObs = null;
      this.opts.canvas = fresh;
      this.opts.onCanvasReplaced?.(fresh);
      try {
        await this.boot(wasWebGPU || (this.opts.forceWebGL ?? false));
      } catch (err) {
        console.warn('[render] recovery failed, retrying on WebGL2', err);
        try {
          await this.boot(true);
        } catch (err2) {
          this.fatal = true;
          this.opts.onFatal?.(err2);
          return;
        }
      }
      await refreshDigitAtlas();
      // GPU resources belonged to the lost device: force every material/texture to re-upload.
      this.scene.traverse((o) => {
        const mat = (o as { material?: { dispose?: () => void; needsUpdate?: boolean } }).material;
        if (mat) {
          mat.dispose?.();
          mat.needsUpdate = true;
        }
      });
      this.opts.onRecovered?.();
      this.recoveries++;
    } finally {
      this.recovering = false;
    }
  }

  /** Test hook: simulate a context loss. */
  async simulateLoss() {
    await this.recover(this.backend === 'webgpu');
  }

  setSky(sky: SkyPreset) {
    const t = smoothstep(0.0, 1.0, screenUV.y.oneMinus());
    this.scene.backgroundNode = mix(color(new Color(sky.bottom)), color(new Color(sky.top)), t);
  }

  setTier(tier: Tier) {
    this.governor.tier = tier;
    this.applyTier();
  }

  private applyTier() {
    const cfg = TIER_CONFIG[this.governor.tier];
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, cfg.dprCap));
    this.renderer.shadowMap.enabled = cfg.shadows !== 'off';
    this.sun.shadow.radius = cfg.shadows === 'soft' ? 4 : 1;
    this.post?.dispose();
    this.post = createPost(this.renderer, this.scene, this.camera, cfg);
    const wantGpu = this.backend === 'webgpu' && cfg.gpuParticles;
    if (!this.particles || this.particlesLost || this.particles.gpu !== wantGpu) {
      if (this.particles) {
        this.scene.remove(this.particles.object);
        this.particles.dispose();
      }
      this.particles = createParticles(cfg, this.backend === 'webgpu', createRng('particles'));
      this.scene.add(this.particles.object);
      this.particlesLost = false;
    }
  }

  resize() {
    const c = this.opts.canvas;
    const w = c.clientWidth || 1;
    const h = c.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Per-frame: particles + render + quality sampling. */
  frame(dt: number, frameMs: number) {
    if (this.recovering || this.fatal) return;
    this.particles.update(Math.min(dt, 1 / 20), this.renderer);
    this.post.render();
    const info = this.renderer.info as { render?: { drawCalls?: number; calls?: number } };
    this.drawCalls = info.render?.drawCalls ?? info.render?.calls ?? 0;
    const changed = this.governor.sample(frameMs);
    if (changed) this.applyTier();
  }

  dispose() {
    this.disposed = true;
    this.resizeObs?.disconnect();
    this.post?.dispose();
    this.particles?.dispose();
    this.handle?.dispose();
  }
}

export { PALETTE };
