/** Misconception → short visual feedback (SPEC §9.6). Every tag has an animation. */
import type { MisconceptionTag, Representation } from './types';

export type FeedbackAnimation =
  | 'CARRY_DOT_RISE'
  | 'BORROW_UNBUNDLE'
  | 'OP_SIGN_PULSE'
  | 'PLACE_COLUMNS_ALIGN'
  | 'NUMBERLINE_TEN_JUMP'
  | 'NUMBERLINE_ONE_STEP'
  | 'COUNT_TOGETHER';

export interface FeedbackSpec {
  animation: FeedbackAnimation;
  representation: Representation;
  /** Duration of the feedback animation in ms (kept short, SPEC §9.6). */
  durationMs: number;
}

export const MISCONCEPTION_FEEDBACK: Record<MisconceptionTag, FeedbackSpec> = {
  CARRY_FORGOTTEN: { animation: 'CARRY_DOT_RISE', representation: 'column', durationMs: 1600 },
  BORROW_REVERSED: { animation: 'BORROW_UNBUNDLE', representation: 'blocks', durationMs: 1800 },
  OP_CONFUSED: { animation: 'OP_SIGN_PULSE', representation: 'dots', durationMs: 1200 },
  PLACE_SHIFT: { animation: 'PLACE_COLUMNS_ALIGN', representation: 'column', durationMs: 1500 },
  OFF_BY_TEN: { animation: 'NUMBERLINE_TEN_JUMP', representation: 'numberline', durationMs: 1300 },
  OFF_BY_ONE: { animation: 'NUMBERLINE_ONE_STEP', representation: 'numberline', durationMs: 1100 },
};

/** Feedback for any wrong value: tagged misconception or a gentle count-together fallback. */
export function feedbackFor(tag: MisconceptionTag | undefined): FeedbackSpec {
  return tag
    ? MISCONCEPTION_FEEDBACK[tag]
    : { animation: 'COUNT_TOGETHER', representation: 'dots', durationMs: 1200 };
}
