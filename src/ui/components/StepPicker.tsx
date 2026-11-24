/**
 * The one number-step dial (D61): ① one-digit, ② two-digit with one-digit, ③ two-digit pairs. Shown on the
 * island's top bar and in the settings sheet; a pick is saved with the profile and every stage uses it.
 * Shape + colour: each step shows 1–3 dots and an example sum, not colour alone (P9).
 */
import { useStore } from 'zustand';
import type { GameStore } from '../../application/stores/game';
import { NUMBER_STEPS, type NumberStep } from '../../domain/edu/steps';
import { ko } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import { buzz } from '../../infra/platform/haptics';

export function StepPicker({ store, compact = false }: { store: GameStore; compact?: boolean }) {
  const step = useStore(store, (s) => s.profile?.settings.numberStep ?? 1);
  const pick = (v: NumberStep) => {
    const p = store.getState().profile;
    if (!p || p.settings.numberStep === v) return;
    store.getState().setProfile({ ...p, settings: { ...p.settings, numberStep: v } });
    audio.play('pop', { pitch: 0.9 + v * 0.15 });
    buzz('tap');
  };
  return (
    <fieldset
      className={`step-picker ${compact ? 'step-compact' : ''}`}
      aria-label={ko.hub.step}
      data-testid="number-step"
      data-step={step}
    >
      {NUMBER_STEPS.map((v) => (
        <button
          key={v}
          type="button"
          className={`step-key step-${v} ${step === v ? 'step-on' : ''}`}
          aria-pressed={step === v}
          aria-label={`${v}단계 ${ko.hub.stepNames[v - 1]}`}
          data-testid={`number-step-${v}`}
          onClick={() => pick(v)}
        >
          <span className="step-num">{v}</span>
          <span className="step-dots" aria-hidden="true">
            {'●'.repeat(v)}
          </span>
          {!compact && (
            <span className="step-eg" aria-hidden="true">
              {ko.hub.stepExamples[v - 1]}
            </span>
          )}
        </button>
      ))}
    </fieldset>
  );
}
