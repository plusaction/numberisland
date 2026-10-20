/**
 * Question cores: per-skill number generation + self-verification (SPEC §9.3).
 * Every number produced is an integer in [0, level.max] and every answer is verified by `evaluate`.
 */
import { type ArithSpec, type LevelSpec, levelSpec, type Range } from '../curriculum/curriculum';
import type { Rng } from '../rng/rng';
import { digitAt, evaluate, hasBorrow, hasCarry, partials } from './arith';
import type { CompareItem, LevelId, Op, QuestionForm, SkillId, WordTemplate, WorkedExample } from './types';

export interface Core {
  skill: SkillId;
  form: QuestionForm;
  operands: number[];
  ops: Op[];
  answer: number;
  /** Value of the expression as displayed. */
  result: number;
  missingIndex?: number;
  target?: number;
  word?: WordTemplate;
  wordNoun?: number;
  given?: WorkedExample;
  items?: CompareItem[];
}

export const WORD_NOUN_COUNT = 12;

export class GenerationError extends Error {}

function sample(rng: Rng, [lo, hi]: Range, multipleOf = 1): number {
  const min = Math.ceil(lo / multipleOf);
  const max = Math.floor(hi / multipleOf);
  return rng.int(min, max) * multipleOf;
}

type CarryWant = boolean | null;

function genAdd(rng: Rng, spec: ArithSpec, carry: CarryWant): [number, number] | null {
  for (let i = 0; i < 400; i++) {
    const a = sample(rng, spec.a, spec.multipleOf);
    const b = sample(rng, spec.b, spec.multipleOf);
    const r = a + b;
    if (r < spec.minResult || r > spec.maxResult) continue;
    if (carry !== null && hasCarry(a, b) !== carry) continue;
    return [a, b];
  }
  return null;
}

function genSub(rng: Rng, spec: ArithSpec, borrow: CarryWant): [number, number] | null {
  for (let i = 0; i < 400; i++) {
    const a = sample(rng, spec.a, spec.multipleOf);
    const b = sample(rng, spec.b, spec.multipleOf);
    if (b > a) continue;
    const r = a - b;
    if (r < spec.minResult || r > spec.maxResult) continue;
    if (borrow !== null && hasBorrow(a, b) !== borrow) continue;
    return [a, b];
  }
  return null;
}

function carryForPolicy(rng: Rng, level: LevelSpec): CarryWant {
  if (level.carry === 'none') return false;
  if (level.carry === 'always') return true;
  return rng.chance(0.5);
}

/** A two-operand fact honouring the level's carry policy (used by MISSING/WORD/RELATION/CLOSEST). */
function genFact(rng: Rng, level: LevelSpec, opWanted?: Op): { a: number; b: number; op: Op } | null {
  const ops: Op[] = [];
  if (level.add) ops.push('+');
  if (level.sub) ops.push('-');
  if (ops.length === 0) return null;
  const op = opWanted && ops.includes(opWanted) ? opWanted : rng.pick(ops);
  const want = carryForPolicy(rng, level);
  const pair =
    op === '+'
      ? (genAdd(rng, level.add as ArithSpec, want) ?? genAdd(rng, level.add as ArithSpec, null))
      : (genSub(rng, level.sub as ArithSpec, want) ?? genSub(rng, level.sub as ArithSpec, null));
  if (!pair) return null;
  return { a: pair[0], b: pair[1], op };
}

function expr(skill: SkillId, operands: number[], ops: Op[]): Core {
  const value = evaluate(operands, ops);
  return { skill, form: 'EXPR', operands, ops, answer: value, result: value };
}

function genArith(rng: Rng, level: LevelSpec, skill: SkillId): Core | null {
  switch (skill) {
    case 'ADD_NOCARRY':
    case 'ADD_CARRY': {
      if (!level.add) return null;
      const pair = genAdd(rng, level.add, skill === 'ADD_CARRY');
      if (!pair) return null;
      let [a, b] = pair;
      // Commutative variety: occasionally show the smaller number first (8 + 47).
      if (rng.chance(0.2) && a !== b) [a, b] = [b, a];
      return expr(skill, [a, b], ['+']);
    }
    case 'SUB_NOBORROW':
    case 'SUB_BORROW': {
      if (!level.sub) return null;
      const pair = genSub(rng, level.sub, skill === 'SUB_BORROW');
      if (!pair) return null;
      return expr(skill, [pair[0], pair[1]], ['-']);
    }
    default:
      return null;
  }
}

