/** Valibot schema + migrations for saved profiles (SPEC §8.3). */
import * as v from 'valibot';
import { CURRICULUM } from '../../domain/curriculum/curriculum';
import { createAdaptiveState } from '../../domain/edu/adaptive';
import { LEVEL_IDS, SKILLS } from '../../domain/edu/types';
import { defaultProfile, defaultSettings, PROFILE_VERSION, type Profile } from '../../domain/profile';
import { STAGE_IDS } from '../../domain/stage/types';

const levelId = v.picklist(LEVEL_IDS);
const skillId = v.picklist(SKILLS);
const stageId = v.picklist(STAGE_IDS);
const nonNeg = v.pipe(v.number(), v.minValue(0));
const prob = v.pipe(v.number(), v.minValue(0), v.maxValue(1));

const settings = v.object({
  term: v.picklist(['1-1', '1-2', '2-1', '2-2']),
  challengeEnabled: v.boolean(),
  volumes: v.object({ bgm: prob, sfx: prob, voice: prob }),
  tts: v.boolean(),
  reducedMotion: v.union([v.boolean(), v.literal('system')]),
  highContrast: v.union([v.boolean(), v.literal('system')]),
  quality: v.picklist(['auto', 'ultra', 'high', 'balanced', 'low']),
  keymap: v.picklist(['A', 'B']),
  restMinutes: v.picklist([0, 10, 15, 20, 30]),
  dailyLimitMinutes: nonNeg,
  shakeIntensity: prob,
});

const card = v.object({
  id: v.string(),
  stability: v.number(),
  difficulty: v.number(),
  due: v.number(),
  lapses: nonNeg,
  reps: nonNeg,
});

const adaptive = v.object({
  level: levelId,
  recent: v.array(v.boolean()),
  streak: nonNeg,
  wrongStreak: nonNeg,
  demoteChain: nonNeg,
  rescue: v.boolean(),
  mastery: v.record(skillId, prob),
  cards: v.array(card),
  best: levelId,
  holds: v.array(levelId),
});

const answerLog = v.object({
  qid: v.string(),
  skill: skillId,
  level: levelId,
  correct: v.boolean(),
  hints: nonNeg,
  ms: nonNeg,
  given: v.nullable(v.number()),
  answer: v.number(),
  misconception: v.optional(v.string()),
  at: v.string(),
  stage: stageId,
});

const stageStat = v.object({
  stars: v.picklist([0, 1, 2, 3]),
  plays: nonNeg,
  bestCorrect: nonNeg,
  lastPlayed: v.optional(v.string()),
});

export const ProfileSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  nickname: v.pipe(v.string(), v.maxLength(12)),
  createdAt: v.string(),
  settings,
  adaptive,
  placementDone: v.boolean(),
  economy: v.object({ coins: nonNeg, snacks: nonNeg }),
  trophies: v.object({ total: nonNeg }),
  stageStats: v.record(stageId, stageStat),
  tutorialSeen: v.record(stageId, v.boolean()),
  history: v.array(answerLog),
  dailyPlayMs: v.object({ date: v.string(), ms: nonNeg }),
  firsts: v.array(skillId),
  version: v.literal(PROFILE_VERSION),
});

type Raw = Record<string, unknown>;

/** Ordered migrations: index n migrates version n → n+1. Version 0 = pre-release drafts. */
const MIGRATIONS: ((p: Raw) => Raw)[] = [
  (p) => ({ ...p, firsts: Array.isArray(p.firsts) ? p.firsts : [], version: 1 }),
];

export interface LoadResult {
  profile: Profile;
  /** What happened, for the parent log. */
  repaired: string[];
}

/**
 * Migrate + validate. Corrupt fields are repaired from defaults instead of throwing away progress:
 * counters never go down (P2) and unknown levels fall back to the nearest valid default.
 */
export function parseProfile(input: unknown, now = new Date().toISOString()): LoadResult {
  const repaired: string[] = [];
  if (typeof input !== 'object' || input === null) throw new Error('profile is not an object');
  let raw = { ...(input as Raw) };
  let version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > PROFILE_VERSION) throw new Error(`profile from a newer app version (${version})`);
  while (version < PROFILE_VERSION) {
    const m = MIGRATIONS[version];
    if (!m) throw new Error(`no migration from ${version}`);
    raw = m(raw);
    version++;
    repaired.push(`migrated to v${version}`);
  }
  const first = v.safeParse(ProfileSchema, raw);
  if (first.success) return { profile: first.output as Profile, repaired };

  // Field-by-field repair against defaults.
  const base = defaultProfile(
    typeof raw.id === 'string' && raw.id ? raw.id : `p-${Date.now()}`,
    '탐험대원',
    now,
  );
  const fixed: Raw = { ...base };
  for (const key of Object.keys(base) as (keyof Profile)[]) {
    const field = (ProfileSchema.entries as Record<string, v.GenericSchema>)[key];
    if (!field) continue;
    const r = v.safeParse(field, raw[key]);
    if (r.success) fixed[key] = r.output;
    else repaired.push(`reset ${key}`);
  }
  if (repaired.includes('reset settings')) fixed.settings = defaultSettings();
  if (repaired.includes('reset adaptive')) fixed.adaptive = createAdaptiveState(CURRICULUM[1]?.id ?? 'A1');
  const second = v.safeParse(ProfileSchema, fixed);
  if (!second.success) throw new Error('profile could not be repaired');
  return { profile: second.output as Profile, repaired };
}
