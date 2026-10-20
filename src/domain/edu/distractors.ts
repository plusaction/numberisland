/** Misconception-based wrong choices (SPEC §9.3). */
import type { LevelSpec } from '../curriculum/curriculum';
import type { Rng } from '../rng/rng';
import {
  addForgettingCarry,
  digitAt,
  digitCount,
  evaluate,
  hasBorrow,
  hasCarry,
  reverseDigits,
  subBorrowReversed,
} from './arith';
import type { Core } from './core';
import type { Choice, MisconceptionTag, Op } from './types';

interface Candidate {
  value: number;
  tag?: MisconceptionTag;
}

const flip = (op: Op): Op => (op === '+' ? '-' : '+');

function arithmeticMistakes(a: number, b: number, op: Op): Candidate[] {
  const out: Candidate[] = [];
  if (op === '+') {
    if (hasCarry(a, b)) out.push({ value: addForgettingCarry(a, b), tag: 'CARRY_FORGOTTEN' });
    out.push({ value: Math.abs(a - b), tag: 'OP_CONFUSED' });
    const [big, small] = a >= b ? [a, b] : [b, a];
    // misaligned columns (47+8 → 127) or digits written backwards (14 → 41)
    if (digitCount(small) < digitCount(big)) out.push({ value: big + small * 10, tag: 'PLACE_SHIFT' });
    else if (a + b < 100) out.push({ value: reverseDigits(a + b), tag: 'PLACE_SHIFT' });
  } else {
    if (hasBorrow(a, b)) out.push({ value: subBorrowReversed(a, b), tag: 'BORROW_REVERSED' });
    out.push({ value: a + b, tag: 'OP_CONFUSED' });
    if (digitCount(b) < digitCount(a) && a - b * 10 >= 0) out.push({ value: a - b * 10, tag: 'PLACE_SHIFT' });
    else if (digitCount(b) < digitCount(a) && b % 10 === 0)
      out.push({ value: a - b / 10, tag: 'PLACE_SHIFT' });
    else if (a - b < 100) out.push({ value: reverseDigits(a - b), tag: 'PLACE_SHIFT' });
  }
  return out;
}

function mistakesFor(core: Core): Candidate[] {
  const { operands, ops, form } = core;
  const a = operands[0] as number;
  const b = operands[1] as number;
  switch (form) {
    case 'EXPR':
    case 'WORD': {
      if (operands.length === 2) return arithmeticMistakes(a, b, ops[0] as Op);
      const out: Candidate[] = [];
      const allSame = operands.every((v) => v === a);
      if (allSame) {
        const n = operands.length;
        out.push({ value: a * (n - 1) }, { value: a * (n + 1) }, { value: a + n, tag: 'OP_CONFUSED' });
      } else {
        for (let i = 0; i < ops.length; i++) {
          const changed = ops.slice();
          changed[i] = flip(ops[i] as Op);
          out.push({ value: evaluate(operands, changed), tag: 'OP_CONFUSED' });
        }
        // make-ten or first-pair carry slip
        const first = ops[0] as Op;
        if (first === '+' && hasCarry(a, b)) {
          const slip = addForgettingCarry(a, b);
          out.push({ value: evaluate([slip, ...operands.slice(2)], ops.slice(1)), tag: 'CARRY_FORGOTTEN' });
        }
        if (first === '-' && hasBorrow(a, b)) {
          const slip = subBorrowReversed(a, b);
          out.push({ value: evaluate([slip, ...operands.slice(2)], ops.slice(1)), tag: 'BORROW_REVERSED' });
        }
      }
      return out;
    }
    case 'MISSING':
    case 'SPLIT': {
      const op = ops[0] as Op;
      const c = core.result;
      const mi = core.missingIndex ?? 1;
      if (mi === -1) return arithmeticMistakes(a, b, op);
      const known = mi === 0 ? b : a;
      const out: Candidate[] = [];
      if (op === '+') {
        // a + □ = c → child adds instead of subtracting, or slips while computing c − a
        out.push({ value: known + c, tag: 'OP_CONFUSED' });
        if (hasBorrow(c, known)) out.push({ value: subBorrowReversed(c, known), tag: 'BORROW_REVERSED' });
      } else if (mi === 0) {
        // □ − b = c → answer c + b ; child does c − b
        out.push({ value: Math.abs(c - b), tag: 'OP_CONFUSED' });
        if (hasCarry(c, b)) out.push({ value: addForgettingCarry(c, b), tag: 'CARRY_FORGOTTEN' });
      } else {
        // a − □ = c → answer a − c ; child does a + c
        out.push({ value: a + c, tag: 'OP_CONFUSED' });
        if (hasBorrow(a, c)) out.push({ value: subBorrowReversed(a, c), tag: 'BORROW_REVERSED' });
      }
      return out;
    }
    case 'SEQUENCE': {
      const step = Math.abs(core.target ?? 1);
      const ans = core.answer;
      const out: Candidate[] = [];
      // confusing the step with a neighbouring place (10씩 대신 1씩, 100씩 대신 10씩 …)
      for (const s of [1, 10, 100, 1000]) {
        if (s === step || s > step * 10 || s * 10 < step) continue;
        const tag: MisconceptionTag = s === 1 ? 'OFF_BY_ONE' : s === 10 ? 'OFF_BY_TEN' : 'PLACE_SHIFT';
        out.push({ value: ans + s, tag }, { value: ans - s, tag });
      }
      out.push({ value: ans + step }, { value: ans - step });
      return out;
    }
    case 'PLACE': {
      if (core.target !== undefined) {
        const n = a;
        const out: Candidate[] = [];
        for (let p = 0; p < digitCount(n); p++) {
          if (p !== core.target) out.push({ value: digitAt(n, p), tag: 'PLACE_SHIFT' });
        }
        return out;
      }
      const n = core.answer;
      const out: Candidate[] = [{ value: reverseDigits(n), tag: 'PLACE_SHIFT' }];
      // dropped zero placeholder: 407 → 47
      const s = String(n);
      if (s.includes('0')) out.push({ value: Number(s.replace(/0/g, '')) || 0, tag: 'PLACE_SHIFT' });
      // adjacent digit swap
      if (s.length >= 3) {
        const arr = s.split('');
        const t = arr[0] as string;
        arr[0] = arr[1] as string;
        arr[1] = t;
        out.push({ value: Number(arr.join('')), tag: 'PLACE_SHIFT' });
      }
      return out;
    }
    case 'COMPARE':
    case 'CLOSEST':
      return [];
  }
}

