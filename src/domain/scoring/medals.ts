import { BALANCE } from '../balance';

export type Stars = 0 | 1 | 2 | 3;

export interface RoundTally {
  cleared: boolean;
  hintsUsed: number;
  wrong: number;
}

/** ★1 clear, ★2 hints ≤ 2, ★3 no hints & wrong ≤ 1. Time never matters (SPEC §11). */
export function starsFor(t: RoundTally): Stars {
  if (!t.cleared) return 0;
  if (t.hintsUsed === 0 && t.wrong <= BALANCE.medals.threeStarMaxWrong) return 3;
  if (t.hintsUsed <= BALANCE.medals.twoStarMaxHints) return 2;
  return 1;
}

export function coinsForAnswer(correct: boolean, hintsUsed: number): number {
  if (!correct) return 0;
  return hintsUsed === 0 ? BALANCE.coins.correctNoHint : BALANCE.coins.correct;
}

export function coinsForClear(stars: Stars, coop = false): number {
  const base = BALANCE.coins.clearByStars[stars];
  return coop ? Math.round(base * BALANCE.coins.coopMultiplier) : base;
}

export function trophiesFor(stars: Stars): number {
  return BALANCE.trophies.byStars[stars];
}
