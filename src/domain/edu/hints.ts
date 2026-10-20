/** 4-step hint plan (SPEC §9.5): visual → strategy → column steps → demo + retry with different numbers. */
import type { LevelSpec } from '../curriculum/curriculum';
import type { Rng } from '../rng/rng';
import { columnSteps, digitAt, digitCount } from './arith';
import { type Core, coreKey, generateCoreAvoiding } from './core';
import type { ColumnStep, HintStep, Op, StrategyId, WorkedExample } from './types';
import { chooseRepresentation, visualFor } from './visual';

function placeParts(n: number): number[] {
  const parts: number[] = [];
  for (let p = digitCount(n) - 1; p >= 0; p--) parts.push(digitAt(n, p) * 10 ** p);
  return parts;
}

export function strategyFor(core: Core): { strategy: StrategyId; parts: number[] } {
  const [a = 0, b = 0] = core.operands;
  const op = core.ops[0] as Op | undefined;
  switch (core.skill) {
    case 'ADD_CARRY':
    case 'ADD_NOCARRY': {
      const big = Math.max(a, b);
      const small = Math.min(a, b);
      if (core.skill === 'ADD_CARRY' && small < 10) {
        const need = 10 - (big % 10);
        return { strategy: 'MAKE_TEN', parts: [big, need, small - need] };
      }
      if (small <= 3) return { strategy: 'COUNT_ON', parts: [big, small] };
      return { strategy: 'PLACE_SPLIT', parts: [...placeParts(a), ...placeParts(b)] };
    }
    case 'SUB_BORROW':
    case 'SUB_NOBORROW': {
      if (core.skill === 'SUB_BORROW' && b < 10) {
        const ones = a % 10;
        return { strategy: 'SPLIT_SUBTRAHEND', parts: [a, ones, b - ones] };
      }
      if (b <= 3) return { strategy: 'COUNT_ON', parts: [a, -b] };
      return { strategy: 'PLACE_SPLIT', parts: [...placeParts(a), ...placeParts(b)] };
    }
    case 'COMPOSE_10':
      return { strategy: 'MAKE_TEN', parts: core.operands.slice() };
    case 'MISSING_TERM':
    case 'RELATION': {
      const mi = core.missingIndex ?? 1;
      const known = mi === 0 ? b : a;
      return { strategy: 'INVERSE_OP', parts: [core.result, known, op === '+' ? -1 : 1] };
    }
    case 'SKIP_COUNT':
      return { strategy: 'JUMP_STEP', parts: [core.target ?? 1] };
    case 'REPEATED_ADD':
      return { strategy: 'GROUP_SAME', parts: [a, core.operands.length] };
    case 'PLACE_VALUE':
      return { strategy: 'PLACE_SPLIT', parts: placeParts(core.result) };
    case 'COMPARE_EXPR':
    case 'ESTIMATE_CLOSE':
      return { strategy: 'JUMP_STEP', parts: core.items?.map((i) => i.value) ?? [] };
    case 'THREE_TERM': {
      const tenPair = core.operands.findIndex(
        (v, i) => i < core.operands.length - 1 && v + (core.operands[i + 1] ?? 0) === 10,
      );
      if (tenPair >= 0 && core.ops.every((o) => o === '+'))
        return { strategy: 'MAKE_TEN', parts: core.operands.slice() };
      return { strategy: 'PLACE_SPLIT', parts: core.operands.slice() };
    }
    case 'WORD':
      if (core.word === 'GROUPS') return { strategy: 'GROUP_SAME', parts: [a, core.operands.length] };
      return op === '+'
        ? { strategy: 'PLACE_SPLIT', parts: [...placeParts(a), ...placeParts(b)] }
        : { strategy: 'SPLIT_SUBTRAHEND', parts: [a, b] };
  }
}

/** The single two-number computation the child actually performs. */
export function coreComputation(core: Core): { a: number; b: number; op: Op } {
  const [a = 0, b = 0] = core.operands;
  const op = (core.ops[0] ?? '+') as Op;
  switch (core.form) {
    case 'MISSING':
    case 'SPLIT': {
      const mi = core.missingIndex ?? 1;
      if (mi === -1) return { a, b, op };
      if (op === '+') return { a: core.result, b: mi === 0 ? b : a, op: '-' };
      return mi === 0 ? { a: core.result, b, op: '+' } : { a, b: core.result, op: '-' };
    }
    case 'SEQUENCE': {
      const step = core.target ?? 1;
      const prevIdx = (core.missingIndex ?? 1) - 1;
      const prev = core.operands[prevIdx] ?? 0;
      return step >= 0 ? { a: prev, b: step, op: '+' } : { a: prev, b: -step, op: '-' };
    }
    case 'COMPARE':
    case 'CLOSEST': {
      const [x = 0, y = 0] = core.items?.map((i) => i.value) ?? [];
      return x >= y ? { a: x, b: y, op: '-' } : { a: y, b: x, op: '-' };
    }
    case 'PLACE':
      return { a: core.result, b: 0, op: '+' };
    default:
      return { a, b, op };
  }
}

function toExample(c: Core): WorkedExample {
  const ex: WorkedExample = { operands: c.operands, ops: c.ops, answer: c.answer, form: c.form };
  if (c.missingIndex !== undefined) ex.missingIndex = c.missingIndex;
  return ex;
}

export function buildHintPlan(
  core: Core,
  level: LevelSpec,
  rng: Rng,
  exclude: ReadonlySet<string>,
): HintStep[] {
  const representation = chooseRepresentation(level, core, rng);
  const { a, b, op } = coreComputation(core);
  const columns: ColumnStep[] = columnSteps(a, b, op);
  const avoid = new Set(exclude);
  avoid.add(coreKey(core));
  const demoCore = generateCoreAvoiding(level.id, core.skill, rng.fork('demo'), avoid) ?? core;
  avoid.add(coreKey(demoCore));
  const retryCore = generateCoreAvoiding(level.id, core.skill, rng.fork('retry'), avoid) ?? demoCore;
  return [
    { level: 1, kind: 'visual', visual: visualFor(core, representation) },
    { level: 2, kind: 'strategy', ...strategyFor(core) },
    { level: 3, kind: 'steps', columns },
    { level: 4, kind: 'demo', example: toExample(demoCore), retry: toExample(retryCore) },
  ];
}
