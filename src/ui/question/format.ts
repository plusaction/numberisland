/** Turn a Question into the short text a child reads (numbers first, ≤ 12 chars of words, P4). */
import { WORD_NOUN_COUNT } from '../../domain/edu/generate';
import type { Op, Question } from '../../domain/edu/types';
import { fmt, ko } from '../../i18n/ko';

const sign = (op: Op) => (op === '+' ? '+' : '−');

export function exprText(operands: readonly number[], ops: readonly Op[], hide?: number): string {
  return operands
    .map((v, i) => `${i === 0 ? '' : ` ${sign(ops[i - 1] as Op)} `}${i === hide ? '□' : v}`)
    .join('');
}

export interface QuestionText {
  /** Main line, mostly numbers (e.g. "8 + □ = 13"). */
  main: string;
  /** Optional short instruction (spoken by 🔊). */
  prompt: string;
  /** Extra line (e.g. the given fact for RELATION). */
  pre?: string;
}

export function questionText(q: Question): QuestionText {
  const mi = q.missingIndex;
  switch (q.form) {
    case 'EXPR':
      return { main: `${exprText(q.operands, q.ops)} = ?`, prompt: `${exprText(q.operands, q.ops)} 는?` };
    case 'MISSING': {
      const pre = q.given ? `${exprText(q.given.operands, q.given.ops)} = ${q.given.answer}` : undefined;
      const main =
        mi === -1 ? `${exprText(q.operands, q.ops)} = □` : `${exprText(q.operands, q.ops, mi)} = ${q.result}`;
      return pre ? { main, prompt: main, pre } : { main, prompt: main };
    }
    case 'SPLIT': {
      const [a = 0, b = 0] = q.operands;
      if (mi === -1) return { main: `${a} 와 ${b} → □`, prompt: fmt(ko.question.gather, { a, b }) };
      return { main: `${q.result} → ${a} 와 □`, prompt: fmt(ko.question.split, { c: q.result, a }) };
    }
    case 'COMPARE':
      return { main: ko.question.bigger, prompt: ko.question.bigger };
    case 'CLOSEST':
      return { main: `🎯 ${q.target}`, prompt: fmt(ko.question.closer, { t: q.target ?? 0 }) };
    case 'SEQUENCE': {
      const main = q.operands.map((v, i) => (i === mi ? '□' : String(v))).join(', ');
      return { main, prompt: ko.question.next };
    }
    case 'PLACE': {
      if (q.target !== undefined) {
        const n = q.operands[0] ?? 0;
        const place = ko.question.places[q.target] ?? '';
        return { main: `${n}`, prompt: fmt(ko.question.digit, { n, place }) };
      }
      const parts = q.operands.map((v) => String(v)).join(' + ');
      return { main: `${parts} = ?`, prompt: ko.question.build };
    }
    case 'WORD': {
      const noun = ko.word.nouns[(q.wordNoun ?? 0) % WORD_NOUN_COUNT] ?? ko.word.nouns[0];
      const [a = 0, b = 0] = q.operands;
      const vars = { noun: noun.name, unit: noun.unit, a, b, count: q.operands.length };
      let tpl: string;
      switch (q.word) {
        case 'JOIN':
          tpl = ko.word.JOIN;
          break;
        case 'TAKE':
          tpl = noun.food ? ko.word.TAKE_FOOD : ko.word.TAKE_GIVE;
          break;
        case 'COMPARE_MORE':
          tpl = ko.word.COMPARE_MORE;
          break;
        default:
          tpl = ko.word.GROUPS;
      }
      const text = fmt(tpl, vars);
      return { main: text, prompt: text };
    }
  }
}
