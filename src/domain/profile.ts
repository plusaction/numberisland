/** Saved profile shape (SPEC §15) — pure types + defaults. Validation lives in infra/storage. */
import type { TermSetting } from './curriculum/curriculum';
import { type AdaptiveState, clampLevel, createAdaptiveState, DEFAULT_SETTINGS } from './edu/adaptive';
import type { LevelId, SkillId } from './edu/types';
import type { Stars } from './scoring/medals';
import { STAGE_IDS, type StageId } from './stage/types';

export const PROFILE_VERSION = 1;
export const MAX_PROFILES = 3;
export const HISTORY_LIMIT = 500;

export type KeymapPreset = 'A' | 'B';
export type QualitySetting = 'auto' | 'ultra' | 'high' | 'balanced' | 'low';

export interface Settings {
  term: TermSetting;
  challengeEnabled: boolean;
  volumes: { bgm: number; sfx: number; voice: number };
  tts: boolean;
  reducedMotion: boolean | 'system';
  highContrast: boolean | 'system';
  quality: QualitySetting;
  keymap: KeymapPreset;
  restMinutes: 0 | 10 | 15 | 20 | 30;
  dailyLimitMinutes: number; // 0 = off
  shakeIntensity: number; // 0..1
}

export interface AnswerLog {
  qid: string;
  skill: SkillId;
  level: LevelId;
  correct: boolean;
  hints: number;
  ms: number;
  given: number | null;
  answer: number;
  misconception?: string;
  at: string; // ISO time
  stage: StageId;
}

export interface StageStat {
  stars: Stars;
  plays: number;
  bestCorrect: number;
  lastPlayed?: string;
}

export interface Profile {
  id: string;
  nickname: string;
  createdAt: string;
  settings: Settings;
  adaptive: AdaptiveState;
  placementDone: boolean;
  economy: { coins: number; snacks: number };
  trophies: { total: number };
  stageStats: Record<StageId, StageStat>;
  tutorialSeen: Record<StageId, boolean>;
  history: AnswerLog[];
  dailyPlayMs: { date: string; ms: number };
  /** Skills that have had a first success (for ceremonies / "새로 해낸 것"). */
  firsts: SkillId[];
  version: number;
}

export function defaultSettings(): Settings {
  return {
    term: '1-2',
    challengeEnabled: true,
    volumes: { bgm: 0.5, sfx: 0.8, voice: 0.8 },
    tts: true,
    reducedMotion: 'system',
    highContrast: 'system',
    quality: 'auto',
    keymap: 'B',
    restMinutes: 15,
    dailyLimitMinutes: 40,
    shakeIntensity: 0.5,
  };
}

export function defaultProfile(id: string, nickname: string, now: string): Profile {
  const stageStats = Object.fromEntries(
    STAGE_IDS.map((s) => [s, { stars: 0, plays: 0, bestCorrect: 0 }]),
  ) as Record<StageId, StageStat>;
  const tutorialSeen = Object.fromEntries(STAGE_IDS.map((s) => [s, false])) as Record<StageId, boolean>;
  return {
    id,
    nickname,
    createdAt: now,
    settings: defaultSettings(),
    adaptive: createAdaptiveState('A1'),
    placementDone: false,
    economy: { coins: 0, snacks: 0 },
    trophies: { total: 0 },
    stageStats,
    tutorialSeen,
    history: [],
    dailyPlayMs: { date: now.slice(0, 10), ms: 0 },
    firsts: [],
    version: PROFILE_VERSION,
  };
}

/** Append to the history ring buffer (keeps the newest HISTORY_LIMIT). */
export function pushHistory(history: readonly AnswerLog[], entry: AnswerLog): AnswerLog[] {
  const out = [...history, entry];
  return out.length > HISTORY_LIMIT ? out.slice(out.length - HISTORY_LIMIT) : out;
}

/**
 * Keep a stored profile inside its school term (D15): a level saved before the grade-1 cap (e.g. B1)
 * is moved to the nearest allowed level. Nothing earned is touched (P2).
 */
export function fitProfileToTerm(p: Profile): Profile {
  const settings = {
    ...DEFAULT_SETTINGS,
    term: p.settings.term,
    challengeEnabled: p.settings.challengeEnabled,
  };
  const level = clampLevel(p.adaptive.level, settings);
  const best = clampLevel(p.adaptive.best, settings);
  if (level === p.adaptive.level && best === p.adaptive.best) return p;
  return { ...p, adaptive: { ...p.adaptive, level, best, recent: [], streak: 0, wrongStreak: 0 } };
}
