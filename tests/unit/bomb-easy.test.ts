import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/domain/balance';
import { defaultProfile } from '../../src/domain/profile';
import { applyRoundResult } from '../../src/domain/progression/progression';
import { createRng } from '../../src/domain/rng/rng';
import type { RoundResult } from '../../src/domain/stage/types';
import { bombModule } from '../../src/stages/bomb/index';
import { EASY_STEPS, easyStepOk, easyStepQuestion } from '../../src/stages/bomb/rules';

describe('[D26] 폭탄 "쉽게" 5단계 사다리', () => {
  it('every step always yields its kind of question (one-digit + one-digit first)', () => {
    expect(EASY_STEPS).toBe(5);
    for (let step = 1; step <= EASY_STEPS; step++) {
      const rng = createRng(`ladder-${step}`);
      for (let i = 0; i < 200; i++) {
        const q = easyStepQuestion(step, rng);
        expect(q, `step ${step}`).not.toBeNull();
        if (!q) continue;
        expect(easyStepOk(step, q)).toBe(true);
        expect(q.ops.every((o) => o === '+')).toBe(true);
        if (step === 1) expect(q.operands.every((v) => v >= 1 && v <= 9) && q.answer <= 9).toBe(true);
        if (step === 2) expect(q.answer).toBe(10);
        if (step === 3) expect(q.answer >= 11 && q.answer <= 18).toBe(true);
        if (step === 4) expect(q.operands.some((v) => v >= 10)).toBe(true);
        if (step === 5) expect(q.operands).toHaveLength(3);
      }
    }
  });

  it('an easy round at step k serves only step-k puzzles and can be finished', () => {
    for (let step = 1; step <= EASY_STEPS; step++) {
      for (let seed = 0; seed < 6; seed++) {
        let s = bombModule.rules.init(`easy-${step}-${seed}`, 'A6', { shift: -1, easyStep: step });
        let tick = 0;
        while (s.phase !== 'done' && tick < 30_000) {
          if (s.phase === 'play' && s.core.asked) {
            const q = s.core.asked.question;
            expect(easyStepOk(step, q), `step ${step}: ${q.operands.join('+')}`).toBe(true);
            if (step !== 4) expect(s.puzzle?.wires.every((w) => w.value <= 9)).toBe(true);
          }
          const acts = s.phase === 'play' ? bombModule.solution(s) : [];
          s = bombModule.rules.step(s, { tick: ++tick, actions: acts });
        }
        expect(s.phase).toBe('done');
        expect(bombModule.rules.summary(s).easyStep).toBe(step);
      }
    }
  });

  it('a cleared easy round opens the next step; picking a lower step never lowers it (P2)', () => {
    const NOW = '2026-11-03T10:00:00.000Z';
    const round = (easyStep: number, cleared = true): RoundResult => ({
      stage: 'bomb',
      cleared,
      puzzles: 8,
      correct: 8,
      wrong: 0,
      hintsUsed: 0,
      stars: 3,
      coins: 0,
      answers: [],
      highlights: [],
      easyStep,
    });
    let p = defaultProfile('e', '해', NOW);
    expect(p.bombEasyStep).toBe(1);
    p = applyRoundResult(p, round(1), NOW, ['bomb']).profile;
    expect(p.bombEasyStep).toBe(2);
    p = applyRoundResult(p, round(4), NOW, ['bomb']).profile;
    expect(p.bombEasyStep).toBe(5);
    p = applyRoundResult(p, round(1), NOW, ['bomb']).profile;
    expect(p.bombEasyStep).toBe(5);
    p = applyRoundResult(p, round(5), NOW, ['bomb']).profile;
    expect(p.bombEasyStep).toBe(BALANCE.bombEasySteps);
    const q = applyRoundResult(defaultProfile('f', '달', NOW), round(2, false), NOW, ['bomb']).profile;
    expect(q.bombEasyStep).toBe(1);
  });
});
