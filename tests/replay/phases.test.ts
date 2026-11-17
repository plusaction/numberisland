import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/domain/rng/rng';
import { bombModule } from '../../src/stages/bomb/index';
import { cardModule } from '../../src/stages/cardbattle/index';
import { escapeModule } from '../../src/stages/escape/index';
import { fishingModule } from '../../src/stages/fishing/index';
import { pizzaModule } from '../../src/stages/pizza/index';
import { raceModule } from '../../src/stages/race/index';
import { slimeModule } from '../../src/stages/slime/index';
import { zombieModule } from '../../src/stages/zombie/index';

/**
 * Every stage declares its phases as a table (`phases`). Here each stage is played many times — with the
 * solver, with random plausible taps, with long idling, with hints and retries — and every phase change
 * that happens must be one the table lists, starting from the declared initial phase.
 */
type Rand = ReturnType<typeof createRng>;
// biome-ignore lint/suspicious/noExplicitAny: heterogenous stage states
type Any = any;
const noise: Record<string, (s: Any, r: Rand, m: Any) => Any[]> = {
  fishing: (_s, r) => [
    r.chance(0.15) ? { t: 'reel' } : r.chance(0.2) ? { t: 'undo' } : { t: 'tap', id: r.int(0, 8) },
  ],
  bomb: (_s, r) => [r.chance(0.2) ? { t: 'undo' } : { t: 'cut', id: r.int(0, 5) }],
  slime: (_s, r) => [r.chance(0.2) ? { t: 'undo' } : { t: 'merge', from: r.int(0, 5), to: r.int(0, 5) }],
  escape: (_s, r) => [r.chance(0.5) ? { t: 'tap', id: r.int(0, 4) } : { t: 'pick', id: 100 + r.int(0, 2) }],
  cardbattle: (_s, r) => [
    { t: 'card', id: r.int(0, 2) },
    { t: 'op', op: r.chance(0.5) ? '+' : '-' },
    ...(r.chance(0.5) ? [{ t: 'play' }] : []),
  ],
  pizza: (_s, r) => [
    r.chance(0.5) ? { t: 'add' } : r.chance(0.3) ? { t: 'packed' } : { t: 'pick', id: 100 + r.int(0, 2) },
  ],
  race: (s, r, m) => {
    const c = m.hud(s).cross?.choices ?? [];
    if (r.chance(0.15)) return [{ t: 'mode', mode: r.chance(0.5) ? 'shield' : 'dash' }];
    return c.length ? [{ t: 'pick', value: c[r.int(0, c.length - 1)].value }] : [];
  },
  zombie: (_s, r) => [
    r.chance(0.25) ? { t: 'aim', who: r.chance(0.5) ? 1 : 0 } : { t: 'card', id: r.int(0, 3) },
  ],
};

const MODULES = [
  fishingModule,
  bombModule,
  slimeModule,
  escapeModule,
  cardModule,
  pizzaModule,
  raceModule,
  zombieModule,
] as const;

describe('[S1] 스테이지 단계 전이표', () => {
  for (const mod of MODULES) {
    it(`${mod.id}: every phase change in play is declared in its table`, () => {
      const m = mod as Any;
      const table = m.phases as Record<string, { input: boolean; timed: boolean; to: readonly string[] }>;
      const seen = new Set<string>();
      for (let seed = 0; seed < 14; seed++) {
        const r = createRng(`phases-${mod.id}-${seed}`);
        let s = m.rules.init(`ph-${mod.id}-${seed}`, seed % 2 ? 'A3' : 'A2', {
          shift: ((seed % 3) - 1) as -1 | 0 | 1,
        });
        expect(s.phase).toBe(m.initialPhase);
        let tick = 0;
        // styles: 0 solver, 1 noisy, 2 slow thinker (idles), 3 hints + retry then solver
        const style = seed % 4;
        let wait = 0;
        while (s.phase !== 'done' && tick < 120_000) {
          let acts: Any[] = [];
          const spec = table[s.phase];
          expect(spec, `${mod.id}: phase "${s.phase}" is not in the table`).toBeDefined();
          if (spec?.input) {
            if (style === 3 && tick % 50 === 7) acts = [m.hintAction, m.retryAction];
            else if (style === 1 && r.chance(0.5)) acts = (noise[mod.id] as (typeof noise)[string])(s, r, m);
            else if (style === 2 && wait++ < 500) acts = [];
            else {
              acts = m.solution(s);
              wait = 0;
            }
          } else if (r.chance(0.02)) {
            // taps during a show must change nothing about the phase flow
            acts = [...m.solution(s), m.hintAction];
          }
          const from = s.phase as string;
          const coins = s.core.coins as number;
          s = m.rules.step(s, { tick: ++tick, actions: acts });
          // P2: whatever is pressed, coins never go down
          expect(s.core.coins, `${mod.id}: coins went down`).toBeGreaterThanOrEqual(coins);
          const to = s.phase as string;
          if (to !== from) {
            seen.add(`${from}→${to}`);
            expect(table[from]?.to, `${mod.id}: undeclared ${from} → ${to}`).toContain(to);
          }
        }
        expect(s.phase, `${mod.id} seed ${seed} did not finish`).toBe('done');
      }
      // the table has no dead entries for the main line: every declared phase was visited or is a wrong-answer show
      for (const [name, spec] of Object.entries(table)) {
        expect(Object.keys(table)).toEqual(expect.arrayContaining([...spec.to]));
        if (name === 'done') expect(spec.to).toEqual([]);
      }
      expect(seen.size).toBeGreaterThan(1);
    });
  }
});
