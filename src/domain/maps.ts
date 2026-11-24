/**
 * Five maps per stage (D62): the same game on five places with their own look, each with a small mission.
 * Meeting the mission of the newest open map opens the next one. Pure and deterministic: missions read only
 * the round result (no luck, no clock, nothing ever closes again — P2 and the anticipation rules).
 */
import type { RoundResult, StageId } from './stage/types';

export const MAP_COUNT = 5;

/** Right answers given without a hint. */
const cleanRight = (r: RoundResult) => r.answers.filter((a) => a.correct && a.hintsUsed === 0).length;
/** Longest run of answers right on the first try (a wrong try breaks it). */
function bestRun(r: RoundResult): number {
  let run = 0;
  let best = 0;
  for (const a of r.answers) {
    run = a.correct && a.hintsUsed === 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
const stat = (r: RoundResult, k: string) => r.stats?.[k] ?? 0;
const has = (r: RoundResult, h: string) => r.highlights.includes(h);
const done = (r: RoundResult) => r.cleared;

type Check = (r: RoundResult) => boolean;

/** Mission of each map, in order (texts in ko.maps). Map 1's mission is always "play it through". */
export const MISSIONS: Record<StageId, readonly Check[]> = {
  fishing: [
    done,
    (r) => r.correct >= 6,
    (r) => cleanRight(r) >= 3,
    (r) => has(r, 'goldenFish'),
    (r) => r.stars === 3,
  ],
  bomb: [
    done,
    (r) => bestRun(r) >= 3,
    (r) => done(r) && r.hintsUsed === 0,
    (r) => done(r) && r.wrong === 0,
    (r) => r.stars === 3,
  ],
  slime: [
    done,
    (r) => stat(r, 'neat') >= 1,
    (r) => done(r) && r.hintsUsed === 0,
    (r) => stat(r, 'neat') >= 3,
    (r) => r.stars === 3,
  ],
  escape: [
    (r) => has(r, 'rescued'),
    (r) => cleanRight(r) >= 2,
    (r) => bestRun(r) >= 2,
    (r) => has(r, 'rescued') && r.hintsUsed === 0,
    (r) => r.stars === 3,
  ],
  pizza: [
    done,
    (r) => has(r, 'pizzaVip'),
    (r) => stat(r, 'served') >= 5,
    (r) => cleanRight(r) >= 3,
    (r) => r.stars === 3,
  ],
  cardbattle: [
    done,
    (r) => stat(r, 'wins') >= 2,
    (r) => stat(r, 'perfects') >= 1,
    (r) => has(r, 'cardChampion'),
    (r) => r.stars === 3,
  ],
  race: [
    done,
    (r) => stat(r, 'gems') >= 1,
    (r) => stat(r, 'turbos') >= 1,
    (r) => stat(r, 'place') <= 2,
    (r) => has(r, 'raceWin'),
  ],
  zombie: [
    done,
    (r) => has(r, 'zombieMini'),
    (r) => has(r, 'zombieNoKnock'),
    (r) => has(r, 'zombieBoss'),
    (r) => r.stars === 3,
  ],
};

export const clampMap = (m: number) => Math.max(0, Math.min(MAP_COUNT - 1, Math.floor(m)));

export function missionMet(stage: StageId, map: number, r: RoundResult): boolean {
  return MISSIONS[stage][clampMap(map)]?.(r) ?? false;
}

/**
 * Maps open after this round (1..5). Only the newest open map's mission opens the next one; replaying an
 * older map is just for fun. Never goes down.
 */
export function mapsOpenAfter(open: number, stage: StageId, r: RoundResult): number {
  const map = clampMap(r.map ?? 0);
  const now = Math.max(1, Math.min(MAP_COUNT, open));
  if (map === now - 1 && now < MAP_COUNT && missionMet(stage, map, r)) return now + 1;
  return now;
}
