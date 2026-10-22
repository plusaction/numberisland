/**
 * Adaptive difficulty (SPEC §9.4).
 * - Per-skill BKT mastery.
 * - Level promotion: ≥85% of the last 8 current-level answers, or 3 in a row.
 * - Demotion: 2 wrong in a row → one level down, shown to the child only as "쉬운 코스 열렸어요".
 * - Anti-frustration: after 2 demotions without any success in between, the engine enters
 *   "rescue" (easy, already-mastered questions + auto hint) instead of dropping a third time.
 * - Mix: 60% current / 25% review / 15% challenge.
 */
import {
  CURRICULUM,
  type LevelSpec,
  levelIndex,
  levelSpec,
  TERM_RANGES,
  type TermSetting,
  termRank,
} from '../curriculum/curriculum';
import type { Rng } from '../rng/rng';
import { type BktParams, bktPredict, bktUpdate, DEFAULT_BKT } from './bkt';
import { dueCards, newCard, type ReviewCard, reviewCard } from './fsrs';
import { type LevelId, SKILLS, type SkillId } from './types';

export interface AdaptiveSettings {
  term: TermSetting;
  /** C4 선행 도전 enabled. */
  challengeEnabled: boolean;
  /** Optional manual range (parent "학습 범위 직접 지정"). */
  floor?: LevelId;
  ceiling?: LevelId;
  mix: { current: number; review: number; challenge: number };
  bkt: BktParams;
}

export const DEFAULT_SETTINGS: AdaptiveSettings = {
  term: '1-2',
  challengeEnabled: true,
  mix: { current: 0.6, review: 0.25, challenge: 0.15 },
  bkt: DEFAULT_BKT,
};

export interface AdaptiveState {
  level: LevelId;
  /** Last ≤8 results at the current level (true = correct). */
  recent: boolean[];
  streak: number;
  wrongStreak: number;
  /** Demotions since the last correct answer. */
  demoteChain: number;
  rescue: boolean;
  mastery: Record<SkillId, number>;
  cards: ReviewCard[];
  /** Highest level ever reached (for "새 코스" ceremonies). */
  best: LevelId;
  /** Levels we were demoted from (re-entry needs the 8-window rule, not a 3-streak). */
  holds: LevelId[];
}

export type Slot = 'current' | 'review' | 'challenge' | 'rescue';

export interface NextPick {
  level: LevelId;
  skill: SkillId;
  slot: Slot;
  /** Show hint step 1 automatically (rescue mode / after repeated wrongs). */
  autoHint: boolean;
}

export type LevelEvent = 'promote' | 'demote' | 'rescue' | 'none';

export function initialMastery(p: BktParams = DEFAULT_BKT): Record<SkillId, number> {
  return Object.fromEntries(SKILLS.map((s) => [s, p.pInit])) as Record<SkillId, number>;
}

export function createAdaptiveState(
  start: LevelId,
  settings: AdaptiveSettings = DEFAULT_SETTINGS,
): AdaptiveState {
  return {
    level: start,
    recent: [],
    streak: 0,
    wrongStreak: 0,
    demoteChain: 0,
    rescue: false,
    mastery: initialMastery(settings.bkt),
    cards: [],
    best: start,
    holds: [],
  };
}

export function allowedRange(settings: AdaptiveSettings): { floor: number; ceiling: number } {
  const t = TERM_RANGES[settings.term];
  return {
    floor: levelIndex(settings.floor ?? t.floor),
    ceiling: levelIndex(settings.ceiling ?? t.ceiling),
  };
}

export function isAllowed(spec: LevelSpec, settings: AdaptiveSettings): boolean {
  if (termRank(spec.term) > termRank(TERM_RANGES[settings.term].maxTerm)) return false;
  const { floor, ceiling } = allowedRange(settings);
  const i = levelIndex(spec.id);
  if (i < floor || i > ceiling) return false;
  return settings.challengeEnabled || !spec.challenge;
}

