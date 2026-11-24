import { describe, expect, it } from 'vitest';
import { MAP_COUNT, mapsOpenAfter, missionMet } from '../../src/domain/maps';
import type { RoundResult } from '../../src/domain/stage/types';
import { bombModule } from '../../src/stages/bomb/index';
import { cardModule } from '../../src/stages/cardbattle/index';
import { escapeModule } from '../../src/stages/escape/index';
import { fishingModule } from '../../src/stages/fishing/index';
import { pizzaModule } from '../../src/stages/pizza/index';
import { raceModule } from '../../src/stages/race/index';
import { slimeModule } from '../../src/stages/slime/index';
import { zombieModule } from '../../src/stages/zombie/index';

const MODULES = [
  ['fishing', fishingModule],
  ['bomb', bombModule],
  ['slime', slimeModule],
  ['escape', escapeModule],
  ['cardbattle', cardModule],
  ['pizza', pizzaModule],
  ['race', raceModule],
  ['zombie', zombieModule],
] as const;

function playOut(mod: unknown, seed: string, step: 1 | 2 | 3): RoundResult {
  // biome-ignore lint/suspicious/noExplicitAny: heterogenous module list
  const m = mod as any;
  let s = m.rules.init(seed, 'A1', { step });
  let tick = 0;
  while (s.phase !== 'done' && tick < 30_000) {
    let acts = m.phases[s.phase]?.input ? m.solution(s) : [];
    // zombie: like a child, aim at the little one first and use its exact take-away card
    if (m === zombieModule && s.phase === 'play' && s.mini) {
      const card = (s.hand as number[]).indexOf(-s.mini.value);
      if (card >= 0)
        acts = [
          { t: 'aim', who: 1 },
          { t: 'card', id: card },
        ];
    }
    s = m.rules.step(s, { tick: ++tick, actions: acts });
  }
  return m.rules.summary(s);
}

describe('[D62] 맵 미션', () => {
  for (const [name, mod] of MODULES) {
    it(`${name}: every one of the 5 missions can be met by good play`, () => {
      const met = new Array(MAP_COUNT).fill(false);
      for (let seed = 0; seed < 24 && met.some((x) => !x); seed++) {
        const r = playOut(mod, `maps-${name}-${seed}`, ((seed % 3) + 1) as 1 | 2 | 3);
        for (let m = 0; m < MAP_COUNT; m++) if (missionMet(name, m, { ...r, map: m })) met[m] = true;
      }
      expect(met, `${name} missions reachable`).toEqual([true, true, true, true, true]);
    });
  }

  it('only the newest open map opens the next one; nothing ever closes', () => {
    const r = playOut(fishingModule, 'open-0', 1);
    expect(mapsOpenAfter(1, 'fishing', { ...r, map: 0 })).toBe(2);
    // replaying an older map changes nothing
    expect(mapsOpenAfter(3, 'fishing', { ...r, map: 0 })).toBe(3);
    // a missed mission keeps what is open
    const miss = { ...r, map: 1, correct: 0, cleared: false };
    expect(mapsOpenAfter(2, 'fishing', miss)).toBe(2);
    // never beyond five
    expect(mapsOpenAfter(5, 'fishing', { ...r, map: 4, stars: 3 })).toBe(5);
  });
});
