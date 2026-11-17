/**
 * The long game between rounds — all of it fixed-order, nothing random, nothing that can be lost (P2):
 * - island decorations open one by one as the coins ever earned pass set marks (coins are never spent);
 * - the monster friend grows when fed the snacks earned by right answers;
 * - "오늘의 모험": three stages picked by the date (same for the whole day); finishing them stamps the
 *   calendar. A missed day costs nothing and no streak is shown (no FOMO).
 */
import { BALANCE } from './balance';
import type { Profile } from './profile';
import type { StageId } from './stage/types';

export const DECOR = [
  'flags',
  'lanterns',
  'balloons',
  'bench',
  'windmill',
  'swing',
  'fountain',
  'kite',
  'lighthouse',
  'rainbow',
] as const;
export type DecorId = (typeof DECOR)[number];

/** How many decorations the coins ever earned have opened (coins only ever grow). */
export function decorOpen(coins: number): number {
  return BALANCE.decorAt.filter((mark) => coins >= mark).length;
}
/** Coins needed for the next decoration, or null when all are open. */
export function nextDecorAt(coins: number): number | null {
  return BALANCE.decorAt.find((mark) => coins < mark) ?? null;
}

/** Snacks still in the bag (earned minus fed). */
export const snacksLeft = (p: Pick<Profile, 'economy' | 'friendFed'>) =>
  Math.max(0, p.economy.snacks - p.friendFed);
/** 0 baby, 1 child, 2 grown. */
export function friendStage(fed: number): 0 | 1 | 2 {
  return fed >= BALANCE.evolution.stage3 ? 2 : fed >= BALANCE.evolution.stage2 ? 1 : 0;
}
/** Feed one snack if there is one (returns the same profile otherwise). */
export function feedFriend<P extends Pick<Profile, 'economy' | 'friendFed'>>(p: P): P {
  return snacksLeft(p) > 0 ? { ...p, friendFed: p.friendFed + 1 } : p;
}

/** Local calendar day of an ISO time ("2026-11-16"), given the device's timezone offset in minutes. */
export function dayKey(iso: string, tzOffsetMin: number): string {
  return new Date(new Date(iso).getTime() - tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const DAILY_STAGES = 3;
/**
 * Today's three stages, chosen by the date alone: the course changes every day but stays the same all day
 * (it must not shift while the child is half-way through it) and for everyone replaying that day.
 */
export function dailyCourse(day: string, playable: readonly StageId[]): StageId[] {
  const rest = [...playable];
  const course: StageId[] = [];
  let h = hash(day);
  while (course.length < Math.min(DAILY_STAGES, playable.length) && rest.length) {
    course.push(...rest.splice(h % rest.length, 1));
    h = hash(`${day}:${h}`);
  }
  return course;
}

/** Which of the course's stages were finished today. */
export function dailyDone(
  course: readonly StageId[],
  p: Pick<Profile, 'stageStats'>,
  day: string,
  tzOffsetMin: number,
): boolean[] {
  return course.map((s) => {
    const last = p.stageStats[s].lastPlayed;
    return !!last && dayKey(last, tzOffsetMin) === day;
  });
}