function genMissing(rng: Rng, level: LevelSpec): Core | null {
  const fact = genFact(rng, level);
  if (!fact) return null;
  const { a, b, op } = fact;
  const result = op === '+' ? a + b : a - b;
  const missingIndex = rng.chance(0.5) ? 0 : 1;
  const answer = missingIndex === 0 ? a : b;
  return {
    skill: 'MISSING_TERM',
    form: 'MISSING',
    operands: [a, b],
    ops: [op],
    answer,
    result,
    missingIndex,
  };
}

function genRelation(rng: Rng, level: LevelSpec): Core | null {
  const fact = genFact(rng, level, '+');
  if (!fact) return null;
  const { a, b } = fact;
  const c = a + b;
  const given: WorkedExample = { operands: [a, b], ops: ['+'], answer: c, form: 'EXPR' };
  if (rng.chance(0.5)) {
    // 8 + 5 = 13 → 13 − 5 = □
    const subtrahend = rng.chance(0.5) ? b : a;
    const answer = c - subtrahend;
    return {
      skill: 'RELATION',
      form: 'MISSING',
      operands: [c, subtrahend],
      ops: ['-'],
      answer,
      result: answer,
      missingIndex: -1,
      given,
    };
  }
  // 8 + 5 = 13 → 13 − □ = 8
  return {
    skill: 'RELATION',
    form: 'MISSING',
    operands: [c, b],
    ops: ['-'],
    answer: b,
    result: a,
    missingIndex: 1,
    given,
  };
}

function genCompose(rng: Rng, level: LevelSpec): Core | null {
  if (level.max <= 9) {
    // 가르기 (c = a + □) or 모으기 (a 와 b 를 모으면 □)
    const c = rng.int(2, 9);
    const a = rng.int(1, c - 1);
    if (rng.chance(0.6)) {
      return {
        skill: 'COMPOSE_10',
        form: 'SPLIT',
        operands: [a, c - a],
        ops: ['+'],
        answer: c - a,
        result: c,
        missingIndex: 1,
      };
    }
    return {
      skill: 'COMPOSE_10',
      form: 'SPLIT',
      operands: [a, c - a],
      ops: ['+'],
      answer: c,
      result: c,
      missingIndex: -1,
    };
  }
  if (rng.chance(0.4)) {
    // 10 = a + □
    const a = rng.int(1, 9);
    return {
      skill: 'COMPOSE_10',
      form: 'SPLIT',
      operands: [a, 10 - a],
      ops: ['+'],
      answer: 10 - a,
      result: 10,
      missingIndex: 1,
    };
  }
  // 10 만들기 세 수: 7 + 3 + 5 or 4 + 8 + 2 (two of them make ten)
  const x = rng.int(1, 9);
  const y = 10 - x;
  const z = rng.int(1, 9);
  const order = rng.int(0, 2);
  const operands = order === 0 ? [x, y, z] : order === 1 ? [z, x, y] : [x, z, y];
  return expr('COMPOSE_10', operands, ['+', '+']);
}

