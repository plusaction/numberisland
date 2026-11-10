/**
 * Settings sheet (hub ⚙): the few switches a child or parent needs — music, sound effects, read-aloud,
 * screen shake, reduced motion. Every change applies at once and is saved with the profile (P7: local only).
 */
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { GameStore } from '../../application/stores/game';
import type { Settings } from '../../domain/profile';
import { ko } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import { Button } from './Button';

function Seg<T extends string | number | boolean>({
  label,
  value,
  options,
  onPick,
  testid,
}: {
  label: string;
  value: T;
  options: readonly { v: T; name: string }[];
  onPick(v: T): void;
  testid: string;
}) {
  return (
    <div className="sheet-row">
      <span>{label}</span>
      <fieldset className="seg" aria-label={label} data-testid={testid}>
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={value === o.v}
            className={`seg-btn ${value === o.v ? 'seg-on' : ''}`}
            onClick={() => {
              onPick(o.v);
              audio.play('ui.tap');
            }}
          >
            {o.name}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** Nearest listed option (saved values may sit between the steps). */
const nearest = (v: number, steps: readonly number[]) =>
  steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

export function SettingsSheet({ store, onClose }: { store: GameStore; onClose(): void }) {
  const settings = useStore(store, (s) => s.profile?.settings);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const sheet = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeRef.current();
      if (e.code !== 'Tab' || !sheet.current) return;
      // Tab stays inside the sheet (wraps at both ends)
      const keys = [...sheet.current.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      const first = keys[0];
      const last = keys.at(-1);
      if (!first || !last) return;
      const at = document.activeElement;
      if (e.shiftKey && (at === first || !sheet.current.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !sheet.current.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!settings) return null;
  const set = (patch: Partial<Settings>) => {
    const p = store.getState().profile;
    if (p) store.getState().setProfile({ ...p, settings: { ...p.settings, ...patch } });
  };
  const s = ko.settings;
  const level = [
    { v: 0, name: s.off },
    { v: 0.25, name: s.low },
    { v: 0.5, name: s.mid },
  ] as const;
  const sfx = [
    { v: 0, name: s.off },
    { v: 0.4, name: s.low },
    { v: 0.8, name: s.mid },
  ] as const;
  const shake = [
    { v: 0, name: s.off },
    { v: 0.25, name: s.weak },
    { v: 0.5, name: s.mid },
  ] as const;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the dim backdrop closes the sheet (Esc and the button do too)
    <div
      className="sheet-back"
      role="presentation"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={sheet}
        className="sheet card"
        role="dialog"
        aria-modal="true"
        aria-label={s.title}
        data-testid="settings"
      >
        <h2 className="stage-name">{s.title}</h2>
        <Seg
          label={s.music}
          testid="set-music"
          value={nearest(settings.volumes.bgm, [0, 0.25, 0.5])}
          options={level}
          onPick={(bgm) => set({ volumes: { ...settings.volumes, bgm } })}
        />
        <Seg
          label={s.sfx}
          testid="set-sfx"
          value={nearest(settings.volumes.sfx, [0, 0.4, 0.8])}
          options={sfx}
          onPick={(v) => set({ volumes: { ...settings.volumes, sfx: v, voice: v } })}
        />
        <Seg
          label={s.tts}
          testid="set-tts"
          value={settings.tts}
          options={[
            { v: false, name: s.off },
            { v: true, name: s.on },
          ]}
          onPick={(tts) => set({ tts })}
        />
        <Seg
          label={s.shake}
          testid="set-shake"
          value={nearest(settings.shakeIntensity, [0, 0.25, 0.5])}
          options={shake}
          onPick={(shakeIntensity) => set({ shakeIntensity })}
        />
        <Seg<boolean | 'system'>
          label={s.motion}
          testid="set-motion"
          value={settings.reducedMotion === true ? true : 'system'}
          options={[
            { v: 'system', name: s.auto },
            { v: true, name: s.on },
          ]}
          onPick={(reducedMotion) => set({ reducedMotion })}
        />
        <div className="mt-5 flex justify-end">
          <Button tone="primary" autoFocus onClick={onClose} data-testid="settings-close">
            {s.close}
          </Button>
        </div>
      </section>
    </div>
  );
}
