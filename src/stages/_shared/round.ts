/**
 * Shared, pure round bookkeeping for every stage (P5/P6): adaptive question choice, answer log, hints,
 * coins, medals. Stages embed `RoundCore` in their state and call these helpers from `step`.
 */
import { BALANCE } from '../../domain/balance';
import { type CarryPolicy, CURRICULUM, levelIndex, levelSpec } from '../../domain/curriculum/curriculum';
import type { AdaptiveState } from '../../domain/edu/adaptive';
import { generateQuestion } from '../../domain/edu/generate';
import {
  type Asked,
  answerQuestion,
  createSession,
  nextQuestion,
  type SessionState,
} from '../../domain/edu/session';
import type { LevelId, Question, SkillId } from '../../domain/edu/types';
import { createRng, type Rng, type RngState } from '../../domain/rng/rng';
import { coinsForAnswer, starsFor } from '../../domain/scoring/medals';
import type { AnswerRecord, RoundResult, StageId } from '../../domain/stage/types';

export interface RoundOptions {
  puzzles?: number;
  /** -1 easier / 0 auto / +1 harder (hub difficulty selector). */
  shift?: -1 | 0 | 1;
  /** Local calendar day (review scheduling). */
  day?: number;
  adaptive?: AdaptiveState;
}

export interface RoundCore {
  stage: StageId;
  tick: number;
  rng: RngState;
  session: SessionState;
  shift: -1 | 0 | 1;
  day: number;
  puzzles: number;
  index: number;
  asked: Asked | null;
  puzzleHints: number;
  puzzleWrong: number;
  puzzleStart: number;
  answers: AnswerRecord[];
  hintsUsed: number;
  wrong: number;
  correct: number;
  coins: number;
  streak: number;
  highlights: string[];
  done: boolean;
}

export function initRound(
  stage: StageId,
  seed: number | string,
  start: LevelId,
  opts: RoundOptions = {},
): RoundCore {
  const rng = createRng(`${stage}:${seed}`);
  const adaptive = opts.adaptive ?? { ...emptyAdaptive(start) };
  return {
    stage,
    tick: 0,
    rng: rng.state(),
    session: createSession({ ...adaptive, level: adaptive.level ?? start }),
    shift: opts.shift ?? 0,
    day: opts.day ?? 0,
    puzzles: opts.puzzles ?? BALANCE.round.puzzles,
    index: 0,
    asked: null,
    puzzleHints: 0,
    puzzleWrong: 0,
    puzzleStart: 0,
    answers: [],
    hintsUsed: 0,
    wrong: 0,
    correct: 0,
    coins: 0,
    streak: 0,
    highlights: [],
    done: false,
  };
}

import { createAdaptiveState } from '../../domain/edu/adaptive';

function emptyAdaptive(start: LevelId): AdaptiveState {
  return createAdaptiveState(start);
}

/** Run `fn` with a live Rng restored from the core, then store the advanced state back. */
export function withRng<T>(core: RoundCore, fn: (rng: Rng) => T): { core: RoundCore; value: T } {
  const rng = createRng(core.rng);
  const value = fn(rng);
  return { core: { ...core, rng: rng.state() }, value };
}

/** Is a level usable for a stage that needs these skills (some arithmetic spec present)? */
function levelFits(level: LevelId, usable: readonly SkillId[]): boolean {
  return levelSpec(level).skills.some((s) => usable.includes(s));
}

/** Nearest level in the same band (prefer the next one up, then down) that has a usable skill. */
export function stageLevel(level: LevelId, usable: readonly SkillId[], shift: -1 | 0 | 1): LevelId {
  const i = Math.max(0, Math.min(CURRICULUM.length - 1, levelIndex(level) + shift));
  const base = CURRICULUM[i]?.id ?? level;
  if (levelFits(base, usable)) return base;
  const band = levelSpec(base).band;
  for (let d = 1; d < CURRICULUM.length; d++) {
    for (const j of [i + d, i - d]) {
      const l = CURRICULUM[j];
      if (l && (l.band === band || band === '0') && levelFits(l.id, usable)) return l.id;
    }
  }
  return 'A2';
}

/**
 * Pick the next question for a stage: the adaptive engine chooses level/skill, then the stage keeps only
 * skills it can stage (e.g. fishing needs + / − / □). Returns the question and the session bookkeeping.
 */