function genCompare(rng: Rng, level: LevelSpec): Core | null {
  const items: CompareItem[] = [];
  const num = (v: number): CompareItem => ({ operands: [v], ops: [], value: v });
  if (level.placeDigits && level.placeDigits >= 2) {
    const d = level.placeDigits;
    const lo = 10 ** (d - 1);
    const hi = 10 ** d - 1;
    const x = rng.int(lo, hi);
    let y: number;
    if (rng.chance(0.35)) {
      // trap: swap two digits (47 vs 74) — tests place value, not "bigger last digit"
      const s = String(x).split('');
      const i = rng.int(0, s.length - 2);
      const t = s[i] as string;
      s[i] = s[i + 1] as string;
      s[i + 1] = t;
      y = Number(s.join(''));
      if (y < lo || y === x) y = x === hi ? x - 1 : x + 1;
    } else if (rng.chance(0.5)) {
      y = rng.int(lo, hi);
    } else {
      // differs only in one place
      const place = rng.int(0, d - 1);
      const digit = digitAt(x, place);
      const nd = (digit + rng.int(1, 9)) % 10;
      y = x + (nd - digit) * 10 ** place;
      if (y < lo || y > hi) y = x === hi ? x - 1 : x + 1;
    }
    if (y === x) return null;
    items.push(num(x), num(y));
  } else {
    // expressions vs number (within the level's small range)
    const fact = genFact(rng, level);
    if (!fact) return null;
    const v = fact.op === '+' ? fact.a + fact.b : fact.a - fact.b;
    const exprItem: CompareItem = { operands: [fact.a, fact.b], ops: [fact.op], value: v };
    const maxOther = level.max;
    let other = rng.int(Math.max(0, v - 3), Math.min(maxOther, v + 3));
    if (other === v) other = v + 1 <= maxOther ? v + 1 : v - 1;
    if (other < 0 || other === v) return null;
    if (rng.chance(0.5)) items.push(exprItem, num(other));
    else items.push(num(other), exprItem);
  }
  const [p, q] = items as [CompareItem, CompareItem];
  const answer = Math.max(p.value, q.value);
  return {
    skill: 'COMPARE_EXPR',
    form: 'COMPARE',
    operands: [p.value, q.value],
    ops: [],
    answer,
    result: answer,
    items,
  };
}

function genClosest(rng: Rng, level: LevelSpec): Core | null {
  for (let tries = 0; tries < 50; tries++) {
    const f1 = genFact(rng, level);
    const f2 = genFact(rng, level);
    if (!f1 || !f2) return null;
    const v1 = f1.op === '+' ? f1.a + f1.b : f1.a - f1.b;
    const v2 = f2.op === '+' ? f2.a + f2.b : f2.a - f2.b;
    if (v1 === v2) continue;
    const lo = Math.min(v1, v2);
    const hi = Math.max(v1, v2);
    const target = rng.int(Math.max(0, lo - 10), Math.min(level.max, hi + 10));
    const d1 = Math.abs(v1 - target);
    const d2 = Math.abs(v2 - target);
    if (d1 === d2) continue;
    const items: CompareItem[] = [
      { operands: [f1.a, f1.b], ops: [f1.op], value: v1 },
      { operands: [f2.a, f2.b], ops: [f2.op], value: v2 },
    ];
    const answer = d1 < d2 ? v1 : v2;
    return {
      skill: 'ESTIMATE_CLOSE',
      form: 'CLOSEST',
      operands: [v1, v2],
      ops: [],
      answer,
      result: answer,
      target,
      items,
    };
  }
  return null;
}

function genPlace(rng: Rng, level: LevelSpec): Core | null {
  const d = level.placeDigits ?? 2;
  const n = rng.int(10 ** (d - 1), 10 ** d - 1);
  if (rng.chance(0.6)) {
    // build: 4 tens + 7 ones = □ ; parts high place first
    const parts: number[] = [];
    for (let p = d - 1; p >= 0; p--) parts.push(digitAt(n, p) * 10 ** p);
    return {
      skill: 'PLACE_VALUE',
      form: 'PLACE',
      operands: parts,
      ops: parts.slice(1).map(() => '+' as Op),
      answer: n,
      result: n,
    };
  }
  // read one digit: which digit sits in the tens place of 3482?
  const place = rng.int(0, d - 1);
  const digit = digitAt(n, place);
  return {
    skill: 'PLACE_VALUE',
    form: 'PLACE',
    operands: [n],
    ops: [],
    answer: digit,
    result: n,
    target: place,
  };
}

