import { describe, expect, it } from 'vitest';
import { fitsStep, type NumberStep } from '../../src/domain/edu/steps';
import { bombModule } from '../../src/stages/bomb/index';
import { cardModule } from '../../src/stages/cardbattle/index';
import { escapeModule } from '../../src/stages/escape/index';
import { fishingModule } from '../../src/stages/fishing/index';
import { pizzaModule } from '../../src/stages/pizza/index';
import { raceModule } from '../../src/stages/race/index';
import { slimeModule } from '../../src/stages/slime/index';
import { zombieModule } from '../../src/stages/zombie/index';

/** D61: the island's number step decides the shape of every number the child combines, in every stage. */
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

type Q = { operands: number[]; result: number; answer: number; skill: string; ops: string[] };

/** Play rounds by the solution, collecting every question asked (first try right = carrying can join in). */
function play(mod: unknown, step: NumberStep, seed: number, start = 'A1') {
  // biome-ignore lint/suspicious/noExplicitAny: heterogenous module list
  const m = mod as any;
  let s = m.rules.init(`step-${step}-${seed}`, start, { step });
  const asked: Q[] = [];
  let tick = 0;
  let last = '';
  while (s.phase !== 'done' && tick < 30_000) {
    const q = s.core.asked?.question as Q | undefined;
    const id = q ? `${s.core.index}:${q.operands.join(',')}:${q.ops.join('')}` : '';
    if (q && id !== last) {
      asked.push(q);
      last = id;
    }
    const acts = m.phases[s.phase]?.input ? m.solution(s) : [];
    s = m.rules.step(s, { tick: ++tick, actions: acts });
  }
  expect(s.phase).toBe('done');
  return asked;
}

for (const [name, mod] of MODULES) {
  describe(`[D61:${name}] 숫자 단계 ①②③`, () => {
    for (const step of [1, 2, 3] as const) {
      it(`step ${step}: every question has the step's shape, whatever the saved level`, () => {
        let carried = 0;
        let total = 0;
        for (let seed = 0; seed < 10; seed++) {
          for (const start of ['L0_1', 'A1', 'A4', 'A6']) {
            for (const q of play(mod, step, seed, start)) {
              total++;
              expect(fitsStep(q, step), `${name} ${start}/${seed}: ${q.operands.join(` ${q.ops[0]} `)}`).toBe(
                true,
              );
              if (step === 1) expect(Math.max(...q.operands)).toBeLessThan(10);
              if (q.skill === 'ADD_CARRY' || q.skill === 'SUB_BORROW') carried++;
            }
          }
        }
        expect(total).toBeGreaterThan(0);
        // carrying joins in for a child who keeps answering right (not in step 1 subtraction-only stages)
        if (!(step === 1 && name === 'zombie'))
          expect(carried, `${name} step ${step} carries`).toBeGreaterThan(0);
      });
    }
  });
}