/** Nearest allowed level to `level` (prefer lower: never serve content above the child's grade). */
export function clampLevel(level: LevelId, settings: AdaptiveSettings): LevelId {
  if (isAllowed(levelSpec(level), settings)) return level;
  const i = levelIndex(level);
  for (let d = 1; d < CURRICULUM.length; d++) {
    for (const j of [i - d, i + d]) {
      const spec = CURRICULUM[j];
      if (spec && isAllowed(spec, settings)) return spec.id;
    }
  }
  return TERM_RANGES[settings.term].start;
}

/** Step to the next allowed level index in a direction, skipping disabled challenge levels. */
export function stepLevel(from: LevelId, dir: 1 | -1, settings: AdaptiveSettings): LevelId {
  const { floor, ceiling } = allowedRange(settings);
  let i = levelIndex(from) + dir;
  while (i >= floor && i <= ceiling) {
    const spec = CURRICULUM[i] as LevelSpec;
    if (isAllowed(spec, settings)) return spec.id;
    i += dir;
  }
  return from;
}

export interface AnswerInput {
  level: LevelId;
  skill: SkillId;
  slot: Slot;
  correct: boolean;
  hintsUsed: number;
  /** Local calendar day number (for review scheduling). */
  day: number;
}

export function recordAnswer(
  state: AdaptiveState,
  input: AnswerInput,
  settings: AdaptiveSettings = DEFAULT_SETTINGS,
): { state: AdaptiveState; event: LevelEvent } {
  const mastery = {
    ...state.mastery,
    [input.skill]: bktUpdate(state.mastery[input.skill], input.correct, settings.bkt),
  };
  // review card per (level, skill)
  const cardId = `${input.level}:${input.skill}`;
  const cards = state.cards.slice();
  const idx = cards.findIndex((c) => c.id === cardId);
  const rating = !input.correct ? 'again' : input.hintsUsed > 0 ? 'hard' : 'good';
  if (idx >= 0) cards[idx] = reviewCard(cards[idx] as ReviewCard, rating, input.day);
  else if (!input.correct || input.hintsUsed > 0)
    cards.push(reviewCard(newCard(cardId, input.day), rating, input.day));

  let next: AdaptiveState = { ...state, mastery, cards };
  let event: LevelEvent = 'none';

  if (input.correct) {
    next.demoteChain = 0;
    if (next.rescue) {
      next.rescue = false;
      next.wrongStreak = 0;
    }
  }

  // A miss on review content at or below the current level is also evidence the level is too high
  // (otherwise a child failing everything could be served only reviews/challenges and never demoted).
  const evidence =
    input.slot === 'current'
      ? input.level === state.level
      : input.slot === 'review' && !input.correct && levelIndex(input.level) <= levelIndex(state.level);
  if (evidence) {
    const recent = [...state.recent, input.correct].slice(-8);
    const streak = input.correct ? state.streak + 1 : 0;
    const wrongStreak = input.correct ? 0 : state.wrongStreak + 1;
    next = { ...next, recent, streak, wrongStreak };
    const rate = recent.filter(Boolean).length / recent.length;
    // 3-in-a-row only promotes when the recent window is not mostly wrong (stops lucky streaks overshooting)
    const streakOk = streak >= 3 && (recent.length < 5 || rate >= 0.7);
    const windowOk = recent.length >= 8 && rate >= 0.85;
    const up = stepLevel(state.level, 1, settings);
    // Hysteresis: re-entering a level we were just demoted from needs the 8-window rule, not a lucky streak.
    const held = state.holds.includes(up);
    if (windowOk || (streakOk && !held)) {
      if (up !== state.level) {
        event = 'promote';
        next = {
          ...next,
          level: up,
          recent: [],
          streak: 0,
          wrongStreak: 0,
          holds: state.holds.filter((h) => h !== up),
        };
        if (levelIndex(up) > levelIndex(next.best)) next.best = up;
      } else {
        next = { ...next, streak: 0 };
      }
    } else if (wrongStreak >= 2 || (recent.length >= 6 && rate < 0.5)) {
      if (next.demoteChain >= 2) {
        event = 'rescue';
        next = { ...next, rescue: true, wrongStreak: 0 };
      } else {
        const down = stepLevel(state.level, -1, settings);
        if (down !== state.level) {
          event = 'demote';
          next = {
            ...next,
            level: down,
            recent: [],
            streak: 0,
            wrongStreak: 0,
            demoteChain: next.demoteChain + 1,
            holds: state.holds.includes(state.level) ? state.holds : [...state.holds, state.level],
          };
        } else {
          event = 'rescue';
          next = { ...next, rescue: true, wrongStreak: 0 };
        }
      }
    }
  } else if (!input.correct && next.rescue === false && input.slot === 'rescue') {
    next.rescue = true;
  }
  return { state: next, event };
}