function genSequence(rng: Rng, level: LevelSpec): Core | null {
  const steps = level.skipSteps ?? [1, 10];
  const step = rng.pick(steps);
  const len = 5;
  const span = step * (len - 1);
  const max = level.max;
  if (span > max) return null;
  const small = step < 10 && max >= 100; // 곱셈구구 연계 (2~9씩)
  const ascending = small ? true : rng.chance(0.75);
  const startMax = max - span;
  const start = small
    ? step * rng.int(0, 5)
    : sample(rng, [0, startMax], step >= 10 ? Math.min(step, 10) : 1);
  const seq: number[] = [];
  for (let i = 0; i < len; i++) seq.push(ascending ? start + i * step : start + span - i * step);
  if (seq.some((v) => v < 0 || v > max)) return null;
  const missingIndex = rng.int(1, len - 1);
  return {
    skill: 'SKIP_COUNT',
    form: 'SEQUENCE',
    operands: seq,
    ops: [],
    answer: seq[missingIndex] as number,
    result: seq[missingIndex] as number,
    missingIndex,
    target: ascending ? step : -step,
  };
}

function genThree(rng: Rng, level: LevelSpec): Core | null {
  const three = level.three;
  if (!three) return null;
  for (let tries = 0; tries < 300; tries++) {
    const operands = [sample(rng, three.term), sample(rng, three.term), sample(rng, three.term)];
    const ops: Op[] = [rng.chance(0.55) ? '+' : '-', rng.chance(0.5) ? '+' : '-'];
    const parts = partials(operands, ops);
    if (parts.some((v) => v < 0 || v > three.max)) continue;
    if (operands.some((v) => v > three.max)) continue;
    return expr('THREE_TERM', operands, ops);
  }
  return null;
}

function genRepeated(rng: Rng, level: LevelSpec): Core | null {
  const rep = level.repeated;
  if (!rep) return null;
  const base = sample(rng, rep.base);
  const count = sample(rng, rep.count);
  const operands = Array.from({ length: count }, () => base);
  return expr(
    'REPEATED_ADD',
    operands,
    operands.slice(1).map(() => '+' as Op),
  );
}

function genWord(rng: Rng, level: LevelSpec): Core | null {
  const wordNoun = rng.int(0, WORD_NOUN_COUNT - 1);
  if (level.repeated && rng.chance(0.35)) {
    const r = genRepeated(rng, level);
    if (!r) return null;
    return { ...r, skill: 'WORD', form: 'WORD', word: 'GROUPS', wordNoun };
  }
  const fact = genFact(rng, level);
  if (!fact) return null;
  const { a, b, op } = fact;
  const value = op === '+' ? a + b : a - b;
  const word: WordTemplate = op === '+' ? 'JOIN' : rng.chance(0.6) ? 'TAKE' : 'COMPARE_MORE';
  return {
    skill: 'WORD',
    form: 'WORD',
    operands: [a, b],
    ops: [op],
    answer: value,
    result: value,
    word,
    wordNoun,
  };
}

export function generateCore(levelId: LevelId, skill: SkillId, rng: Rng): Core | null {
  const level = levelSpec(levelId);
  switch (skill) {
    case 'ADD_NOCARRY':
    case 'ADD_CARRY':
    case 'SUB_NOBORROW':
    case 'SUB_BORROW':
      return genArith(rng, level, skill);
    case 'MISSING_TERM':
      return genMissing(rng, level);
    case 'RELATION':
      return genRelation(rng, level);
    case 'COMPOSE_10':
      return genCompose(rng, level);
    case 'COMPARE_EXPR':
      return genCompare(rng, level);
    case 'ESTIMATE_CLOSE':
      return genClosest(rng, level);
    case 'PLACE_VALUE':
      return genPlace(rng, level);
    case 'SKIP_COUNT':
      return genSequence(rng, level);
    case 'THREE_TERM':
      return genThree(rng, level);
    case 'REPEATED_ADD':
      return genRepeated(rng, level);
    case 'WORD':
      return genWord(rng, level);
  }
}

export function coreKey(c: Core): string {
  return [
    c.skill,
    c.form,
    c.operands.join(','),
    c.ops.join(''),
    c.missingIndex ?? '',
    c.target ?? '',
    c.word ?? '',
    c.given ? c.given.operands.join(',') : '',
  ].join('|');
}

