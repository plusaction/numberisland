import type { Band, LevelId, QuestionForm, Representation, SkillId } from '../edu/types';

/** Confirmation status vs. Korean textbook tables of contents (SPEC §9.1). */
export type Verified = 'confirmed' | 'partial' | 'assumed' | 'advanced';
export type CarryPolicy = 'none' | 'some' | 'always';
export type Range = readonly [number, number];

export interface ArithSpec {
  a: Range;
  b: Range;
  /** Inclusive bounds on the result. */
  minResult: number;
  maxResult: number;
  /** Operands are multiples of this (e.g. 100 for 1200+300). */
  multipleOf?: number;
}

export interface LevelSpec {
  id: LevelId;
  band: Band;
  /** School term this content belongs to, e.g. '1-2'. */
  term: '1-1' | '1-2' | '2-1' | '2-2' | '3-1';
  /** Short Korean description (docs/CURRICULUM_VERIFY.md, parent panel). */
  title: string;
  skills: readonly SkillId[];
  /** Hard ceiling for any number that appears (operands, answers). */
  max: number;
  carry: CarryPolicy;
  terms: 2 | 3;
  forms: readonly QuestionForm[];
  representations: readonly Representation[];
  add?: ArithSpec;
  sub?: ArithSpec;
  /** Three-term calculation operand range and result ceiling. */
  three?: { term: Range; max: number };
  /** Place-value questions: number of digits. */
  placeDigits?: 1 | 2 | 3 | 4;
  /** Skip-count steps. */
  skipSteps?: readonly number[];
  repeated?: { base: Range; count: Range };
  challenge: boolean;
  verified: Verified;
  evidence: string;
}

