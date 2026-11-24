import { describe, expect, it } from 'vitest';
import { fishingModule } from '../../src/stages/fishing/index';
import type { FishingAction, FishingState } from '../../src/stages/fishing/rules';

/** The goal sentence fills in as fish are picked (user report: "숫자를 눌러도 위 칸에 안 들어가요"). */
function play(seed: string) {
  let s = fishingModule.rules.init(seed, 'A1', { step: 1 }) as FishingState;
  let tick = 0;
  while (s.phase !== 'play' && tick < 600) s = fishingModule.rules.step(s, { tick: ++tick, actions: [] });
  return { s, tick };
}
const goal = (s: FishingState) => fishingModule.hud(s).goal ?? '';

describe('[fishing] goal sentence', () => {
  it('each picked fish fills the next box; a right pair shows the whole sentence', () => {
    let checked = 0;
    for (let i = 0; i < 40; i++) {
      let { s, tick } = play(`goal-${i}`);
      const p = s.puzzle;
      if (!p) continue;
      const sol = fishingModule.solution(s) as Extract<FishingAction, { t: 'tap' }>[];
      const first = sol[0];
      if (!first) continue;
      const v1 = p.fish.find((f) => f.id === first.id)?.value as number;
      const before = goal(s);
      expect(before).toMatch(/[?□]/);
      s = fishingModule.rules.step(s, { tick: ++tick, actions: [first] });
      if (p.mode === 'missing') {
        // one pick answers □: the hooked sentence is complete
        expect(goal(s)).not.toMatch(/□/);
        expect(goal(s)).toContain(String(v1));
      } else {
        expect(goal(s)).toContain(String(v1));
        expect(goal(s).match(/\?/g)?.length).toBe(1);
        const second = sol[1];
        if (!second) continue;
        s = fishingModule.rules.step(s, { tick: ++tick, actions: [second] });
        expect(goal(s)).not.toMatch(/\?/);
        const v2 = p.fish.find((f) => f.id === second.id)?.value as number;
        if (p.mode === 'diff')
          expect(goal(s)).toContain(`${Math.max(v1, v2)} − ${Math.min(v1, v2)} = ${p.target}`);
        else expect(goal(s)).toContain(`= ${p.target}`);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('a wrong pair shows a true sentence (what the picks make), then empty boxes again', () => {
    for (let i = 0; i < 60; i++) {
      let { s, tick } = play(`wrong-${i}`);
      const p = s.puzzle;
      if (!p || p.mode === 'missing') continue;
      // two fish that do NOT make the target
      const fish = p.fish.filter((f) => !f.caught);
      let pair: [number, number] | null = null;
      for (const a of fish)
        for (const b of fish) {
          if (a.id === b.id || pair) continue;
          const made = p.mode === 'sum' ? a.value + b.value : Math.abs(a.value - b.value);
          if (made !== p.target) pair = [a.id, b.id];
        }
      if (!pair) continue;
      s = fishingModule.rules.step(s, {
        tick: ++tick,
        actions: [
          { t: 'tap', id: pair[0] },
          { t: 'tap', id: pair[1] },
        ],
      });
      expect(s.phase).toBe('bounce');
      const made = s.lastWrong?.made as number;
      expect(goal(s)).toContain(`= ${made}`);
      expect(goal(s)).not.toMatch(/\?/);
      while (s.phase === 'bounce') s = fishingModule.rules.step(s, { tick: ++tick, actions: [] });
      expect(goal(s).match(/\?/g)?.length).toBe(2);
      return;
    }
    throw new Error('no wrong pair found');
  });
});
