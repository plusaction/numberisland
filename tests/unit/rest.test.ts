import { describe, expect, it } from 'vitest';
import { restDue } from '../../src/domain/rest';

describe('[W1] 쉬는 시간 알림', () => {
  it('is due only after the chosen minutes, and never when switched off', () => {
    expect(restDue(14 * 60_000, 0, 15)).toBe(false);
    expect(restDue(15 * 60_000, 0, 15)).toBe(true);
    expect(restDue(40 * 60_000, 30 * 60_000, 15)).toBe(false);
    expect(restDue(10 * 3_600_000, 0, 0)).toBe(false);
  });
});