/** Self-check: recompute the answer from scratch. Throws on any inconsistency. */
export function verifyCore(c: Core, level: LevelSpec): void {
  const fail = (msg: string) => {
    throw new GenerationError(`${level.id} ${coreKey(c)}: ${msg}`);
  };
  const nums = [
    ...c.operands,
    c.answer,
    c.result,
    ...(c.target !== undefined && c.form === 'CLOSEST' ? [c.target] : []),
  ];
  if (nums.some((v) => !Number.isInteger(v) || v < 0)) fail('negative or non-integer');
  if (nums.some((v) => v > level.max)) fail('exceeds level max');
  switch (c.form) {
    case 'EXPR':
    case 'WORD': {
      const parts = partials(c.operands, c.ops);
      if (parts.some((v) => v < 0)) fail('negative partial');
      if (evaluate(c.operands, c.ops) !== c.answer) fail('wrong answer');
      break;
    }
    case 'MISSING':
    case 'SPLIT': {
      const mi = c.missingIndex;
      if (mi === undefined) fail('missing index');
      if (mi === -1) {
        if (evaluate(c.operands, c.ops) !== c.answer) fail('wrong result answer');
      } else {
        if (c.operands[mi as number] !== c.answer) fail('missing operand mismatch');
        if (evaluate(c.operands, c.ops) !== c.result) fail('shown result mismatch');
      }
      break;
    }
    case 'COMPARE': {
      const items = c.items ?? [];
      if (items.length !== 2) fail('compare needs 2 items');
      for (const it of items) if (evaluate(it.operands, it.ops) !== it.value) fail('item value');
      if (items[0]?.value === items[1]?.value) fail('tie');
      if (Math.max(...items.map((i) => i.value)) !== c.answer) fail('compare answer');
      break;
    }
    case 'CLOSEST': {
      const items = c.items ?? [];
      const t = c.target as number;
      const [d1, d2] = items.map((i) => Math.abs(i.value - t)) as [number, number];
      if (d1 === d2) fail('closest tie');
      if ((d1 < d2 ? items[0]?.value : items[1]?.value) !== c.answer) fail('closest answer');
      break;
    }
    case 'SEQUENCE': {
      const step = c.target as number;
      for (let i = 1; i < c.operands.length; i++) {
        if ((c.operands[i] as number) - (c.operands[i - 1] as number) !== step) fail('sequence step');
      }
      if (c.operands[c.missingIndex as number] !== c.answer) fail('sequence answer');
      break;
    }
    case 'PLACE': {
      if (c.target === undefined) {
        if (evaluate(c.operands, c.ops) !== c.answer) fail('place build');
      } else if (digitAt(c.operands[0] as number, c.target) !== c.answer) fail('place digit');
      break;
    }
  }
  if (c.skill === 'ADD_CARRY' && !hasCarry(c.operands[0] as number, c.operands[1] as number))
    fail('no carry');
  if (c.skill === 'ADD_NOCARRY' && hasCarry(c.operands[0] as number, c.operands[1] as number)) fail('carry');
  if (c.skill === 'SUB_BORROW' && !hasBorrow(c.operands[0] as number, c.operands[1] as number))
    fail('no borrow');
  if (c.skill === 'SUB_NOBORROW' && hasBorrow(c.operands[0] as number, c.operands[1] as number))
    fail('borrow');
}

/** Generate a core with retries, avoiding the given keys. */
export function generateCoreAvoiding(
  levelId: LevelId,
  skill: SkillId,
  rng: Rng,
  avoid: ReadonlySet<string>,
  attempts = 60,
): Core | null {
  const level = levelSpec(levelId);
  let fallback: Core | null = null;
  for (let i = 0; i < attempts; i++) {
    const c = generateCore(levelId, skill, rng);
    if (!c) continue;
    verifyCore(c, level);
    if (!avoid.has(coreKey(c))) return c;
    fallback ??= c;
  }
  return fallback;
}
