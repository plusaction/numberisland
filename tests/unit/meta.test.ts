import { describe, expect, it } from 'vitest';
import { BADGE_KINDS, badgeId, badgesEarned, newBadges, stageBadges } from '../../src/domain/badges';
import { BALANCE } from '../../src/domain/balance';
import {
  DECOR,
  dailyCourse,
  dailyDone,
  dayKey,
  decorOpen,
  feedFriend,
  friendStage,
  nextDecorAt,
  snacksLeft,
} from '../../src/domain/meta';
import { defaultProfile } from '../../src/domain/profile';
import { applyRoundResult } from '../../src/domain/progression/progression';
import { PLAYABLE, type RoundResult, STAGE_IDS } from '../../src/domain/stage/types';

const round = (over: Partial<RoundResult>): RoundResult =>
  ({
    stage: 'fishing',
    cleared: true,
    puzzles: 8,
    correct: 8,
    wrong: 0,
    hintsUsed: 0,
    stars: 3,
    coins: 16,
    answers: [],
    highlights: [],
    ...over,
  }) as RoundResult;

describe('[M1] 도전 배지', () => {
  it('three per stage; earned from the round, kept for good, never for an unfinished round', () => {
    expect(badgesEarned(round({ cleared: false }))).toEqual([]);
    expect(badgesEarned(round({}))).toEqual(['fishing.noHint', 'fishing.perfect']);
    expect(badgesEarned(round({ highlights: ['goldenFish'] }))).toContain('fishing.special');
    expect(badgesEarned(round({ hintsUsed: 2, wrong: 1, stars: 1 }))).toEqual([]);
    expect(badgesEarned(round({ stage: 'bomb' }))).toContain('bomb.special'); // no highlight: three stars
    expect(newBadges(['fishing.noHint'], round({}))).toEqual(['fishing.perfect']);
    for (const s of STAGE_IDS) expect(stageBadges([], s)).toHaveLength(BADGE_KINDS.length);
  });

  it('a round adds its new badges to the profile and reports them once', () => {
    const p0 = defaultProfile('p', '나', '2026-11-16T03:00:00.000Z');
    const a = applyRoundResult(p0, round({}), '2026-11-16T03:10:00.000Z', PLAYABLE, -540);
    expect(a.newBadges).toEqual(['fishing.noHint', 'fishing.perfect']);
    expect(a.profile.badges).toEqual(a.newBadges);
    const b = applyRoundResult(a.profile, round({}), '2026-11-16T03:20:00.000Z', PLAYABLE, -540);
    expect(b.newBadges).toEqual([]);
    expect(b.profile.badges).toEqual(a.profile.badges);
    expect(badgeId('race', 'special')).toBe('race.special');
  });
});

describe('[M2] 섬 꾸미기 · 괴물 친구', () => {
  it('decorations open in order as coins grow (coins are never spent)', () => {
    expect(BALANCE.decorAt.length).toBe(DECOR.length);
    expect(decorOpen(0)).toBe(0);
    expect(decorOpen(BALANCE.decorAt[0])).toBe(1);
    expect(decorOpen(1_000_000)).toBe(DECOR.length);
    expect(nextDecorAt(0)).toBe(BALANCE.decorAt[0]);
    expect(nextDecorAt(1_000_000)).toBeNull();
    for (let i = 1; i < BALANCE.decorAt.length; i++)
      expect(BALANCE.decorAt[i]).toBeGreaterThan(BALANCE.decorAt[i - 1] as number);
  });

  it('feeding uses a snack from the bag, never more than earned; the friend grows at the set marks', () => {
    let p = { economy: { coins: 0, snacks: 2 }, friendFed: 0 };
    expect(snacksLeft(p)).toBe(2);
    p = feedFriend(feedFriend(feedFriend(p)));
    expect(p.friendFed).toBe(2);
    expect(p.economy.snacks).toBe(2); // earned snacks are a record, not a wallet
    expect(snacksLeft(p)).toBe(0);
    expect(friendStage(0)).toBe(0);
    expect(friendStage(BALANCE.evolution.stage2)).toBe(1);
    expect(friendStage(BALANCE.evolution.stage3)).toBe(2);
  });
});

describe('[M3] 오늘의 모험', () => {
  it('three different stages, the same all day, different on other days', () => {
    const a = dailyCourse('2026-11-16', PLAYABLE);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
    expect(dailyCourse('2026-11-16', PLAYABLE)).toEqual(a);
    const days = new Set(
      Array.from({ length: 30 }, (_, i) =>
        dailyCourse(`2026-11-${String(i + 1).padStart(2, '0')}`, PLAYABLE).join(),
      ),
    );
    expect(days.size).toBeGreaterThan(10);
  });

  it('the local day decides (Korea is UTC+9); the stamp comes once, when the third stage is finished', () => {
    expect(dayKey('2026-11-15T16:30:00.000Z', -540)).toBe('2026-11-16');
    expect(dayKey('2026-11-15T14:30:00.000Z', -540)).toBe('2026-11-15');
    const day = '2026-11-16';
    const course = dailyCourse(day, PLAYABLE);
    let p = defaultProfile('p', '나', '2026-11-16T00:00:00.000Z');
    const stamps: boolean[] = [];
    course.forEach((stage, i) => {
      const o = applyRoundResult(p, round({ stage }), `2026-11-16T0${i + 1}:00:00.000Z`, PLAYABLE, -540);
      stamps.push(o.stamped);
      p = o.profile;
    });
    expect(stamps).toEqual([false, false, true]);
    expect(p.stamps).toEqual([day]);
    expect(dailyDone(course, p, day, -540)).toEqual([true, true, true]);
    // playing one of them again the same day does not stamp twice; the next day starts fresh
    const again = applyRoundResult(
      p,
      round({ stage: course[0] as (typeof PLAYABLE)[number] }),
      '2026-11-16T09:00:00.000Z',
      PLAYABLE,
      -540,
    );
    expect(again.stamped).toBe(false);
    expect(again.profile.stamps).toEqual([day]);
    expect(dailyDone(dailyCourse('2026-11-17', PLAYABLE), p, '2026-11-17', -540).every(Boolean)).toBe(false);
  });
});
