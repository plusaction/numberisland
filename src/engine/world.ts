/**
 * RenderWorld: renderer + scene + camera + lights + post + particles + quality governor.
 * Owns resize, tier switching and renderer recovery after device/context loss (SPEC §6.5, §7.2).
 */

import { color, mix, positionWorld, screenUV, smoothstep, vec3 } from 'three/tsl';
import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  type RenderTarget,
  Scene,
  SphereGeometry,
  type WebGPURenderer,
} from 'three/webgpu';
import { createRng } from '../domain/rng/rng';
import { type Backend, createRenderer, type RendererHandle } from '../infra/render/renderer';
import { createPost, type Post } from './fx/post';
import { refreshDigitAtlas } from './numbers/number-label';
import { PALETTE } from './palette';
import { createParticles, type ParticleSystem } from './particles';
import type { BurstKind, PhysicsFx } from './physics/physics';
import {
  createGovernor,
  isMobile,
  MOBILE_DPR_CAP,
  maxTier,
  type QualityGovernor,
  TIER_CONFIG,
  TIERS,
  type Tier,
} from './quality/quality';
import { invalidateSharedMaterials, lowVariant, waterTime } from './tsl/materials';

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
  readonly sun = new DirectionalLight('#fff1d8', 3.2);
  /** Ambient fill is mostly image-based now (sky environment map); the hemisphere only lifts shadows. */
  readonly hemi = new HemisphereLight('#dff3ff', '#f2d9b8', 0.45);
  private sky: SkyPreset = SKIES.day;
  private envTarget: RenderTarget | null = null;
  /** Last frame's renderer counters (debug HUD, bench, e2e budgets). */
  readonly stats = { drawCalls: 0, triangles: 0, geometries: 0, textures: 0, frameMs: 0 };
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
  /** Decorative physics, lazy-loaded (separate chunk) once a tier that allows it is running. */
  physics: PhysicsFx | null = null;
  private physicsLoading: Promise<void> | null = null;
  private ground = { y: 0, radius: 7 };

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
    this.scene.fog = new Fog('#fff1d6', 34, 95);
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
      isMobile(),
    );
    this.applyTier();
    this.bakeEnvironment();
    // warm the physics chunk in the background so the first celebration already has bodies
    globalThis.setTimeout?.(() => this.loadPhysics(), 1500);
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
      invalidateSharedMaterials();
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
    this.sky = sky;
    const t = smoothstep(0.0, 1.0, screenUV.y.oneMinus());
    this.scene.backgroundNode = mix(color(new Color(sky.bottom)), color(new Color(sky.top)), t);
    (this.scene.fog as Fog).color.set(sky.bottom);
    if (this.handle) this.bakeEnvironment();
  }

  /**
   * Image-based lighting + reflections: a tiny procedural sky (gradient dome, warm sun disc, sandy ground
   * bounce) is pre-filtered once into a PMREM cube and used as `scene.environment`. Glossy plastic, jelly
   * and water reflect it; no image files are loaded (P1). Rebaked only when the sky preset changes.
   */
  private bakeEnvironment() {
    const env = new Scene();
    const mat = new MeshBasicNodeMaterial({ side: BackSide });
    const up = smoothstep(-0.05, 0.6, positionWorld.normalize().y);
    const sky = mix(color(new Color(this.sky.bottom)), color(new Color(this.sky.top)), up);
    const ground = color(new Color('#d9c3a0')).mul(0.55);
    const horizon = smoothstep(-0.08, 0.02, positionWorld.normalize().y);
    const sunDir = vec3(this.sun.position.x, this.sun.position.y, this.sun.position.z).normalize();
    const sunDisc = smoothstep(0.995, 0.999, positionWorld.normalize().dot(sunDir)).mul(40);
    mat.colorNode = mix(ground, sky, horizon).add(vec3(1, 0.95, 0.85).mul(sunDisc));
    const dome = new Mesh(new SphereGeometry(10, 48, 24), mat);
    env.add(dome);
    const gen = new PMREMGenerator(this.renderer);
    try {
      const rt = gen.fromScene(env, 0.02, 0.1, 50);
      this.envTarget?.dispose();
      this.envTarget = rt;
      this.scene.environment = this.governor.tier === 'low' ? null : rt.texture;
      this.scene.environmentIntensity = 0.6;
    } catch (err) {
      console.warn('[render] environment bake failed; using lights only', err);
    } finally {
      gen.dispose();
      dome.geometry.dispose();
      mat.dispose();
    }
  }

  private loadPhysics(): Promise<void> {
    if (this.physicsLoading || this.disposed || !TIER_CONFIG[this.governor.tier].physics) {
      return this.physicsLoading ?? Promise.resolve();
    }
    this.physicsLoading = import('./physics/physics')
      .then(({ createPhysicsFx }) => {
        const fx = createPhysicsFx();
        if (this.disposed) {
          fx.dispose();
          return;
        }
        fx.setGround(this.ground.y, this.ground.radius);
        this.physics = fx;
        this.scene.add(fx.object);
      })
      .catch((err) => console.warn('[physics] unavailable; particles only', err));
    return this.physicsLoading;
  }

  /**
   * Physical burst (coins, candy, pebbles, drops). Returns false when physics is off for this tier, the child
   * prefers reduced motion, or the chunk is still loading — callers keep their particle effect either way.
   */
  burst(kind: BurstKind, at: { x: number; y: number; z: number }, count: number, colors?: readonly string[]) {
    if (!TIER_CONFIG[this.governor.tier].physics) return false;
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    if (!this.physics) {
      void this.loadPhysics();
      return false;
    }
    this.physics.burst(kind, at, count, colors);
    return true;
  }

  /** Scene ground for physics bodies (top height + radius of the play area). */
  setGround(y: number, radius: number) {
    this.ground = { y, radius };
    this.physics?.setGround(y, radius);
  }

  /** Called on scene changes: drop leftover bodies. */
  clearFx() {
    this.physics?.clear();
  }

  private frameNo = 0;
  /** Swap shared PBR materials ↔ flat Lambert stand-ins when entering/leaving the low tier. */
  applyMaterialTier() {
    const low = this.governor.tier === 'low';
    this.scene.environment = low ? null : (this.envTarget?.texture ?? null);
    this.scene.traverse((o) => {
      const mesh = o as { material?: unknown; userData: Record<string, unknown> };
      const mat = mesh.material as { userData: Record<string, unknown>; transparent: boolean } | undefined;
      if (!mat || Array.isArray(mat)) return;
      if (low && !mat.userData.isLow) {
        const v = lowVariant(mat);
        if (v) {
          mesh.userData.fullMaterial = mat;
          mesh.material = v;
        }
      } else if (!low && mat.userData.isLow && mesh.userData.fullMaterial) {
        mesh.material = mesh.userData.fullMaterial;
        delete mesh.userData.fullMaterial;
      }
    });
  }

  setTier(tier: Tier) {
    this.governor.tier = tier;
    this.applyTier();
  }

  private applyTier() {
    const cfg = TIER_CONFIG[this.governor.tier];
    const cap = isMobile() ? Math.min(cfg.dprCap, MOBILE_DPR_CAP) : cfg.dprCap;
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, cap));
    this.renderer.shadowMap.enabled = cfg.shadows !== 'off';
    this.sun.shadow.radius = cfg.shadows === 'soft' ? 4 : 1;
    if (this.sun.shadow.mapSize.x !== cfg.shadowMapSize) {
      this.sun.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.post?.dispose();
    this.post = createPost(this.renderer, this.scene, this.camera, cfg);
    this.applyMaterialTier();
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
    // portrait phones: widen the view so the diorama's sides are not cut off (scenes frame for landscape)
    this.camera.zoom = Math.min(1, Math.max(0.55, this.camera.aspect / 0.85));
    this.camera.updateProjectionMatrix();
  }

  /** Per-frame: particles + render + quality sampling. */
  frame(dt: number, frameMs: number) {
    if (this.recovering || this.fatal) return;
    // new objects appear during play (fish, slimes): keep the low-tier material swap current
    if (++this.frameNo % 20 === 0) this.applyMaterialTier();
    waterTime.value += Math.min(dt, 1 / 20);
    this.physics?.step(Math.min(dt, 1 / 20));
    this.particles.update(Math.min(dt, 1 / 20), this.renderer);
    this.post.render();
    const info = this.renderer.info as {
      render?: { drawCalls?: number; calls?: number; triangles?: number };
      memory?: { geometries?: number; textures?: number };
    };
    this.drawCalls = info.render?.drawCalls ?? info.render?.calls ?? 0;
    this.stats.drawCalls = this.drawCalls;
    this.stats.triangles = info.render?.triangles ?? 0;
    this.stats.geometries = info.memory?.geometries ?? 0;
    this.stats.textures = info.memory?.textures ?? 0;
    this.stats.frameMs = frameMs;
    const changed = this.governor.sample(frameMs);
    if (changed) this.applyTier();
    this.checkBackendSpeed(frameMs);
  }

  private emaMs = 16.7;
  private slowAtLowMs = 0;
  private triedWebGL = false;
  /**
   * Measured backend choice: if WebGPU is still too slow at the lowest tier (some mobile drivers), switch
   * once to WebGL2 through the recovery path (same scene, fresh canvas) and let the governor re-tier there.
   */
  private checkBackendSpeed(frameMs: number) {
    this.emaMs = this.emaMs * 0.9 + frameMs * 0.1;
    if (this.backend !== 'webgpu' || this.triedWebGL || this.governor.locked || this.tier !== 'low') {
      this.slowAtLowMs = 0;
      return;
    }
    this.slowAtLowMs = this.emaMs > 30 ? this.slowAtLowMs + frameMs : 0;
    if (this.slowAtLowMs > 4000) {
      this.triedWebGL = true;
      console.info('[render] WebGPU too slow at the lowest tier; trying WebGL2');
      void this.recover(true);
    }
  }

  dispose() {
    this.disposed = true;
    this.resizeObs?.disconnect();
    this.post?.dispose();
    this.particles?.dispose();
    this.physics?.dispose();
    this.envTarget?.dispose();
    this.handle?.dispose();
  }
}

export { PALETTE };
