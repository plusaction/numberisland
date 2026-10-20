/**
 * Bot players (QUALITY96 §4.6): an accuracy-parameterised policy drives stage rules headlessly.
 * Stage-specific strategies live next to each stage's tests (tests/replay/*).
 */
import type { Rng } from '../../src/domain/rng/rng';

export interface BotPolicy {
  /** Probability of choosing the correct move when one is available. */
  accuracy: number;
  /** Ticks between decisions (reaction delay). */
  reactionTicks: number;
  /** Strategy label (e.g. 'greedy' vs 'careful'), interpreted per stage. */
  strategy: 'A' | 'B';
}

export const BOTS: Record<'p60' | 'p80' | 'p95', BotPolicy> = {
  // same reaction time for every bot: differences in time/stars come only from accuracy (G4)
  p60: { accuracy: 0.6, reactionTicks: 60, strategy: 'A' },
  p80: { accuracy: 0.8, reactionTicks: 60, strategy: 'A' },
  p95: { accuracy: 0.95, reactionTicks: 60, strategy: 'A' },
};

/** Pick the correct option with policy accuracy, otherwise a random wrong one. */
export function decide<T>(rng: Rng, policy: BotPolicy, correct: T[], wrong: T[]): T | null {
  if (correct.length && (wrong.length === 0 || rng.chance(policy.accuracy))) return rng.pick(correct);
  if (wrong.length) return rng.pick(wrong);
  return null;
}
