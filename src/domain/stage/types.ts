/** Pure stage contracts shared by stage rules, replays and the shell (SPEC §6.4). */
import type { AdaptiveState } from '../edu/adaptive';
import type { LevelId, SkillId } from '../edu/types';
import type { Stars } from '../scoring/medals';

export const STAGE_IDS = [
  'bomb',
  'zombie',
  'fishing',
  'slime',
  'escape',
  'pizza',
  'cardbattle',
  'race',
] as const;
export type StageId = (typeof STAGE_IDS)[number];

export type StageGroup = 'block' | 'collect' | 'together';
export const STAGE_GROUP: Record<StageId, StageGroup> = {
  bomb: 'block',
  zombie: 'block',
  fishing: 'collect',
  slime: 'collect',
  escape: 'collect',
  pizza: 'together',
  cardbattle: 'together',
  race: 'together',
};
export const STAGE_PLAYERS: Record<StageId, 1 | 2 | 'both'> = {
  bomb: 1,
  zombie: 1,
  fishing: 1,
  slime: 1,
  escape: 1,
  pizza: 'both',
  cardbattle: 'both',
  race: 'both',
};
/** Implemented stages (others show "준비 중" in the hub). */
export const PLAYABLE: readonly StageId[] = ['fishing', 'bomb', 'slime'];

/** One simulation tick of semantic input (already resolved from pointer/keys/pad by the scene). */
export interface InputFrame<A> {
  tick: number;
  actions: readonly A[];
}

export interface AnswerRecord {
  questionId: string;
  level: LevelId;
  skill: SkillId;
  correct: boolean;
  hintsUsed: number;
  given: number | null;
  answer: number;
  misconception?: string;
  /** Simulation ticks from puzzle shown to this answer (fluency only, never shown to the child). */
  ticks: number;
}

export interface RoundResult {
  stage: StageId;
  cleared: boolean;
  puzzles: number;
  correct: number;
  wrong: number;
  hintsUsed: number;
  stars: Stars;
  coins: number;
  answers: AnswerRecord[];
  /** Signature/fun counters for "새로 해낸 것" lines. */
  highlights: string[];
  /** Adaptive state after the round (written back to the profile). */
  adaptiveAfter?: AdaptiveState;
}

/**
 * Pure rules contract every stage implements (P5/P6): deterministic init/step,
 * and a solver used to prove every generated puzzle is solvable (G1).
 */
export interface StageRules<S, A> {
  id: StageId;
  init(seed: number | string, level: LevelId, opts?: { puzzles?: number }): S;
  step(state: S, input: InputFrame<A>): S;
  isDone(state: S): boolean;
  summary(state: S): RoundResult;
}
