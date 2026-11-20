/**
 * Save files (설정 → 저장): what the child/parent sees about a save, and its file name. Pure — the bytes are
 * made and read in `infra/storage/savefile.ts`, the buttons live in the settings sheet.
 */
import type { Profile } from '../../domain/profile';
import { STAGE_IDS } from '../../domain/stage/types';

export interface SaveSummary {
  nickname: string;
  gems: number;
  stars: number;
  trophies: number;
}

export function saveSummary(p: Profile): SaveSummary {
  let stars = 0;
  for (const s of STAGE_IDS) stars += p.stageStats[s]?.stars ?? 0;
  return { nickname: p.nickname, gems: p.economy.coins, stars, trophies: p.trophies.total };
}

/**
 * `numberisland-<name>-YYYYMMDD.nisave`, ASCII only: some browsers replace a download name holding Korean with
 * plain "download". A Latin nickname is kept; a Korean one becomes `save` (the summary shows it on opening).
 */
export function saveFileName(p: Profile, now: Date): string {
  const nick = p.nickname.replace(/[^A-Za-z0-9]+/g, '').slice(0, 12) || 'save';
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `numberisland-${nick}-${d}.nisave`;
}
