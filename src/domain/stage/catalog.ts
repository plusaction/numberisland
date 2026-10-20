/** Which skills each stage trains (hub info card tags + "오늘의 추천"). */
import type { SkillId } from '../edu/types';
import type { StageId } from './types';

export const STAGE_SKILLS: Record<StageId, readonly SkillId[]> = {
  bomb: ['ADD_CARRY', 'SUB_BORROW', 'PLACE_VALUE', 'THREE_TERM'],
  zombie: ['SUB_NOBORROW', 'SUB_BORROW', 'ADD_NOCARRY'],
  fishing: ['ADD_CARRY', 'SUB_BORROW', 'MISSING_TERM'],
  slime: ['ADD_NOCARRY', 'ADD_CARRY', 'SUB_NOBORROW', 'COMPOSE_10'],
  escape: ['MISSING_TERM', 'COMPOSE_10', 'PLACE_VALUE'],
  pizza: ['ADD_CARRY', 'SUB_BORROW', 'RELATION'],
  cardbattle: ['ESTIMATE_CLOSE', 'COMPARE_EXPR', 'SUB_BORROW'],
  race: ['ADD_CARRY', 'SUB_BORROW', 'SKIP_COUNT'],
};
