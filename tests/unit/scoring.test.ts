import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import { createRng } from '../../src/domain/rng/rng';
import { coinsForAnswer, coinsForClear, starsFor } from '../../src/domain/scoring/medals';
import { pickPraise, praiseCategory } from '../../src/domain/scoring/praise';
import { ko, PRAISE_POOL_SIZES } from '../../src/i18n/ko';

describe('medals', () => {
  it('★ rules: time never matters', () => {
    expect(starsFor({ cleared: true, hintsUsed: 0, wrong: 1 })).toBe(3);
    expect(starsFor({ cleared: true, hintsUsed: 0, wrong: 2 })).toBe(2);
    expect(starsFor({ cleared: true, hintsUsed: 2, wrong: 9 })).toBe(2);
    expect(starsFor({ cleared: true, hintsUsed: 3, wrong: 0 })).toBe(1);
    expect(starsFor({ cleared: false, hintsUsed: 0, wrong: 0 })).toBe(0);
  });
  it('P2: rewards are never negative', () => {
    expect(coinsForAnswer(false, 3)).toBe(0);
    expect(coinsForAnswer(true, 0)).toBe(BALANCE.coins.correctNoHint);
    for (const s of [0, 1, 2, 3] as const) expect(coinsForClear(s)).toBeGreaterThan(0);
  });
});

describe('[A4] 칭찬 시스템', () => {
  it('every praise pool has ≥8 lines so the 8-window never forces a repeat', () => {
    for (const [cat, list] of Object.entries(ko.praise)) expect(list.length, cat).toBeGreaterThanOrEqual(8);
  });

  it('≥40 praise lines', () => {
    const total = Object.values(ko.praise).reduce((n, list) => n + list.length, 0);
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it('never repeats any of the last 8 lines (1000 picks, mixed categories)', () => {
    const rng = createRng('praise');
    const history: string[] = [];
    const cats = ['correct', 'streak', 'retrySuccess', 'hintSuccess', 'strategy', 'finish'] as const;
    for (let i = 0; i < 1000; i++) {
      const id = pickPraise(rng.pick(cats), PRAISE_POOL_SIZES, history, rng);
      expect(history.slice(-8)).not.toContain(id);
      history.push(id);
    }
  });

  it('hint use and retries get their own praise category', () => {
    expect(praiseCategory({ correct: true, afterWrong: true, hintsUsed: 0, streak: 0 })).toBe('retrySuccess');
    expect(praiseCategory({ correct: true, afterWrong: false, hintsUsed: 2, streak: 0 })).toBe('hintSuccess');
  });

  it('lint: no praise or UI line shames hint use or mistakes', () => {
    const banned = [/힌트\s*(없이|안\s*쓰)/, /틀렸/, /실패/, /못\s*했/, /바보/, /겨우/, /또\s*틀/, /벌/];
    const lines = [...Object.values(ko.praise).flat(), ...Object.values(ko.levelEvents)];
    for (const line of lines) for (const re of banned) expect(re.test(line), `${line} ~ ${re}`).toBe(false);
  });

  it('P4: praise lines are short (≤12 chars)', () => {
    for (const line of Object.values(ko.praise).flat()) expect(line.length, line).toBeLessThanOrEqual(12);
  });
});
