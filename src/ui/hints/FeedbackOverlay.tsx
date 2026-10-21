/** Misconception feedback after a wrong try (SPEC §9.6): a short picture, then "다시 해 보자!". */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactElement } from 'react';
import { columnSteps } from '../../domain/edu/arith';
import { feedbackFor } from '../../domain/edu/feedback';
import { coreComputation } from '../../domain/edu/hints';
import type { MisconceptionTag, Question } from '../../domain/edu/types';
import { ko } from '../../i18n/ko';
import { Column, Dots, NumberLine } from './Representations';

/** Stage miss: "what you made" vs the target on a number line — never the correct parts. */
function MadeVsTarget({ made, target }: { made: number; target: number }) {
  const lo = Math.min(made, target);
  return (
    <div className="text-center">
      <p className="question-main text-5xl">
        {made} {made > target ? '>' : '<'} {target}
      </p>
      <NumberLine from={lo} hop={Math.abs(made - target)} op="+" />
    </div>
  );
}

export function FeedbackOverlay({
  q,
  given,
  tag,
  made,
  target,
}: {
  q: Question;
  given: number;
  tag?: string;
  made?: number;
  target?: number;
}) {
  const reduce = useReducedMotion();
  const fb = feedbackFor(tag as MisconceptionTag | undefined, Math.max(q.answer, ...q.operands));
  const { a, b, op } = coreComputation({ ...q, form: q.form });
  let body: ReactElement;
  if (made !== undefined && target !== undefined && !tag) {
    body = <MadeVsTarget made={made} target={target} />;
  } else
    switch (fb.animation) {
      case 'CARRY_DOT_RISE':
      case 'BORROW_UNBUNDLE':
      case 'PLACE_COLUMNS_ALIGN':
        // carry/borrow marks only — the result digits stay as empty boxes (never show the answer)
        body = <Column a={a} b={b} op={op} columns={columnSteps(a, b, op)} revealUpTo={-1} />;
        break;
      case 'NUMBERLINE_TEN_JUMP':
      case 'NUMBERLINE_ONE_STEP':
        body = (
          <NumberLine
            from={given}
            hop={Math.abs(given - q.answer)}
            op={given < q.answer ? '+' : '-'}
            hideEnd
            hideHop
          />
        );
        break;
      case 'OP_SIGN_PULSE':
        body = (
          <motion.p
            className="question-main text-7xl"
            animate={reduce ? {} : { scale: [1, 1.35, 1] }}
            transition={{ duration: 0.6, repeat: 1 }}
          >
            {op === '+' ? '+' : '−'}
          </motion.p>
        );
        break;
      default:
        body = <Column a={a} b={b} op={op} columns={columnSteps(a, b, op)} revealUpTo={-1} />;
    }
  return (
    <motion.div
      className="feedback card"
      role="status"
      data-testid="feedback"
      data-anim={fb.animation}
      initial={reduce ? false : { y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="max-w-md">{body}</div>
      <p className="mt-2 text-center text-2xl font-extrabold">{ko.question.tryAgain}</p>
    </motion.div>
  );
}
