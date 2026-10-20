/**
 * Applying a finished round to the profile + the result screen's "새로 해낸 것" line and "다음 목표"
 * (SPEC §12, §12.2). Pure: profile in → profile out. Nothing ever decreases (P2).
 */
import { BALANCE } from '../balance';
import type { SkillId } from '../edu/types';
import { type Profile, pushHistory } from '../profile';
import { coinsForClear, type Stars, trophiesFor } from '../scoring/medals';
import type { RoundResult, StageId } from '../stage/types';

export type Achievement =
  | { kind: 'firstSkill'; skill: SkillId }
  | { kind: 'firstClear'; stage: StageId }
  | { kind: 'moreStars'; stage: StageId; stars: Stars }
  | { kind: 'fewerHints'; diff: number }
  | { kind: 'moreCorrect'; diff: number }
  | { kind: 'perfect' }
  | { kind: 'effort'; correct: number }
  | { kind: 'rankUp'; rank: number };

export type NextGoal =
  | { kind: 'rank'; have: number; need: number; rank: number }
  | { kind: 'stars'; stage: StageId; stars: Stars }
  | { kind: 'tryStage'; stage: StageId };

export function rankFor(trophies: number): number {
  let r = 0;
  BALANCE.ranks.forEach((need, i) => {
    if (trophies >= need) r = i;
  });
  return r;
}

export interface ApplyOutcome {
  profile: Profile;
  achievement: Achievement;
  next: NextGoal;
  coins: number;
  trophies: number;
  newFirsts: SkillId[];
}

/**
 * The one "새로 해낸 것" line: the most meaningful thing compared with the child's *own* past only.
 * Order: first success of a skill > first clear > more stars > rank up > perfect > fewer hints > more correct > effort.
 */
export function pickAchievement(
  before: Profile,
  result: RoundResult,
  newFirsts: SkillId[],
  rankBefore: number,
  rankAfter: number,
): Achievement {
  const prev = before.stageStats[result.stage];
  if (newFirsts[0]) return { kind: 'firstSkill', skill: newFirsts[0] };
  if (result.cleared && prev.plays === 0) return { kind: 'firstClear', stage: result.stage };
  if (result.stars > prev.stars) return { kind: 'moreStars', stage: result.stage, stars: result.stars };
  if (rankAfter > rankBefore) return { kind: 'rankUp', rank: rankAfter };
  if (result.stars === 3 && result.wrong === 0) return { kind: 'perfect' };
  const lastHints = lastRoundHints(before, result.stage);
  if (lastHints !== null && result.hintsUsed < lastHints)
    return { kind: 'fewerHints', diff: lastHints - result.hintsUsed };
  if (result.correct > prev.bestCorrect && prev.plays > 0)
    return { kind: 'moreCorrect', diff: result.correct - prev.bestCorrect };
  return { kind: 'effort', correct: result.correct };
}

function lastRoundHints(p: Profile, stage: StageId): number | null {
  const rows = p.history.filter((h) => h.stage === stage);
  if (rows.length === 0) return null;
  // last round = trailing rows with the same stage, up to one round of puzzles
  return rows.slice(-BALANCE.round.puzzles).reduce((s, h) => s + h.hints, 0);
}

export function nextGoal(p: Profile, justPlayed: StageId, playable: readonly StageId[]): NextGoal {
  const rank = rankFor(p.trophies.total);
  const nextNeed = BALANCE.ranks[rank + 1];
  const st = p.stageStats[justPlayed];
  if (st.stars < 3) return { kind: 'stars', stage: justPlayed, stars: (st.stars + 1) as Stars };
  const unplayed = playable.find((s) => p.stageStats[s].plays === 0);
  if (unplayed) return { kind: 'tryStage', stage: unplayed };
  if (nextNeed !== undefined) return { kind: 'rank', have: p.trophies.total, need: nextNeed, rank: rank + 1 };
  const lowest = playable.reduce(
    (a, b) => (p.stageStats[b].stars < p.stageStats[a].stars ? b : a),
    playable[0] as StageId,
  );
  return { kind: 'stars', stage: lowest, stars: Math.min(3, p.stageStats[lowest].stars + 1) as Stars };
}

export function applyRoundResult(
  before: Profile,
  result: RoundResult,
  nowIso: string,
  playable: readonly StageId[],
): ApplyOutcome {
  const coins = result.coins + coinsForClear(result.stars);
  const trophies = trophiesFor(result.stars);
  const rankBefore = rankFor(before.trophies.total);
  let history = before.history;
  const newFirsts: SkillId[] = [];
  const firsts = new Set(before.firsts);
  for (const a of result.answers) {
    history = pushHistory(history, {
      qid: a.questionId,
      skill: a.skill,
      level: a.level,
      correct: a.correct,
      hints: a.hintsUsed,
      ms: Math.round((a.ticks / 60) * 1000),
      given: a.given,
      answer: a.answer,
      ...(a.misconception ? { misconception: a.misconception } : {}),
      at: nowIso,
      stage: result.stage,
    });
    if (a.correct && !firsts.has(a.skill)) {
      firsts.add(a.skill);
      newFirsts.push(a.skill);
    }
  }
  const prev = before.stageStats[result.stage];
  const profile: Profile = {
    ...before,
    economy: {
      coins: before.economy.coins + coins,
      snacks: before.economy.snacks + Math.floor(result.correct / BALANCE.snacks.perCorrect),
    },
    trophies: { total: before.trophies.total + trophies },
    stageStats: {
      ...before.stageStats,
      [result.stage]: {
        stars: Math.max(prev.stars, result.stars) as Stars,
        plays: prev.plays + 1,
        bestCorrect: Math.max(prev.bestCorrect, result.correct),
        lastPlayed: nowIso,
      },
    },
    history,
    firsts: [...firsts],
    ...(result.adaptiveAfter ? { adaptive: result.adaptiveAfter } : {}),
  };
  const rankAfter = rankFor(profile.trophies.total);
  return {
    profile,
    achievement: pickAchievement(before, result, newFirsts, rankBefore, rankAfter),
    next: nextGoal(profile, result.stage, playable),
    coins,
    trophies,
    newFirsts,
  };
}

/** Weakest skill among a stage's trained skills → "오늘의 추천" ribbon. */
export function recommendedStage(
  p: Profile,
  stageSkills: Record<StageId, readonly SkillId[]>,
  playable: readonly StageId[],
): StageId {
  let best = playable[0] as StageId;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const s of playable) {
    const skills = stageSkills[s];
    const m = skills.reduce((sum, k) => sum + p.adaptive.mastery[k], 0) / Math.max(1, skills.length);
    if (m < bestScore) {
      bestScore = m;
      best = s;
    }
  }
  return best;
}

/**
 * Leaving mid-round keeps what was learned (adaptive state + answer log) but gives no clear reward.
 * Nothing decreases (P2).
 */
export function applyPartialRound(before: Profile, result: RoundResult, nowIso: string): Profile {
  let history = before.history;
  for (const a of result.answers) {
    history = pushHistory(history, {
      qid: a.questionId,
      skill: a.skill,
      level: a.level,
      correct: a.correct,
      hints: a.hintsUsed,
      ms: Math.round((a.ticks / 60) * 1000),
      given: a.given,
      answer: a.answer,
      ...(a.misconception ? { misconception: a.misconception } : {}),
      at: nowIso,
      stage: result.stage,
    });
  }
  return {
    ...before,
    history,
    economy: { ...before.economy, coins: before.economy.coins + result.coins },
    ...(result.adaptiveAfter ? { adaptive: result.adaptiveAfter } : {}),
  };
}
