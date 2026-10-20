/**
 * Every tunable number of the game economy and pacing lives here (SPEC §12.1).
 * Values are design estimates pending playtests (see DECISIONS.md).
 */
export const BALANCE = {
  coins: {
    correct: 1,
    correctNoHint: 2,
    clearByStars: [10, 10, 20, 30] as const, // index = stars (0 → still 10 for finishing)
    coopMultiplier: 1.5,
    oddFishBonus: 3,
  },
  snacks: { perCorrect: 3 },
  evolution: { stage2: 5, stage3: 12 },
  eggs: { playsToHatch: 3 },
  trophies: { byStars: [1, 2, 3, 5] as const },
  ranks: [0, 10, 30, 60, 100, 160, 240, 350] as const,
  orbs: { festivalAt: 8 },
  medals: { twoStarMaxHints: 2, threeStarMaxWrong: 1 },
  round: { puzzles: 8 },
  rest: { defaultMinutes: 15, durationSec: 20 },
  dailyLimit: { defaultMinutes: 40 },
  praise: { noRepeatWindow: 8 },
  recentAvoid: 10,
  /** A session never repeats a question (QUALITY96 E7); remembered keys per session. */
  sessionAvoid: 100,
  /** Re-ask a missed concept with new numbers within this many questions (SPEC §9.6). */
  retryWithin: 3,
} as const;
