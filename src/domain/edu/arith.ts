/** Column arithmetic helpers (pure). */
import type { ColumnStep, Op } from './types';

export function digits(n: number): number[] {
  // least significant first
  if (n === 0) return [0];
  const out: number[] = [];
  let x = Math.abs(n);
  while (x > 0) {
    out.push(x % 10);
    x = Math.floor(x / 10);
  }
  return out;
}

export function digitCount(n: number): number {
  return digits(n).length;
}

export function digitAt(n: number, place: number): number {
  return Math.floor(Math.abs(n) / 10 ** place) % 10;
}

export function hasCarry(a: number, b: number): boolean {
  const places = Math.max(digitCount(a), digitCount(b));
  for (let p = 0; p < places; p++) if (digitAt(a, p) + digitAt(b, p) >= 10) return true;
  return false;
}

export function hasBorrow(a: number, b: number): boolean {
  const places = Math.max(digitCount(a), digitCount(b));
  for (let p = 0; p < places; p++) if (digitAt(a, p) < digitAt(b, p)) return true;
  return false;
}

/** 47+38 → 75: every column summed mod 10, carries dropped. */
export function addForgettingCarry(a: number, b: number): number {
  const places = Math.max(digitCount(a), digitCount(b));
  let out = 0;
  for (let p = 0; p < places; p++) out += ((digitAt(a, p) + digitAt(b, p)) % 10) * 10 ** p;
  return out;
}

/** 52−27 → 35: each column takes bigger digit minus smaller digit. */
export function subBorrowReversed(a: number, b: number): number {
  const places = Math.max(digitCount(a), digitCount(b));
  let out = 0;
  for (let p = 0; p < places; p++) out += Math.abs(digitAt(a, p) - digitAt(b, p)) * 10 ** p;
  return out;
}

export function reverseDigits(n: number): number {
  return Number(String(n).split('').reverse().join(''));
}

export function evaluate(operands: readonly number[], ops: readonly Op[]): number {
  let acc = operands[0] ?? 0;
  for (let i = 0; i < ops.length; i++) {
    const v = operands[i + 1] ?? 0;
    acc = ops[i] === '+' ? acc + v : acc - v;
  }
  return acc;
}

/** Every left-to-right partial result (excluding the first operand). */
export function partials(operands: readonly number[], ops: readonly Op[]): number[] {
  const out: number[] = [];
  let acc = operands[0] ?? 0;
  for (let i = 0; i < ops.length; i++) {
    const v = operands[i + 1] ?? 0;
    acc = ops[i] === '+' ? acc + v : acc - v;
    out.push(acc);
  }
  return out;
}

/** Written column method (세로셈) steps for a ± b with a ≥ b for subtraction. */
export function columnSteps(a: number, b: number, op: Op): ColumnStep[] {
  const places = Math.max(digitCount(a), digitCount(b), digitCount(op === '+' ? a + b : a - b));
  const steps: ColumnStep[] = [];
  let carry = 0;
  for (let p = 0; p < places; p++) {
    const top = digitAt(a, p);
    const bottom = digitAt(b, p);
    if (op === '+') {
      const s = top + bottom + carry;
      steps.push({ place: p, top, bottom, carryIn: carry, digit: s % 10, carryOut: s >= 10 ? 1 : 0 });
      carry = s >= 10 ? 1 : 0;
    } else {
      let t = top + carry; // carry is 0 or -1
      let out = 0;
      if (t < bottom) {
        t += 10;
        out = -1;
      }
      steps.push({ place: p, top, bottom, carryIn: carry, digit: t - bottom, carryOut: out });
      carry = out;
    }
  }
  // Drop leading zero columns that carry no information.
  while (steps.length > 1) {
    const last = steps[steps.length - 1] as ColumnStep;
    if (last.top === 0 && last.bottom === 0 && last.digit === 0 && last.carryIn === 0) steps.pop();
    else break;
  }
  return steps;
}
