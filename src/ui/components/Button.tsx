import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { audio } from '../../infra/audio/audio';

type Tone = 'primary' | 'secondary' | 'ghost' | 'sun' | 'sea' | 'berry';

/** Molded-plastic key colours (D22): body + a deeper rim of the same hue (see `.toy-btn` in index.css). */
const TONES: Record<Tone, string> = {
  primary: 'key-sun',
  secondary: '',
  ghost: 'key-ghost',
  sun: 'key-sun',
  sea: 'key-sea',
  berry: 'key-berry',
};

/** Big toy key (ART_BIBLE §8): ≥64px, presses down into its rim, double focus ring. */
export function Button({
  tone = 'secondary',
  children,
  className = '',
  big = false,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; big?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => {
        void audio.unlock();
        audio.play('ui.tap');
        onClick?.(e);
      }}
      className={`toy-btn ${TONES[tone]} ${big ? 'min-h-20 px-10 text-[2rem]' : 'min-h-16 px-6 text-[1.6rem]'} ${className}`}
    >
      {children}
    </button>
  );
}