export function nextStageQuestion(
  core: RoundCore,
  usable: readonly SkillId[],
  prefer?: (q: Question) => boolean,
): RoundCore {
  return withRng(core, (rng) => {
    const r = nextQuestion(core.session, rng, core.day);
    let { question } = r.asked;
    const pick = r.asked.pick;
    const level = stageLevel(question.level, usable, core.shift);
    const skills = levelSpec(level).skills.filter((s) => usable.includes(s));
    if (level !== question.level || !usable.includes(question.skill) || (prefer && !prefer(question))) {
      const skill = skills.includes(pick.skill) ? pick.skill : rng.pick(skills);
      for (let i = 0; i < 20; i++) {
        question = generateQuestion({ level, skill, rng, avoid: r.session.recentKeys });
        if (!prefer || prefer(question)) break;
      }
    }
    return {
      ...core,
      session: r.session,
      asked: { question, pick: { ...pick, level: question.level, skill: question.skill } },
      puzzleHints: 0,
      puzzleWrong: 0,
      puzzleStart: core.tick,
    };
  }).value;
}

/** Record a puzzle attempt. Wrong attempts never cost anything (P2); only the first try counts for mastery. */
export function recordAttempt(
  core: RoundCore,
  correct: boolean,
  given: number | null,
  misconception?: string,
): RoundCore {
  const asked = core.asked;
  if (!asked) return core;
  const q = asked.question;
  if (!correct) {
    const first = core.puzzleWrong === 0;
    let session = core.session;
    if (first)
      session = answerQuestion(
        session,
        asked,
        { correct: false, hintsUsed: core.puzzleHints },
        core.day,
      ).session;
    const rec: AnswerRecord = {
      questionId: q.id,
      level: q.level,
      skill: q.skill,
      correct: false,
      hintsUsed: core.puzzleHints,
      given,
      answer: q.answer,
      ticks: core.tick - core.puzzleStart,
      ...(misconception ? { misconception } : {}),
    };
    return {
      ...core,
      session,
      puzzleWrong: core.puzzleWrong + 1,
      wrong: core.wrong + 1,
      streak: 0,
      answers: first ? [...core.answers, rec] : core.answers,
    };
  }
  let session = core.session;
  let answers = core.answers;
  if (core.puzzleWrong === 0) {
    session = answerQuestion(
      session,
      asked,
      { correct: true, hintsUsed: core.puzzleHints },
      core.day,
    ).session;
    answers = [
      ...answers,
      {
        questionId: q.id,
        level: q.level,
        skill: q.skill,
        correct: true,
        hintsUsed: core.puzzleHints,
        given,
        answer: q.answer,
        ticks: core.tick - core.puzzleStart,
      },
    ];
  }
  const streak = core.streak + 1;
  const highlights = [...core.highlights];
  if (q.tags.includes('SIX_SEVEN')) highlights.push('sixSeven');
  return {
    ...core,
    session,
    answers,
    correct: core.correct + 1,
    coins: core.coins + coinsForAnswer(true, core.puzzleHints),
    streak,
    highlights,
  };
}

export function takeHint(core: RoundCore): RoundCore {
  if (!core.asked || core.puzzleHints >= 4) return core;
  return { ...core, puzzleHints: core.puzzleHints + 1, hintsUsed: core.hintsUsed + 1 };
}

/** Advance to the next puzzle index; marks done after the last one. */
export function advancePuzzle(core: RoundCore): RoundCore {
  const index = core.index + 1;
  return { ...core, index, asked: null, done: index >= core.puzzles };
}

export function roundSummary(core: RoundCore): RoundResult {
  const cleared = core.index >= core.puzzles;
  const stars = starsFor({ cleared, hintsUsed: core.hintsUsed, wrong: core.wrong });
  return {
    stage: core.stage,
    cleared,
    puzzles: core.puzzles,
    correct: core.correct,
    wrong: core.wrong,
    hintsUsed: core.hintsUsed,
    stars,
    coins: core.coins,
    answers: core.answers,
    highlights: core.highlights,
    adaptiveAfter: core.session.adaptive,
  };
}

/** Band of the current puzzle's level ('0' counts as A for staging). */
export function bandOf(level: LevelId): 'A' | 'B' | 'C' {
  const b = levelSpec(level).band;
  return b === '0' ? 'A' : b;
}

export type { CarryPolicy };
