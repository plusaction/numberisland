/** Bayesian Knowledge Tracing (SPEC §9.4). */
export interface BktParams {
  pInit: number;
  pLearn: number;
  pSlip: number;
  pGuess: number;
}

export const DEFAULT_BKT: BktParams = { pInit: 0.3, pLearn: 0.15, pSlip: 0.1, pGuess: 0.2 };

/** Probability the child knows the skill. */
export type Mastery = number;

export function bktUpdate(pKnow: Mastery, correct: boolean, p: BktParams = DEFAULT_BKT): Mastery {
  const posterior = correct
    ? (pKnow * (1 - p.pSlip)) / (pKnow * (1 - p.pSlip) + (1 - pKnow) * p.pGuess)
    : (pKnow * p.pSlip) / (pKnow * p.pSlip + (1 - pKnow) * (1 - p.pGuess));
  const next = posterior + (1 - posterior) * p.pLearn;
  return Math.min(0.999, Math.max(0.001, next));
}

/** Predicted probability of answering correctly. */
export function bktPredict(pKnow: Mastery, p: BktParams = DEFAULT_BKT): number {
  return pKnow * (1 - p.pSlip) + (1 - pKnow) * p.pGuess;
}
