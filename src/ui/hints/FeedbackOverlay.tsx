/** Misconception feedback after a wrong try (SPEC §9.6): a short picture, then "다시 해 보자!". */
import { motion, useReducedMotion } from 'motion/react';
import type { ReactElement } from 'react';
import { columnSteps } from '../../domain/edu/arith';
import { feedbackFor } from '../../domain/edu/feedback';
import { coreComputation } from '../../domain/edu/hints';
import type { MisconceptionTag, Question } from '../../domain/edu/types';
import { ko } from '../../i18n/ko';
import { Column, Dots, NumberLine } from './Representations';

export function FeedbackOverlay({ q, given, tag }: { q: Question; given: number; tag?: string }) {
  const reduce = useReducedMotion();
  const fb = feedbackFor(tag as MisconceptionTag | undefined, Math.max(q.answer, ...q.operands));
  const { a, b, op } = coreComputation({ ...q, form: q.form });
  let body: ReactElement;
  switch (fb.animation) {
    case 'CARRY_DOT_RISE':
    case 'BORROW_UNBUNDLE':
    case 'PLACE_COLUMNS_ALIGN':
      body = <Column a={a} b={b} op={op} columns={columnSteps(a, b, op)} />;
      break;
    case 'NUMBERLINE_TEN_JUMP':
    case 'NUMBERLINE_ONE_STEP':
      body = <NumberLine from={Math.min(given, q.answer)} hop={Math.abs(given - q.answer)} op="+" hideEnd />;
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
      body =
        q.answer <= 20 ? (
          <Dots quantities={q.operands.slice(0, 2)} />
        ) : (
          <Column a={a} b={b} op={op} columns={columnSteps(a, b, op)} />
        );
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
