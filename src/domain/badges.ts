/**
 * Challenge badges: three per stage, earned from a finished round and kept for good (P2: a badge is never
 * taken away, and missing one costs nothing). They give a child who already has three stars a reason to
 * play again — "can I do it without a hint?" — without any timer or lucky draw.
 */
import type { RoundResult, StageId } from './stage/types';

export type BadgeKind = 'noHint' | 'perfect' | 'special';
export const BADGE_KINDS: readonly BadgeKind[] = ['noHint', 'perfect', 'special'];
export const badgeId = (stage: StageId, kind: BadgeKind) => `${stage}.${kind}`;

/** The stage's own challenge: a highlight the round must contain (or three stars where there is none). */
const SPECIAL: Record<StageId, string | null> = {
  bomb: null,
  zombie: 'zombieNoKnock',
  fishing: 'goldenFish',
  slime: 'slimeNeat',
  escape: 'rescued',
  pizza: 'pizzaVip',
  cardbattle: 'cardPerfect',
  race: 'raceWin',
};

/** Badges this round deserves (whether or not they are already owned). */
export function badgesEarned(r: RoundResult): string[] {
  if (!r.cleared) return [];
  const out: string[] = [];
  if (r.hintsUsed === 0) out.push(badgeId(r.stage, 'noHint'));
  if (r.wrong === 0) out.push(badgeId(r.stage, 'perfect'));
  const special = SPECIAL[r.stage];
  if (special ? r.highlights.includes(special) : r.stars === 3) out.push(badgeId(r.stage, 'special'));
  return out;
}

/** Only the ones not owned yet, in a stable order. */
export function newBadges(owned: readonly string[], r: RoundResult): string[] {
  return badgesEarned(r).filter((b) => !owned.includes(b));
}

export const stageBadges = (owned: readonly string[], stage: StageId) =>
  BADGE_KINDS.map((kind) => ({
    kind,
    id: badgeId(stage, kind),
    owned: owned.includes(badgeId(stage, kind)),
  }));