/** Choose the skill of a level whose predicted success is closest to the ZPD centre (≈0.78). */
export function zpdSkill(
  level: LevelId,
  mastery: Record<SkillId, number>,
  rng: Rng,
  p: BktParams = DEFAULT_BKT,
): SkillId {
  const skills = levelSpec(level).skills;
  const scored = skills.map((s) => ({
    s,
    d: Math.abs(bktPredict(mastery[s], p) - 0.78) + rng.float() * 0.12,
  }));
  scored.sort((x, y) => x.d - y.d);
  return (scored[0] as { s: SkillId }).s;
}

export function chooseNext(
  state: AdaptiveState,
  rng: Rng,
  day: number,
  settings: AdaptiveSettings = DEFAULT_SETTINGS,
): NextPick {
  const { floor } = allowedRange(settings);
  if (state.rescue) {
    // Easiest comfortable content: two levels down, strongest skill.
    let lvl = state.level;
    for (let i = 0; i < 2; i++) lvl = stepLevel(lvl, -1, settings);
    if (levelIndex(lvl) < floor) lvl = (CURRICULUM[floor] as LevelSpec).id;
    const skills = levelSpec(lvl).skills;
    const skill = skills.reduce(
      (best, s) => (state.mastery[s] > state.mastery[best] ? s : best),
      skills[0] as SkillId,
    );
    return { level: lvl, skill, slot: 'rescue', autoHint: true };
  }
  const roll = rng.float();
  const { mix } = settings;
  if (roll < mix.review) {
    const due = dueCards(state.cards, day).filter((c) => {
      const lvl = c.id.split(':')[0] as LevelId;
      return levelIndex(lvl) <= levelIndex(state.level) && isAllowed(levelSpec(lvl), settings);
    });
    const card = due[0];
    if (card) {
      const [lvl, skill] = card.id.split(':') as [LevelId, SkillId];
      return { level: lvl, skill, slot: 'review', autoHint: false };
    }
    // no due card: weakest skill at the current or previous level
    const prev = stepLevel(state.level, -1, settings);
    const lvl = prev;
    const skills = levelSpec(lvl).skills;
    const skill = skills.reduce(
      (w, s) => (state.mastery[s] < state.mastery[w] ? s : w),
      skills[0] as SkillId,
    );
    return { level: lvl, skill, slot: 'review', autoHint: false };
  }
  // no harder questions while the child is struggling
  if (roll < mix.review + mix.challenge && state.wrongStreak === 0) {
    const up = stepLevel(state.level, 1, settings);
    if (up !== state.level)
      return {
        level: up,
        skill: zpdSkill(up, state.mastery, rng, settings.bkt),
        slot: 'challenge',
        autoHint: false,
      };
  }
  return {
    level: state.level,
    skill: zpdSkill(state.level, state.mastery, rng, settings.bkt),
    slot: 'current',
    autoHint: state.wrongStreak >= 1,
  };
}
