/** Valibot schema + migrations for saved profiles (SPEC §8.3). */
import * as v from 'valibot';
import { LEVEL_IDS, SKILLS } from '../../domain/edu/types';
import { defaultProfile, PROFILE_VERSION, type Profile } from '../../domain/profile';
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

  // Field-level repair: keep every valid piece, replace only what is broken (P2: progress never lost).
  const base = defaultProfile(
    typeof raw.id === 'string' && raw.id ? raw.id : `p-${Date.now()}`,
    '탐험대원',
    now,
  );
  const fixed = repairEntries(
    ProfileSchema.entries as Record<string, v.GenericSchema>,
    raw,
    base as unknown as Raw,
    '',
    repaired,
  );
  const second = v.safeParse(ProfileSchema, fixed);
  if (!second.success) throw new Error('profile could not be repaired');
  return { profile: second.output as Profile, repaired };
}

type Schemaish = v.GenericSchema & {
  type?: string;
  entries?: Record<string, v.GenericSchema>;
  item?: v.GenericSchema;
  value?: v.GenericSchema;
};

/** Repair one value against its schema, recursing into objects, arrays (drop bad items) and records (per key). */
function repairValue(
  schema: v.GenericSchema,
  value: unknown,
  fallback: unknown,
  path: string,
  log: string[],
): unknown {
  const ok = v.safeParse(schema, value);
  if (ok.success) return ok.output;
  const sch = schema as Schemaish;
  if (
    sch.type === 'object' &&
    sch.entries &&
    value &&
    typeof value === 'object' &&
    fallback &&
    typeof fallback === 'object'
  ) {
    return repairEntries(sch.entries, value as Raw, fallback as Raw, `${path}.`, log);
  }
  if (sch.type === 'array' && sch.item && Array.isArray(value)) {
    const item = sch.item;
    const kept = value.filter((x) => v.safeParse(item, x).success);
    log.push(`dropped ${value.length - kept.length} bad ${path} item(s)`);
    return kept.map((x) => v.parse(item, x));
  }
  if (
    sch.type === 'record' &&
    sch.value &&
    value &&
    typeof value === 'object' &&
    fallback &&
    typeof fallback === 'object'
  ) {
    const out: Raw = { ...(fallback as Raw) };
    for (const [k, def] of Object.entries(fallback as Raw)) {
      out[k] = repairValue(sch.value, (value as Raw)[k], def, `${path}.${k}`, log);
    }
    return out;
  }
  // numbers that went negative are clamped instead of wiped
  if (typeof value === 'number' && Number.isFinite(value) && typeof fallback === 'number') {
    const clamped = Math.max(0, value);
    if (v.safeParse(schema, clamped).success) {
      log.push(`clamped ${path}`);
      return clamped;
    }
  }
  log.push(`reset ${path}`);
  return fallback;
}

function repairEntries(
  entries: Record<string, v.GenericSchema>,
  raw: Raw,
  fallback: Raw,
  prefix: string,
  log: string[],
): Raw {
  const out: Raw = { ...fallback };
  for (const [key, schema] of Object.entries(entries)) {
    out[key] = repairValue(schema, raw[key], fallback[key], `${prefix}${key}`, log);
  }
  return out;
}
