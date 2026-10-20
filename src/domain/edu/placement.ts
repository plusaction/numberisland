/**
 * Placement play "괴물 친구 만나기" (SPEC §9.4): 3–5 questions → start level.
 * Staircase within the term's range: correct → +2 levels, wrong → −1 level. Stops early after
 * 3 questions when the last two answers disagree (bracketed).
 */
import { levelIndex, TERM_RANGES } from '../curriculum/curriculum';
import { type AdaptiveSettings, DEFAULT_SETTINGS, stepLevel } from './adaptive';
import type { LevelId } from './types';

export interface PlacementState {
  current: LevelId;
  answers: { level: LevelId; correct: boolean }[];
  done: boolean;
  result?: LevelId;
}

export const PLACEMENT_MIN = 3;
export const PLACEMENT_MAX = 5;

export function startPlacement(settings: AdaptiveSettings = DEFAULT_SETTINGS): PlacementState {
  return { current: TERM_RANGES[settings.term].start, answers: [], done: false };
}

export function placementAnswer(
  state: PlacementState,
  correct: boolean,
  settings: AdaptiveSettings = DEFAULT_SETTINGS,
): PlacementState {
  if (state.done) return state;
  const answers = [...state.answers, { level: state.current, correct }];
  let next = state.current;
  if (correct) next = stepLevel(stepLevel(next, 1, settings), 1, settings);
  else next = stepLevel(next, -1, settings);
  const n = answers.length;
  const lastTwo = answers.slice(-2);
  const bracketed = n >= PLACEMENT_MIN && lastTwo.length === 2 && lastTwo[0]?.correct !== lastTwo[1]?.correct;
  if (n >= PLACEMENT_MAX || bracketed) {
    // Highest level answered correctly that is below every wrong answer; else the lowest asked level − 1.
    const wrongMin = Math.min(...answers.filter((a) => !a.correct).map((a) => levelIndex(a.level)), Infinity);
    const okLevels = answers.filter((a) => a.correct && levelIndex(a.level) < wrongMin).map((a) => a.level);
    let result: LevelId;
    if (okLevels.length) result = okLevels.reduce((x, y) => (levelIndex(y) > levelIndex(x) ? y : x));
    else result = stepLevel(answers[0]?.level ?? state.current, -1, settings);
    return { current: next, answers, done: true, result };
  }
  return { current: next, answers, done: false };
}
