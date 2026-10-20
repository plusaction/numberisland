/**
 * Question generator (SPEC §9.3). Pure: (level, skill, rng, avoid) → Question.
 * Every number produced is an integer in [0, level.max] and every answer is verified.
 */
import { type LevelSpec, levelSpec } from '../curriculum/curriculum';
import type { Rng } from '../rng/rng';
import { digitCount } from './arith';
import { type Core, coreKey, GenerationError, generateCoreAvoiding } from './core';
import { buildChoices } from './distractors';
import { buildHintPlan } from './hints';
import type { LevelId, Question, QuestionForm, SkillId } from './types';
import { chooseRepresentation, visualFor } from './visual';

export {
  type Core,
  coreKey,
  GenerationError,
  generateCore,
  generateCoreAvoiding,
  verifyCore,
  WORD_NOUN_COUNT,
} from './core';

export interface GenerateArgs {
  level: LevelId;
  skill?: SkillId;
  rng: Rng;
  /** Recent question keys that must not repeat (last 10 by default in sessions). */
  avoid?: readonly string[];
  constraints?: { form?: QuestionForm };
}

function pickSkill(level: LevelSpec, rng: Rng, form?: QuestionForm): SkillId {
  return rng.pick(level.skills.filter((s) => !form || skillForms(s).includes(form)).concat());
}

function skillForms(skill: SkillId): QuestionForm[] {
  switch (skill) {
    case 'MISSING_TERM':
    case 'RELATION':
      return ['MISSING'];
    case 'COMPOSE_10':
      return ['SPLIT', 'EXPR'];
    case 'COMPARE_EXPR':
      return ['COMPARE'];
    case 'ESTIMATE_CLOSE':
      return ['CLOSEST'];
    case 'PLACE_VALUE':
      return ['PLACE'];
    case 'SKIP_COUNT':
      return ['SEQUENCE'];
    case 'WORD':
      return ['WORD'];
    default:
      return ['EXPR'];
  }
}

const sixSeven = (c: Core) =>
  c.operands.length === 2 &&
  c.ops[0] === '+' &&
  ((c.operands[0] === 6 && c.operands[1] === 7) || (c.operands[0] === 7 && c.operands[1] === 6));

export function generateQuestion(args: GenerateArgs): Question {
  const level = levelSpec(args.level);
  const rng = args.rng;
  const avoid = new Set(args.avoid ?? []);
  const form = args.constraints?.form;
  let skill = args.skill && level.skills.includes(args.skill) ? args.skill : pickSkill(level, rng, form);
  let core = generateCoreAvoiding(level.id, skill, rng, avoid);
  if (!core) {
    // Defensive: fall back to any skill of the level that can generate.
    for (const s of level.skills) {
      core = generateCoreAvoiding(level.id, s, rng, avoid);
      if (core) {
        skill = s;
        break;
      }
    }
  }
  if (!core) throw new GenerationError(`cannot generate for ${level.id}`);
  const key = coreKey(core);
  const representation = chooseRepresentation(level, core, rng);
  const visual = visualFor(core, representation);
  const { choices, misconceptionMap } = buildChoices(core, level, rng);
  const exclude = new Set([...avoid, key]);
  const hintPlan = buildHintPlan(core, level, rng.fork(`hint:${key}`), exclude);
  const tags: string[] = [];
  if (sixSeven(core)) tags.push('SIX_SEVEN');
  const question: Question = {
    id: `${level.id}:${key}`,
    key,
    level: level.id,
    skill,
    form: core.form,
    operands: core.operands,
    ops: core.ops,
    result: core.result,
    answer: core.answer,
    choices,
    visual,
    hintPlan,
    misconceptionMap,
    tags,
    challenge: level.challenge,
  };
  if (core.missingIndex !== undefined) question.missingIndex = core.missingIndex;
  if (core.target !== undefined) question.target = core.target;
  if (core.word !== undefined) question.word = core.word;
  if (core.wordNoun !== undefined) question.wordNoun = core.wordNoun;
  if (core.given !== undefined) question.given = core.given;
  if (core.items !== undefined) question.items = core.items;
  return question;
}

/** Helper for UIs/tests: number of digits of the biggest number in a question. */
export function questionMagnitude(q: Pick<Question, 'operands' | 'answer'>): number {
  return Math.max(...q.operands.map(digitCount), digitCount(q.answer));
}
