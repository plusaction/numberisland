export const SKILLS = [
  'PLACE_VALUE',
  'SKIP_COUNT',
  'COMPOSE_10',
  'ADD_NOCARRY',
  'ADD_CARRY',
  'SUB_NOBORROW',
  'SUB_BORROW',
  'THREE_TERM',
  'MISSING_TERM',
  'RELATION',
  'COMPARE_EXPR',
  'ESTIMATE_CLOSE',
  'REPEATED_ADD',
  'WORD',
] as const;
export type SkillId = (typeof SKILLS)[number];

export const LEVEL_IDS = [
  'L0_1',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
] as const;
export type LevelId = (typeof LEVEL_IDS)[number];
export type Band = '0' | 'A' | 'B' | 'C';

export const REPRESENTATIONS = ['dots', 'tenframe', 'blocks', 'numberline', 'column'] as const;
export type Representation = (typeof REPRESENTATIONS)[number];

export const MISCONCEPTIONS = [
  'CARRY_FORGOTTEN',
  'BORROW_REVERSED',
  'OP_CONFUSED',
  'PLACE_SHIFT',
  'OFF_BY_TEN',
  'OFF_BY_ONE',
] as const;
export type MisconceptionTag = (typeof MISCONCEPTIONS)[number];

export type Op = '+' | '-';

/**
 * Question forms (how the child sees it):
 * - EXPR: a op b (op c) = ?
 * - MISSING: one operand (or result) is □
 * - COMPARE: pick the bigger of two items
 * - CLOSEST: pick the item closer to a target
 * - SEQUENCE: skip-count, fill the next number
 * - PLACE: build a number from place-value parts (or read a digit)
 * - SPLIT: split/compose a number (가르기·모으기)
 * - WORD: short word problem (template id + numbers)
 */
export type QuestionForm =
  | 'EXPR'
  | 'MISSING'
  | 'COMPARE'
  | 'CLOSEST'
  | 'SEQUENCE'
  | 'PLACE'
  | 'SPLIT'
  | 'WORD';

export interface Choice {
  value: number;
  /** Optional display override (e.g. an expression for COMPARE/CLOSEST). */
  display?: string;
  tag?: MisconceptionTag;
}

export interface VisualSpec {
  representation: Representation;
  /** Quantities to draw, one per operand (or the sequence/place parts). */
  quantities: number[];
  /** Index of the quantity that is the unknown (□) — renderers must draw it as a mystery box. */
  hidden?: number;
}

/** One written calculation shown in hint step 3. */
export interface StepCalc {
  mode: 'column' | 'compare' | 'place';
  a: number;
  b: number;
  op: Op;
  columns: ColumnStep[];
}

export type HintKind = 'visual' | 'strategy' | 'steps' | 'demo';

export type StrategyId =
  | 'MAKE_TEN'
  | 'SPLIT_SUBTRAHEND'
  | 'PLACE_SPLIT'
  | 'COUNT_ON'
  | 'INVERSE_OP'
  | 'JUMP_STEP'
  | 'GROUP_SAME';

export interface ColumnStep {
  /** 0 = ones, 1 = tens, ... */
  place: number;
  top: number;
  bottom: number;
  /** Carry/borrow coming into this column (+1 carry / -1 borrow). */
  carryIn: number;
  digit: number;
  /** Carry (+1) produced or borrow (-1) needed by this column. */
  carryOut: number;
}

export interface CompareItem {
  operands: number[];
  ops: Op[];
  value: number;
}

export interface WorkedExample {
  operands: number[];
  ops: Op[];
  answer: number;
  form: QuestionForm;
  missingIndex?: number;
}

export type HintStep =
  | { level: 1; kind: 'visual'; visual: VisualSpec }
  | { level: 2; kind: 'strategy'; strategy: StrategyId; parts: number[] }
  | { level: 3; kind: 'steps'; calcs: StepCalc[] }
  | { level: 4; kind: 'demo'; example: WorkedExample; retry: WorkedExample };

export type WordTemplate = 'JOIN' | 'TAKE' | 'COMPARE_MORE' | 'GROUPS';

export interface Question {
  /** Stable identity within a session: `${level}:${key}`. */
  id: string;
  /** Canonical key used for de-duplication (operands + form + missing slot). */
  key: string;
  level: LevelId;
  skill: SkillId;
  form: QuestionForm;
  operands: number[];
  ops: Op[];
  /** For MISSING: index of the hidden operand, or -1 for the result. */
  missingIndex?: number;
  /** For CLOSEST: target number. For SEQUENCE: step. */
  target?: number;
  word?: WordTemplate;
  /** Index into the noun list for WORD problems (UI picks the Korean noun). */
  wordNoun?: number;
  /** For RELATION: the fact shown first (e.g. 8+5=13). */
  given?: WorkedExample;
  /** For COMPARE/CLOSEST: the items to pick from. */
  items?: CompareItem[];
  /** Value of the whole expression as shown (for MISSING this is the visible result). */
  result: number;
  answer: number;
  choices: Choice[];
  visual: VisualSpec;
  hintPlan: HintStep[];
  misconceptionMap: Record<number, MisconceptionTag>;
  /** Event tags, e.g. 'SIX_SEVEN' for the hidden 13 firework. */
  tags: string[];
  /** Challenge flag (C4 선행). */
  challenge: boolean;
}

export interface QuestionSeedConstraints {
  /** Restrict operands/answer to this max (stage-specific). */
  max?: number;
  /** Force a particular form. */
  form?: QuestionForm;
}