function tagForDiff(diff: number): MisconceptionTag | undefined {
  if (diff === 1) return 'OFF_BY_ONE';
  if (diff === 10) return 'OFF_BY_TEN';
  return undefined;
}

export function buildChoices(
  core: Core,
  level: LevelSpec,
  rng: Rng,
): { choices: Choice[]; misconceptionMap: Record<number, MisconceptionTag> } {
  const answer = core.answer;
  const misconceptionMap: Record<number, MisconceptionTag> = {};

  if (core.form === 'COMPARE' || core.form === 'CLOSEST') {
    const items = core.items ?? [];
    const choices: Choice[] = items.map((it) => {
      const display = it.ops.length
        ? it.operands.map((v, i) => (i === 0 ? `${v}` : `${it.ops[i - 1]}${v}`)).join('')
        : `${it.value}`;
      const choice: Choice = { value: it.value, display };
      if (it.value !== answer) {
        let tag: MisconceptionTag | undefined;
        if (core.form === 'COMPARE') {
          const [x, y] = [it.value, answer];
          if (digitCount(x) === digitCount(y) && x % 10 > y % 10) tag = 'PLACE_SHIFT';
          else tag = tagForDiff(Math.abs(x - y));
        }
        if (tag) {
          choice.tag = tag;
          misconceptionMap[it.value] = tag;
        }
      }
      return choice;
    });
    return { choices, misconceptionMap };
  }

  // Numeric 4-choice
  // Plausible range: digit questions stay 0–9, others ≤ 1.5× the level ceiling.
  const digitQuestion = core.form === 'PLACE' && core.target !== undefined;
  const cap = digitQuestion ? 9 : Math.max(Math.ceil(level.max * 1.5), answer + 10, 12);
  // Plausible distractors only: bounded, and not absurdly small for big answers (no "0" for 110).
  const floor = answer >= 100 ? Math.floor(answer / 10) : 0;
  const isValid = (v: number) => Number.isInteger(v) && v >= floor && v <= cap && v !== answer;
  const picked: Candidate[] = [];
  const seen = new Set<number>([answer]);
  const add = (c: Candidate) => {
    if (picked.length >= 3 || !isValid(c.value) || seen.has(c.value)) return;
    seen.add(c.value);
    picked.push(c);
  };
  // The operation's signature mistake (받아올림 잊음 / 큰 수에서 작은 수 빼기) always leads; the rest are shuffled.
  const signature = (m: Candidate) => m.tag === 'CARRY_FORGOTTEN' || m.tag === 'BORROW_REVERSED';
  const all = mistakesFor(core);
  const mistakes = [...all.filter(signature), ...rng.shuffle(all.filter((m) => !signature(m)))];
  // tagged conceptual mistakes first (but leave room for one off-by distractor when possible)
  for (const m of mistakes) if (m.tag && picked.length < 2) add(m);
  const allowTen = !digitQuestion && (answer >= 10 || level.max >= 20);
  const offs: Candidate[] = rng.shuffle([
    { value: answer + 1, tag: 'OFF_BY_ONE' },
    { value: answer - 1, tag: 'OFF_BY_ONE' },
    ...(allowTen
      ? [
          { value: answer + 10, tag: 'OFF_BY_TEN' as const },
          { value: answer - 10, tag: 'OFF_BY_TEN' as const },
        ]
      : []),
  ]);
  add(offs[0] as Candidate);
  for (const m of mistakes) add(m);
  for (const o of offs) add(o);
  const spread = Math.max(3, Math.min(20, Math.ceil(answer * 0.2)));
  for (let i = 0; i < 200 && picked.length < 3; i++) {
    add({ value: answer + rng.int(-spread, spread) });
  }
  for (let v = 0; picked.length < 3; v++) add({ value: answer + v + 2 });
  for (const p of picked) if (p.tag) misconceptionMap[p.value] = p.tag;
  const choices: Choice[] = rng.shuffle([
    { value: answer },
    ...picked.map((p) => (p.tag ? { value: p.value, tag: p.tag } : { value: p.value })),
  ]);
  return { choices, misconceptionMap };
}
