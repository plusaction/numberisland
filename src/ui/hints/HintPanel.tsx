/** 4-step hints (SPEC §9.5): picture → strategy → column steps → worked demo, then the child solves. */
import type { HintStep, Op, Question } from '../../domain/edu/types';
import { fmt, ko } from '../../i18n/ko';
import { Button } from '../components/Button';
import { SpeakButton } from '../components/SpeakButton';
import { exprText } from '../question/format';
import { Blocks, Column, RepresentationView } from './Representations';

function StrategyLine({ step }: { step: Extract<HintStep, { kind: 'strategy' }> }) {
  const p = step.parts;
  let line: string;
  switch (step.strategy) {
    case 'MAKE_TEN':
      line = p.length >= 3 ? `${p[0]} + ${p[1]} = 10 → 10 + ${p[2]}` : `${p[0]} + ${10 - (p[0] ?? 0)} = 10`;
      break;
    case 'SPLIT_SUBTRAHEND':
      line = p.length >= 3 ? `${p[0]} − ${p[1]} − ${p[2]}` : `${p[0]} − ${p[1]}`;
      break;
    case 'PLACE_SPLIT':
      line = p.join(' + ');
      break;
    case 'COUNT_ON': {
      const [a = 0, b = 0] = p;
      const seq = Array.from({ length: Math.abs(b) + 1 }, (_, i) => a + (b >= 0 ? i : -i));
      line = seq.join(' → ');
      break;
    }
    case 'INVERSE_OP':
      line = `${p[0]} ${(p[2] ?? -1) < 0 ? '−' : '+'} ${p[1]} = ?`;
      break;
    case 'JUMP_STEP':
      line = p.length === 1 ? `${(p[0] ?? 1) > 0 ? '+' : ''}${p[0]}` : p.join('  ·  ');
      break;
    case 'GROUP_SAME':
      line = `${p[0]} × ${p[1]}`;
      break;
  }
  return (
    <div className="text-center">
      <p className="text-2xl font-bold">{ko.hint.strategy[step.strategy]}</p>
      <p className="question-main mt-2 text-4xl">{line}</p>
    </div>
  );
}

export function HintBody({ q, level }: { q: Question; level: number }) {
  const step = q.hintPlan[Math.min(3, Math.max(0, level - 1))];
  if (!step) return null;
  switch (step.kind) {
    case 'visual':
      return (
        <RepresentationView
          kind={step.visual.representation}
          quantities={step.visual.quantities}
          ops={q.ops}
          {...(step.visual.hidden !== undefined ? { hidden: step.visual.hidden } : {})}
        />
      );
    case 'strategy':
      return <StrategyLine step={step} />;
    case 'steps':
      return (
        <div className="flex flex-wrap justify-center gap-4">
          {step.calcs.map((c) =>
            c.mode === 'column' ? (
              <Column
                key={`${c.a}${c.op}${c.b}`}
                a={c.a}
                b={c.b}
                op={c.op}
                columns={c.columns}
                revealUpTo={-1}
              />
            ) : (
              <Column
                key={`${c.a}${c.b}`}
                a={c.a}
                b={c.b}
                op={'-' as Op}
                columns={c.columns}
                revealUpTo={-1}
              />
            ),
          )}
        </div>
      );
    case 'demo': {
      const ex = step.example;
      const shown =
        ex.missingIndex !== undefined && ex.missingIndex >= 0
          ? exprText(ex.operands, ex.ops, ex.missingIndex)
          : exprText(ex.operands, ex.ops);
      return (
        <div className="text-center">
          <p className="question-main text-4xl">
            {shown} → <span className="text-[#22a654]">{ex.answer}</span>
          </p>
          <p className="mt-3 text-2xl font-bold">{ko.hint.yourTurn}</p>
        </div>
      );
    }
  }
}

/** Pair puzzles: target picture → strategy → glowing item in the scene → worked demo. Operands stay hidden. */
function PairHint({ q, level, target, op }: { q: Question; level: number; target: number; op: '+' | '-' }) {
  if (level <= 1)
    return (
      <div className="text-center">
        <Blocks quantities={[target]} />
        <p className="mt-2 text-2xl font-bold">{fmt(ko.hint.pair.target, { t: target })}</p>
      </div>
    );
  if (level === 2)
    return (
      <div className="text-center">
        <p className="text-2xl font-bold">{op === '+' ? ko.hint.pair.sumWay : ko.hint.pair.diffWay}</p>
        <p className="question-main mt-2 text-4xl">
          {op === '+' ? `${target} − ★ = ?` : `★ − ${target} = ?`}
        </p>
      </div>
    );
  if (level === 3) return <p className="text-center text-3xl font-extrabold">✨ {ko.hint.pair.glow}</p>;
  return <HintBody q={q} level={4} />;
}

export function HintPanel({
  q,
  level,
  onMore,
  onClose,
  pair,
}: {
  q: Question;
  level: number;
  onMore(): void;
  onClose(): void;
  pair?: { target: number; op: '+' | '-' } | undefined;
}) {
  const title = ko.hint.step[Math.min(3, level - 1)] ?? ko.hint.title;
  return (
    <div
      className="hint-panel card"
      role="dialog"
      aria-label={ko.hint.title}
      data-testid="hint-panel"
      data-level={level}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xl font-extrabold">
          💡 {title} <span className="text-lg opacity-60">{fmt('{n}/4', { n: level })}</span>
        </p>
        <SpeakButton text={title} />
      </div>
      <div className="mt-3">
        {pair ? (
          <PairHint q={q} level={level} target={pair.target} op={pair.op} />
        ) : (
          <HintBody q={q} level={level} />
        )}
      </div>
      <div className="mt-4 flex justify-end gap-3">
        {level < 4 && (
          <Button onClick={onMore} data-testid="hint-more">
            {ko.hint.more}
          </Button>
        )}
        <Button tone="primary" onClick={onClose} autoFocus>
          {ko.hint.close}
        </Button>
      </div>
    </div>
  );
}
