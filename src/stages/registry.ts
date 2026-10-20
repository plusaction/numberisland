/** Lazy stage loading: each stage is its own chunk (SPEC §5 code split). */
import type { StageId } from '../domain/stage/types';
import type { StageModule } from './_shared/module';
import type { RoundCore } from './_shared/round';

// biome-ignore lint/suspicious/noExplicitAny: heterogenous plugin registry, typed at the call site
export type AnyStageModule = StageModule<{ phase: string; core: RoundCore } & any, any>;

export const STAGE_LOADERS: Partial<Record<StageId, () => Promise<AnyStageModule>>> = {
  fishing: () => import('./fishing/index').then((m) => m.fishingModule as AnyStageModule),
  bomb: () => import('./bomb/index').then((m) => m.bombModule as AnyStageModule),
  slime: () => import('./slime/index').then((m) => m.slimeModule as AnyStageModule),
};
