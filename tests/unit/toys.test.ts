import { describe, expect, it } from 'vitest';
import { defaultProfile } from '../../src/domain/profile';
import { applyRoundResult } from '../../src/domain/progression/progression';
import type { RoundResult } from '../../src/domain/stage/types';
import { nextToy, TOY_IDS } from '../../src/domain/toys';

const NOW = '2026-11-02T10:00:00.000Z';
const round = (stage: RoundResult['stage'], cleared: boolean): RoundResult => ({
  stage,
  cleared,
  puzzles: 8,
  correct: 8,
  wrong: 0,
  hintsUsed: 0,
  stars: cleared ? 3 : 0,
  coins: 5,
  answers: [],
  highlights: [],
});

describe('[P2] 폭탄 선물상자 장난감: 정해진 순서, 줄지 않음', () => {
  it('nextToy walks the fixed list and ends with null', () => {
    expect(nextToy([])).toBe(TOY_IDS[0]);
    expect(nextToy(TOY_IDS.slice(0, 3))).toBe(TOY_IDS[3]);
    expect(nextToy(TOY_IDS)).toBeNull();
  });

  it('each cleared bomb round adds the next toy; other stages and unfinished rounds add none', () => {
    let p = defaultProfile('t', '별', NOW);
    for (let i = 0; i < TOY_IDS.length + 2; i++) {
      const before = p.toys.length;
      const out = applyRoundResult(p, round('bomb', true), NOW, ['bomb']);
      expect(out.profile.toys.length).toBeGreaterThanOrEqual(before);
      expect(out.profile.toys.slice(0, before)).toEqual(p.toys);
      if (i < TOY_IDS.length) expect(out.newToy).toBe(TOY_IDS[i]);
      else expect(out.newToy).toBeUndefined();
      p = out.profile;
    }
    expect(p.toys).toEqual([...TOY_IDS]);
    const q = defaultProfile('u', '달', NOW);
    expect(applyRoundResult(q, round('fishing', true), NOW, ['fishing']).profile.toys).toEqual([]);
    expect(applyRoundResult(q, round('bomb', false), NOW, ['bomb']).newToy).toBeUndefined();
  });
});