export const CURRICULUM: readonly LevelSpec[] = [
  {
    id: 'L0_1',
    band: '0',
    term: '1-1',
    title: '9 이내 덧셈·뺄셈, 가르기·모으기',
    skills: ['COMPOSE_10', 'ADD_NOCARRY', 'SUB_NOBORROW', 'MISSING_TERM', 'COMPARE_EXPR'],
    max: 9,
    carry: 'none',
    terms: 2,
    forms: ['EXPR', 'MISSING', 'SPLIT', 'COMPARE'],
    representations: ['dots', 'tenframe', 'numberline'],
    add: { a: [0, 9], b: [0, 9], minResult: 1, maxResult: 9 },
    sub: { a: [1, 9], b: [0, 9], minResult: 0, maxResult: 9 },
    challenge: false,
    verified: 'confirmed',
    evidence: '1-1 덧셈과 뺄셈 단원: 합이 9 이하, 한 자리 수 뺄셈, 가르기·모으기',
  },
  {
    id: 'A1',
    band: 'A',
    term: '1-2',
    title: '100까지의 수: 자릿값·뛰어 세기·크기 비교',
    skills: ['PLACE_VALUE', 'SKIP_COUNT', 'COMPARE_EXPR'],
    max: 100,
    carry: 'none',
    terms: 2,
    forms: ['PLACE', 'SEQUENCE', 'COMPARE'],
    representations: ['blocks', 'numberline', 'tenframe'],
    placeDigits: 2,
    skipSteps: [1, 10],
    challenge: false,
    verified: 'confirmed',
    evidence: '1-2 "100까지의 수" 단원(십·일, 뛰어 세기, 크기 비교)',
  },
  {
    id: 'A2',
    band: 'A',
    term: '1-2',
    title: '20 이내 받아올림 덧셈·받아내림 뺄셈 (10 만들기)',
    skills: ['ADD_CARRY', 'SUB_BORROW', 'COMPOSE_10', 'MISSING_TERM'],
    max: 20,
    carry: 'always',
    terms: 2,
    forms: ['EXPR', 'MISSING', 'SPLIT'],
    representations: ['tenframe', 'dots', 'numberline'],
    add: { a: [2, 9], b: [2, 9], minResult: 10, maxResult: 18 },
    sub: { a: [11, 18], b: [2, 9], minResult: 2, maxResult: 9 },
    three: { term: [1, 9], max: 19 },
    challenge: false,
    verified: 'partial',
    evidence:
      '1-2 "덧셈과 뺄셈(2)/(3)": 10 만들기, (몇)+(몇)=(십몇), (십몇)-(몇)=(몇). 출판사별 배열 확인 필요',
  },
  {
    id: 'A3',
    band: 'A',
    term: '1-2',
    title: '(두 자리) ± (한 자리)',
    skills: ['ADD_NOCARRY', 'ADD_CARRY', 'SUB_NOBORROW', 'SUB_BORROW'],
    max: 99,
    carry: 'some',
    terms: 2,
    forms: ['EXPR'],
    representations: ['blocks', 'numberline', 'column'],
    add: { a: [10, 98], b: [1, 9], minResult: 11, maxResult: 99 },
    sub: { a: [10, 99], b: [1, 9], minResult: 1, maxResult: 98 },
    challenge: false,
    verified: 'partial',
    evidence: '1-2 두 자리 수 덧셈·뺄셈. 받아올림 포함 여부는 출판사별 확인 필요',
  },
  {
    id: 'A4',
    band: 'A',
    term: '1-2',
    title: '(두 자리) ± (두 자리), 받아올림·내림 없음',
    skills: ['ADD_NOCARRY', 'SUB_NOBORROW', 'MISSING_TERM', 'ESTIMATE_CLOSE'],
    max: 99,
    carry: 'none',
    terms: 2,
    forms: ['EXPR', 'MISSING', 'CLOSEST'],
    representations: ['blocks', 'column', 'numberline'],
    add: { a: [10, 89], b: [10, 89], minResult: 20, maxResult: 99 },
    sub: { a: [11, 99], b: [10, 89], minResult: 0, maxResult: 89 },
    challenge: false,
    verified: 'partial',
    evidence: '1-2 "덧셈과 뺄셈(1)": (몇십몇)±(몇십몇) 받아올림 없음',
  },
  {
    id: 'A5',
    band: 'A',
    term: '1-2',
    title: '(두 자리) ± (두 자리), 받아올림·내림 있음, 세로셈',
    skills: ['ADD_CARRY', 'SUB_BORROW'],
    max: 99,
    carry: 'always',
    terms: 2,
    forms: ['EXPR'],
    representations: ['column', 'blocks'],
    add: { a: [11, 89], b: [11, 89], minResult: 30, maxResult: 99 },
    sub: { a: [20, 99], b: [11, 89], minResult: 1, maxResult: 88 },
    challenge: false,
    verified: 'partial',
    evidence: '일부 자료에서 1-2 포함, 다른 판에서는 2-1 "덧셈과 뺄셈" 단원. 교과서 대조 필요',
  },
  {
    id: 'A6',
    band: 'A',
    term: '1-2',
    title: '세 수 덧셈·뺄셈, □ 채우기, 짧은 문장제',
    skills: ['THREE_TERM', 'MISSING_TERM', 'WORD', 'COMPARE_EXPR'],
    max: 99,
    carry: 'some',
    terms: 3,
    forms: ['EXPR', 'MISSING', 'WORD', 'COMPARE'],
    representations: ['dots', 'numberline', 'blocks'],
    add: { a: [2, 49], b: [1, 9], minResult: 3, maxResult: 58 },
    sub: { a: [5, 59], b: [1, 9], minResult: 0, maxResult: 58 },
    three: { term: [1, 9], max: 20 },
    challenge: false,
    verified: 'partial',
    evidence: '1-2 세 수의 덧셈과 뺄셈(한 자리 수), □가 있는 식. 문장제는 교과서 활동 수준으로 가정',
  },
  {
    id: 'B1',
    band: 'B',
    term: '2-1',
    title: '세 자리 수: 자릿값·크기 비교·뛰어 세기',
    skills: ['PLACE_VALUE', 'SKIP_COUNT', 'COMPARE_EXPR'],
    max: 999,
    carry: 'none',
    terms: 2,
    forms: ['PLACE', 'SEQUENCE', 'COMPARE'],
    representations: ['blocks', 'numberline'],
    placeDigits: 3,
    skipSteps: [1, 10, 100],
    challenge: false,
    verified: 'confirmed',
    evidence: '2-1 "세 자리 수" 단원(백·십·일, 뛰어 세기, 크기 비교)',
  },
  {
    id: 'B2',
    band: 'B',
    term: '2-1',
    title: '(두 자리) + (두 자리), 합이 세 자리 (받아올림)',
    skills: ['ADD_CARRY'],
    max: 198,
    carry: 'always',
    terms: 2,
    forms: ['EXPR'],
    representations: ['column', 'blocks'],
    add: { a: [11, 99], b: [11, 99], minResult: 100, maxResult: 198 },
    challenge: false,
    verified: 'assumed',
    evidence: '2-1 "덧셈과 뺄셈" 단원으로 가정',
  },
  {
    id: 'B3',
    band: 'B',
    term: '2-1',
    title: '받아내림 뺄셈 완성, 세 수 계산',
    skills: ['SUB_BORROW', 'THREE_TERM'],
    max: 199,
    carry: 'always',
    terms: 3,
    forms: ['EXPR'],
    representations: ['column', 'blocks', 'numberline'],
    sub: { a: [20, 199], b: [11, 99], minResult: 1, maxResult: 188 },
    three: { term: [10, 99], max: 199 },
    challenge: false,
    verified: 'assumed',
    evidence: '2-1 "덧셈과 뺄셈" 단원(받아내림, 세 수의 계산)으로 가정',
  },
  {
    id: 'B4',
    band: 'B',
    term: '2-1',
    title: '덧셈과 뺄셈의 관계, □ 구하기',
    skills: ['RELATION', 'MISSING_TERM', 'ESTIMATE_CLOSE'],
    max: 199,
    carry: 'some',
    terms: 2,
    forms: ['MISSING', 'CLOSEST'],
    representations: ['numberline', 'blocks'],
    add: { a: [11, 99], b: [11, 99], minResult: 30, maxResult: 198 },
    sub: { a: [20, 199], b: [11, 99], minResult: 1, maxResult: 188 },
    challenge: false,
    verified: 'partial',
    evidence: '2-1 "덧셈과 뺄셈" 단원의 관계·□ 구하기 차시',
  },
  {
    id: 'B5',
    band: 'B',
    term: '2-1',
    title: '문장제, 같은 수 여러 번 더하기',
    skills: ['WORD', 'REPEATED_ADD'],
    max: 199,
    carry: 'some',
    terms: 2,
    forms: ['WORD', 'EXPR'],
    representations: ['dots', 'blocks', 'numberline'],
    add: { a: [11, 99], b: [11, 99], minResult: 30, maxResult: 198 },
    sub: { a: [20, 199], b: [11, 99], minResult: 1, maxResult: 188 },
    repeated: { base: [2, 9], count: [2, 5] },
    challenge: false,
    verified: 'assumed',
    evidence: '2-1 "곱셈" 단원 도입(묶어 세기, 몇의 몇 배)로 가정',
  },
  {
    id: 'C1',
    band: 'C',
    term: '2-2',
    title: '네 자리 수: 자릿값·뛰어 세기',
    skills: ['PLACE_VALUE', 'SKIP_COUNT', 'COMPARE_EXPR'],
    max: 9999,
    carry: 'none',
    terms: 2,
    forms: ['PLACE', 'SEQUENCE', 'COMPARE'],
    representations: ['blocks', 'numberline'],
    placeDigits: 4,
    skipSteps: [10, 100, 1000],
    challenge: false,
    verified: 'confirmed',
    evidence: '2-2 "네 자리 수" 단원',
  },
  {
    id: 'C2',
    band: 'C',
    term: '2-2',
    title: '네 자리 수 범위의 몇백·몇십 덧셈·뺄셈',
    skills: ['ADD_NOCARRY', 'ADD_CARRY', 'SUB_NOBORROW', 'SUB_BORROW'],
    max: 9999,
    carry: 'some',
    terms: 2,
    forms: ['EXPR'],
    representations: ['blocks', 'column'],
    add: { a: [1000, 9800], b: [100, 900], minResult: 1100, maxResult: 9900, multipleOf: 100 },
    sub: { a: [1100, 9900], b: [100, 900], minResult: 200, maxResult: 9800, multipleOf: 100 },
    challenge: false,
    verified: 'assumed',
    evidence: '2-2 네 자리 수 뛰어 세기와 연계한 몇백 단위 계산으로 가정',
  },
  {
    id: 'C3',
    band: 'C',
    term: '2-2',
    title: '(세 자리) ± (두 자리), 받아올림·내림 포함',
    skills: ['ADD_NOCARRY', 'ADD_CARRY', 'SUB_NOBORROW', 'SUB_BORROW', 'MISSING_TERM'],
    max: 999,
    carry: 'some',
    terms: 2,
    forms: ['EXPR', 'MISSING'],
    representations: ['column', 'blocks', 'numberline'],
    add: { a: [100, 950], b: [11, 99], minResult: 111, maxResult: 999 },
    sub: { a: [110, 999], b: [11, 99], minResult: 11, maxResult: 988 },
    challenge: false,
    verified: 'assumed',
    evidence: '교과 근거 약함(3-1 단원 일부). 2-2 확장으로 가정 — 대조 필요',
  },
  {
    id: 'C4',
    band: 'C',
    term: '3-1',
    title: '[선행·도전] (세 자리) ± (세 자리)',
    skills: ['ADD_NOCARRY', 'ADD_CARRY', 'SUB_NOBORROW', 'SUB_BORROW'],
    max: 1998,
    carry: 'some',
    terms: 2,
    forms: ['EXPR'],
    representations: ['column', 'blocks'],
    add: { a: [100, 999], b: [100, 999], minResult: 200, maxResult: 1998 },
    sub: { a: [200, 999], b: [100, 899], minResult: 1, maxResult: 899 },
    challenge: true,
    verified: 'advanced',
    evidence: '3-1 "덧셈과 뺄셈" 단원 내용(교과 초과 선행). 부모가 끌 수 있음',
  },
  {
    id: 'C5',
    band: 'C',
    term: '2-2',
    title: '혼합 세 수, 문장제, 반복 덧셈·뛰어 세기(2~9)',
    skills: ['THREE_TERM', 'WORD', 'REPEATED_ADD', 'SKIP_COUNT'],
    max: 999,
    carry: 'some',
    terms: 3,
    forms: ['EXPR', 'WORD', 'SEQUENCE'],
    representations: ['numberline', 'dots', 'column'],
    add: { a: [100, 899], b: [11, 99], minResult: 111, maxResult: 998 },
    sub: { a: [110, 999], b: [11, 99], minResult: 11, maxResult: 988 },
    three: { term: [10, 299], max: 999 },
    skipSteps: [2, 3, 4, 5, 6, 7, 8, 9],
    repeated: { base: [2, 9], count: [2, 9] },
    challenge: false,
    verified: 'assumed',
    evidence: '2-2 "곱셈구구" 단원과 연계한 뛰어 세기·반복 덧셈으로 가정',
  },
];

const BY_ID = new Map<LevelId, LevelSpec>(CURRICULUM.map((l) => [l.id, l]));

export function levelSpec(id: LevelId): LevelSpec {
  const spec = BY_ID.get(id);
  if (!spec) throw new Error(`unknown level ${id}`);
  return spec;
}

export function levelIndex(id: LevelId): number {
  return CURRICULUM.findIndex((l) => l.id === id);
}

export function levelAt(index: number): LevelSpec {
  const clamped = Math.max(0, Math.min(CURRICULUM.length - 1, index));
  return CURRICULUM[clamped] as LevelSpec;
}

/** School-term setting → start level + allowed range (parent panel "현재 진도"). */
export type TermSetting = '1-1' | '1-2' | '2-1' | '2-2';
export const TERM_RANGES: Record<TermSetting, { start: LevelId; floor: LevelId; ceiling: LevelId }> = {
  '1-1': { start: 'L0_1', floor: 'L0_1', ceiling: 'C5' },
  '1-2': { start: 'A1', floor: 'L0_1', ceiling: 'C5' },
  '2-1': { start: 'B1', floor: 'A1', ceiling: 'C5' },
  '2-2': { start: 'C1', floor: 'A3', ceiling: 'C5' },
};
