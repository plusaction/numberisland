/**
 * Praise selection (SPEC §12.2): effort/strategy praise, never repeat any of the last 8 lines.
 * Strings live in i18n; the domain only picks ids `${category}.${index}`.
 */
import { BALANCE } from '../balance';
import type { Rng } from '../rng/rng';

export type PraiseCategory = 'correct' | 'streak' | 'retrySuccess' | 'hintSuccess' | 'strategy' | 'finish';

export interface PraiseContext {
  correct: boolean;
  /** Correct after at least one wrong try on the same puzzle. */
  afterWrong: boolean;
  hintsUsed: number;
  streak: number;
  strategy?: boolean;
}

export function praiseCategory(ctx: PraiseContext): PraiseCategory {
  if (ctx.afterWrong) return 'retrySuccess';
  if (ctx.hintsUsed > 0) return 'hintSuccess';
  if (ctx.strategy) return 'strategy';
  if (ctx.streak >= 3) return 'streak';
  return 'correct';
}

export function pickPraise(
  category: PraiseCategory,
  poolSizes: Readonly<Record<PraiseCategory, number>>,
  recent: readonly string[],
  rng: Rng,
): string {
  const window = new Set(recent.slice(-BALANCE.praise.noRepeatWindow));
  const size = poolSizes[category];
  const fresh: string[] = [];
  for (let i = 0; i < size; i++) {
    const id = `${category}.${i}`;
    if (!window.has(id)) fresh.push(id);
  }
  if (fresh.length) return rng.pick(fresh);
  // Pool smaller than the window: fall back to the least-recent id.
  const order = recent.slice().reverse();
  let oldest = `${category}.0`;
  let oldestPos = -1;
  for (let i = 0; i < size; i++) {
    const id = `${category}.${i}`;
    const pos = order.indexOf(id);
    if (pos > oldestPos) {
      oldestPos = pos;
      oldest = id;
    }
  }
  return oldest;
}
