/**
 * Per-stage map setup (D62): applies the map's mood (sky, sun, fog), owns its living things, and puts the
 * island's mood back when the stage ends. Scenes call `env.update(dt)` every frame and `env.dispose()`.
 */
import type { Group } from 'three/webgpu';
import { clampMap } from '../../domain/maps';
import { Life } from '../../engine/life/life';
import type { Mood, RenderWorld } from '../../engine/world';
import type { StageCtx } from './module';

export interface StageMapEnv {
  /** Map index 0–4. */
  map: number;
  life: Life;
  update(dt: number): void;
  dispose(): void;
}

export function startStageMap(
  world: RenderWorld,
  root: Group,
  ctx: StageCtx,
  moods: readonly Mood[],
): StageMapEnv {
  const map = clampMap(ctx.map ?? 0);
  const mood = moods[map];
  if (mood) world.setMood(mood);
  const life = new Life({ low: world.tier === 'low', calm: ctx.reducedMotion });
  root.add(life.group);
  return {
    map,
    life,
    update: (dt) => life.update(dt),
    dispose: () => world.clearMood(),
  };
}
