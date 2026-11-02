import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import {
  type FishingAction,
  type FishingState,
  fishingRules,
  isGoldenCatch,
  solveFishing,
} from '../../src/stages/fishing/rules';

const step = (s: FishingState, tick: number, actions: FishingAction[] = []) =>
  fishingRules.step(s, { tick, actions });

function hookOne(seed: string) {
  let s = fishingRules.init(seed, 'A3');
  const pick = solveFishing(s.puzzle as NonNullable<FishingState['puzzle']>)[0] as number[];
  let tick = 0;
  s = step(
    s,
    ++tick,
    pick.map((id) => ({ t: 'tap', id })),
  );
  return { s, tick };
}

describe('[G7] 낚싯줄 감기: 정답 뒤 감아야 올라옴, 시간 제한 없음', () => {
  it('a right pair hooks the fish; it waits however long it takes, then N winds reel it in', () => {
    let { s, tick } = hookOne('reel-1');
    expect(s.phase).toBe('hook');
    expect(s.reelLeft).toBe(BALANCE.fishing.reelWinds);
    for (let i = 0; i < 3000; i++) s = step(s, ++tick); // 50 s idle: nothing lost, still hooked
    expect(s.phase).toBe('hook');
    for (let w = 0; w < BALANCE.fishing.reelWinds; w++) s = step(s, ++tick, [{ t: 'reel' }]);
    expect(s.phase).toBe('reel');
  });

  it('a tap anywhere on the pond also winds (no wrong taps while hooked)', () => {
    let { s, tick } = hookOne('reel-2');
    const wrong0 = s.core.wrong;
    s = step(s, ++tick, [{ t: 'tap', id: 999 }]);
    expect(s.reelLeft).toBe(BALANCE.fishing.reelWinds - 1);
    expect(s.core.wrong).toBe(wrong0);
  });
});

describe('[P2] 황금 물고기: 정해진 규칙(3연속 정답마다), 코인은 늘기만', () => {
  it('golden exactly on streaks 3, 6, 9 …', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(isGoldenCatch)).toEqual([false, false, true, false, false, true, true]);
  });

  it('three right pairs in a row bring up the golden fish with bonus coins; coins never go down', () => {
    let s = fishingRules.init('gold-1', 'A3');
    let tick = 0;
    let coins = s.core.coins;
    let golden = 0;
    while (s.phase !== 'done' && tick < 20_000) {
      const acts =
        s.phase === 'play' && s.puzzle
          ? (solveFishing(s.puzzle)[0] ?? []).map((id) => ({ t: 'tap' as const, id }))
          : s.phase === 'hook'
            ? [{ t: 'reel' as const }]
            : [];
      const before = s;
      s = step(s, ++tick, acts);
      expect(s.core.coins).toBeGreaterThanOrEqual(coins);
      coins = s.core.coins;
      if (before.phase === 'play' && s.phase === 'hook' && s.goldenNow) golden++;
    }
    expect(golden).toBeGreaterThanOrEqual(2);
    expect(s.goldenCaught).toBe(golden);
    expect(fishingRules.summary(s).highlights).toContain('goldenFish');
  });
});
