/**
 * The one difficulty dial (D61): three number steps chosen on the island and applied to every stage.
 * ① one-digit ± one-digit (subtraction too: 9 − 4), ② a two-digit number with a one-digit one (27 + 5,
 * 15 − 8), ③ two-digit with two-digit (38 + 24). Within a step, carrying/borrowing comes in by itself once
 * the child answers well, and goes away again after a miss — the size of the numbers never leaves the step.
 */
import type { LevelId, Question, SkillId } from './types';

export type NumberStep = 1 | 2 | 3;
export const NUMBER_STEPS: readonly NumberStep[] = [1, 2, 3];
export const DEFAULT_STEP: NumberStep = 1;

export const isStep = (v: unknown): v is NumberStep => v === 1 || v === 2 || v === 3;

const CARRY_SKILLS: readonly SkillId[] = ['ADD_CARRY', 'SUB_BORROW'];
export const isCarrySkill = (s: SkillId) => CARRY_SKILLS.includes(s);

/** One (level, skill) source of questions; `force` lets a carry skill use a level's number ranges. */
export interface StepSource {
  level: LevelId;
  skill: SkillId;
  force?: boolean;
}

/**
 * Where each step's questions come from. `easy` = no carrying (always offered); `carry` = carrying /
 * borrowing (offered once the child is on a roll). Ranges come from the curriculum table:
 * L0_1 a,b ≤ 9 · A2 one-digit + one-digit = 10..18 · A3 two-digit ± one-digit · A4/A5 two-digit ± two-digit ·
 * A6 three one-digit terms.
 */
export const STEP_SOURCES: Record<NumberStep, { easy: readonly StepSource[]; carry: readonly StepSource[] }> =
  {
    1: {
      easy: [
        { level: 'L0_1', skill: 'ADD_NOCARRY' },
        { level: 'L0_1', skill: 'SUB_NOBORROW' },
        { level: 'L0_1', skill: 'MISSING_TERM' },
        { level: 'L0_1', skill: 'COMPOSE_10' },
        { level: 'L0_1', skill: 'COMPARE_EXPR' },
        { level: 'A6', skill: 'THREE_TERM' },
      ],
      // one-digit + one-digit over ten (8 + 5); there is no one-digit borrowing
      carry: [
        { level: 'A2', skill: 'ADD_CARRY' },
        { level: 'A2', skill: 'COMPOSE_10' },
      ],
    },
    2: {
      easy: [
        { level: 'A3', skill: 'ADD_NOCARRY' },
        { level: 'A3', skill: 'SUB_NOBORROW' },
      ],
      carry: [
        { level: 'A3', skill: 'ADD_CARRY', force: true },
        { level: 'A3', skill: 'SUB_BORROW', force: true },
        { level: 'A2', skill: 'SUB_BORROW' },
      ],
    },
    3: {
      easy: [
        { level: 'A4', skill: 'ADD_NOCARRY' },
        { level: 'A4', skill: 'SUB_NOBORROW' },
        { level: 'A4', skill: 'MISSING_TERM' },
      ],
      carry: [
        { level: 'A5', skill: 'ADD_CARRY' },
        { level: 'A5', skill: 'SUB_BORROW' },
      ],
    },
  };

/** Right answers in a row before carrying joins in (a miss resets the run, so it goes away again). */
export const CARRY_AFTER_STREAK = 2;

const one = (n: number) => n >= 0 && n <= 9;
const two = (n: number) => n >= 10 && n <= 99;

/**
 * Do the numbers the child combines have this step's shape? Looks at the operands (the hidden one too) and
 * keeps every number shown within 0..99.
 */
export function fitsStep(q: Pick<Question, 'operands' | 'result' | 'answer'>, step: NumberStep): boolean {
  const ops = q.operands;
  if (ops.length < 2) return false;
  if (q.result < 0 || q.result > 99 || q.answer < 0 || q.answer > 99) return false;
  const ones = ops.filter(one).length;
  const twos = ops.filter(two).length;
  if (ones + twos !== ops.length) return false;
  if (step === 1) return twos === 0;
  if (step === 2) return twos === 1 && ones >= 1;
  return ops.length === 2 && twos === 2;
}

/** Non-number feel of a step (rival pace, opponent, how many decoys): easy / normal / lively. */
export const stepShift = (step: NumberStep): -1 | 0 | 1 => (step === 1 ? -1 : step === 2 ? 0 : 1);
