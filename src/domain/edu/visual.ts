/** Representation choice (SPEC §9.2: dots | tenframe | blocks | numberline | column). */
import type { LevelSpec } from '../curriculum/curriculum';
import type { Rng } from '../rng/rng';
import type { Core } from './core';
import type { Representation, SkillId, VisualSpec } from './types';

const PREFERENCES: Record<SkillId, Representation[]> = {
  PLACE_VALUE: ['blocks', 'numberline'],
  SKIP_COUNT: ['numberline', 'blocks'],
  COMPOSE_10: ['tenframe', 'dots'],
  ADD_NOCARRY: ['blocks', 'dots', 'column', 'numberline'],
  ADD_CARRY: ['tenframe', 'column', 'blocks'],
  SUB_NOBORROW: ['blocks', 'dots', 'numberline', 'column'],
  SUB_BORROW: ['tenframe', 'column', 'blocks'],
  THREE_TERM: ['dots', 'numberline', 'column'],
  MISSING_TERM: ['numberline', 'tenframe', 'blocks', 'dots'],
  RELATION: ['numberline', 'blocks'],
  COMPARE_EXPR: ['numberline', 'blocks', 'dots'],
  ESTIMATE_CLOSE: ['numberline', 'blocks'],
  REPEATED_ADD: ['dots', 'blocks', 'numberline'],
  WORD: ['dots', 'blocks', 'numberline'],
};

/** Upper bound on quantity a representation can draw legibly. */
const CAPACITY: Record<Representation, number> = {
  dots: 20,
  tenframe: 20,
  blocks: 9999,
  numberline: 9999,
  column: 9999,
};

export function chooseRepresentation(level: LevelSpec, core: Core, rng: Rng): Representation {
  const biggest = Math.max(core.answer, core.result, ...core.operands);
  const allowed = PREFERENCES[core.skill].filter(
    (r) => level.representations.includes(r) && CAPACITY[r] >= biggest,
  );
  if (allowed.length === 0) {
    const fallback = level.representations.filter((r) => CAPACITY[r] >= biggest);
    return fallback[0] ?? 'numberline';
  }
  // Mostly the top preference, sometimes the second for variety.
  return allowed.length > 1 && rng.chance(0.3)
    ? (allowed[1] as Representation)
    : (allowed[0] as Representation);
}

export function visualFor(core: Core, representation: Representation): VisualSpec {
  const spec: VisualSpec = { representation, quantities: core.operands.slice() };
  const hides = core.form === 'MISSING' || core.form === 'SPLIT' || core.form === 'SEQUENCE';
  if (hides && core.missingIndex !== undefined && core.missingIndex >= 0) spec.hidden = core.missingIndex;
  return spec;
}
