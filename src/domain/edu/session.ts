/**
 * Question session: ties the adaptive engine to the generator.
 * - Avoids the last 10 question keys.
 * - Re-asks a missed concept with different numbers within 3 questions (SPEC §9.6).
 */
import { BALANCE } from '../balance';
import type { Rng } from '../rng/rng';
import {
  type AdaptiveSettings,
  type AdaptiveState,
  chooseNext,
  DEFAULT_SETTINGS,
  type LevelEvent,
  type NextPick,
  recordAnswer,
} from './adaptive';
import { generateQuestion } from './generate';
import type { LevelId, Question, SkillId } from './types';

export interface SessionState {
  adaptive: AdaptiveState;
  recentKeys: string[];
  /** Concepts to re-ask: (level, skill, due question number). */
  retry: { level: LevelId; skill: SkillId; dueAt: number }[];
  asked: number;
}

export function createSession(adaptive: AdaptiveState): SessionState {
  return { adaptive, recentKeys: [], retry: [], asked: 0 };
}

export interface Asked {
  question: Question;
  pick: NextPick;
}

export function nextQuestion(
  s: SessionState,
  rng: Rng,
  day: number,
  settings: AdaptiveSettings = DEFAULT_SETTINGS,
  levelOverride?: LevelId,
): { session: SessionState; asked: Asked } {
  const dueRetry = s.retry.find((r) => r.dueAt <= s.asked + 1);
  let pick: NextPick;
  let retry = s.retry;
  if (dueRetry) {
    pick = { level: dueRetry.level, skill: dueRetry.skill, slot: 'review', autoHint: false };
    retry = s.retry.filter((r) => r !== dueRetry);
  } else {
    pick = chooseNext(s.adaptive, rng, day, settings);
  }
  if (levelOverride) pick = { ...pick, level: levelOverride };
  const question = generateQuestion({ level: pick.level, skill: pick.skill, rng, avoid: s.recentKeys });
  const recentKeys = [...s.recentKeys, question.key].slice(-BALANCE.sessionAvoid);
  return { session: { ...s, recentKeys, retry, asked: s.asked + 1 }, asked: { question, pick } };
}

export function answerQuestion(
  s: SessionState,
  asked: Asked,
  result: { correct: boolean; hintsUsed: number },
  day: number,
  settings: AdaptiveSettings = DEFAULT_SETTINGS,
): { session: SessionState; event: LevelEvent } {
  const { state, event } = recordAnswer(
    s.adaptive,
    {
      level: asked.question.level,
      skill: asked.question.skill,
      slot: asked.pick.slot,
      correct: result.correct,
      hintsUsed: result.hintsUsed,
      day,
    },
    settings,
  );
  let retry = s.retry;
  if (
    !result.correct &&
    !retry.some((r) => r.skill === asked.question.skill && r.level === asked.question.level)
  ) {
    retry = [
      ...retry,
      { level: asked.question.level, skill: asked.question.skill, dueAt: s.asked + BALANCE.retryWithin },
    ];
  }
  return { session: { ...s, adaptive: state, retry }, event };
}
