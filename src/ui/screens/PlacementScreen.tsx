/** "괴물 친구 만나기" placement (SPEC §9.4): 3–5 questions decide the start level. */
import { useMemo, useState } from 'react';
import type { AdaptiveSettings } from '../../domain/edu/adaptive';
import { generateQuestion } from '../../domain/edu/generate';
import { placementAnswer, startPlacement } from '../../domain/edu/placement';
import type { LevelId } from '../../domain/edu/types';
import { createRng } from '../../domain/rng/rng';
import { ko } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import { SpeakButton } from '../components/SpeakButton';
import { ChoiceCross } from '../question/ChoiceCross';
import { questionText } from '../question/format';
import { PlaceDigits } from '../question/PlaceDigits';

export function PlacementScreen({
  settings,
  seed,
  onDone,
}: {
  settings: AdaptiveSettings;
  seed: string;
  onDone(level: LevelId): void;
}) {
  const rng = useMemo(() => createRng(`placement-${seed}`), [seed]);
  const [state, setState] = useState(() => startPlacement(settings));
  const [_n, setN] = useState(0);
  const question = useMemo(() => generateQuestion({ level: state.current, rng }), [state.current, rng]);
  const text = questionText(question);
  const pick = (v: number) => {
    const ok = v === question.answer;
    audio.play(ok ? 'correct' : 'wrong.boing');
    const next = placementAnswer(state, ok, settings);
    if (next.done && next.result) onDone(next.result);
    else {
      setState(next);
      setN((x) => x + 1);
    }
  };
  return (
    <div className="screen-center">
      <div className="card w-full max-w-3xl text-center" data-testid="placement">
        <p className="text-2xl font-bold">{ko.welcome.meet}</p>
        <p className="text-xl">{ko.welcome.meetHint}</p>
        {text.pre && <p className="mt-4 text-3xl font-bold">{text.pre}</p>}
        <p className="question-main mt-4" data-testid="question-main">
          {question.form === 'PLACE' && question.target !== undefined ? (
            <PlaceDigits n={question.operands[0] ?? 0} place={question.target} />
          ) : (
            text.main
          )}
        </p>
        {text.prompt !== text.main && (
          <p className="mt-2 text-2xl font-bold" data-testid="question-prompt">
            {text.prompt}
          </p>
        )}
        <SpeakButton text={text.prompt} className="mx-auto my-3" />
        <ChoiceCross choices={question.choices} onPick={pick} />
      </div>
    </div>
  );
}
