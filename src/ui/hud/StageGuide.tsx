/**
 * Story + guidance bits a stage can ask for through its HUD view (escape room uses all three):
 * - SayBubble: the monster friend's line (big text, read aloud on-device when allowed; tap to tuck it away).
 * - RoomCut: an iris wipe with a big room title while the camera swoops into a new room.
 * - StepGuide: three icon chips — find → think → pick — with the current one lit.
 */
import { useEffect, useState } from 'react';
import { ko } from '../../i18n/ko';
import { speak } from '../../infra/tts/tts';
import type { HudView } from '../../stages/_shared/module';

export function SayBubble({ say, voice }: { say: NonNullable<HudView['say']>; voice: boolean }) {
  const [small, setSmall] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new key re-says the same text (e.g. a second "try again")
  useEffect(() => {
    setSmall(false);
    if (voice) speak(say.text);
    const id = window.setTimeout(() => setSmall(true), 7000);
    return () => window.clearTimeout(id);
  }, [say.key, say.text, voice]);
  return (
    <button
      type="button"
      className={`say-bubble ${small ? 'say-small' : ''}`}
      data-testid="say"
      onClick={() => setSmall((v) => !v)}
      aria-live="polite"
    >
      <span className="say-face" aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="say-text">{say.text}</span>
    </button>
  );
}

export function RoomCut({ cut }: { cut: NonNullable<HudView['cut']> }) {
  return (
    <div key={cut.key} className="room-cut" data-testid="room-cut" aria-live="assertive">
      <div className="room-cut-iris" />
      <p className="room-cut-title">{cut.title}</p>
    </div>
  );
}

const STEP_ICONS = ['🔍', '🤔', '🔒'] as const;

export function StepGuide({ steps }: { steps: NonNullable<HudView['steps']> }) {
  return (
    <ol className="step-guide" data-testid="steps" aria-label={ko.escape.steps.join(' → ')}>
      {ko.escape.steps.map((name, i) => {
        const done = i < steps.at && !(i === 1 && steps.at === 2);
        const now = i === steps.at || (i === 1 && steps.at === 2);
        return (
          <li key={name} className={`step ${now ? 'step-now' : ''} ${done ? 'step-done' : ''}`}>
            <span aria-hidden="true">{done ? '✓' : STEP_ICONS[i]}</span>
            {name}
            {i === 0 && (
              <b className="step-count">
                {steps.found}/{steps.need}
              </b>
            )}
          </li>
        );
      })}
    </ol>
  );
}
