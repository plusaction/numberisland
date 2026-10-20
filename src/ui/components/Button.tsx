import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { audio } from '../../infra/audio/audio';

type Tone = 'primary' | 'secondary' | 'ghost' | 'sun';

const TONES: Record<Tone, string> = {
  primary: 'bg-[var(--color-berry)] text-[var(--color-ink)]',
  secondary: 'bg-[var(--color-cream)] text-[var(--color-ink)]',
  ghost: 'bg-white/70 text-[var(--color-ink)]',
  sun: 'bg-[var(--color-sun)] text-[var(--color-ink)]',
};

/** Big toy button (ART_BIBLE §8): ≥64px, hover lift, press squash, thick focus ring. */
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
      className={`toy-btn ${TONES[tone]} ${big ? 'min-h-20 px-10 text-3xl' : 'min-h-16 px-6 text-2xl'} ${className}`}
    >
      {children}
    </button>
  );
}
