/**
 * Settings sheet (hub ⚙): the few switches a child or parent needs — music, sound effects, read-aloud,
 * screen shake, reduced motion. Every change applies at once and is saved with the profile (P7: local only).
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { GameStore } from '../../application/stores/game';
import { saveFileName, saveSummary } from '../../application/usecases/savefile';
import type { Profile, Settings } from '../../domain/profile';
import { fmt, ko } from '../../i18n/ko';
import { audio } from '../../infra/audio/audio';
import { blobToProfile, profileToBlob } from '../../infra/storage/savefile';
import type { Store } from '../../infra/storage/store';
import { Button } from './Button';
import { StepPicker } from './StepPicker';

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

const BACKUP = 'backupBeforeImport';

/**
 * 💾 저장: download the profile as a file, open a file to continue from it (after a look at what is in it),
 * and undo the last swap — the record that was replaced is kept on the device, so nothing is ever lost (P2).
 */
function SaveRow({ store, db }: { store: GameStore; db: Store }) {
  const s = ko.settings;
  const [pending, setPending] = useState<Profile | null>(null);
  const [note, setNote] = useState('');
  const [backup, setBackup] = useState<Profile | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    void db.getMeta<Profile>(BACKUP).then((b) => setBackup(b ?? null));
  }, [db]);
  const swapTo = async (next: Profile, msg: string) => {
    const cur = store.getState().profile;
    if (cur) {
      await db.setMeta(BACKUP, cur);
      setBackup(cur);
    }
    await db.putProfile(next);
    await db.setMeta('lastProfile', next.id);
    store.getState().setProfile(next);
    if (!next.placementDone) store.getState().go('placement');
    setNote(msg);
    audio.play('star');
  };
  const download = async () => {
    const p = store.getState().profile;
    if (!p) return;
    const url = URL.createObjectURL(await profileToBlob(p));
    const a = document.createElement('a');
    a.href = url;
    a.download = saveFileName(p, new Date());
    document.body.append(a);
    a.click();
    a.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNote(s.saveDone);
    audio.play('ui.tap');
  };
  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(await blobToProfile(file));
      setNote('');
    } catch {
      setPending(null);
      setNote(s.saveBad);
      audio.play('ui.tap');
    }
  };
  const sum = pending && saveSummary(pending);
  return (
    <div className="save-row" data-testid="save">
      <span>{s.save}</span>
      <div className="save-keys">
        <button type="button" className="seg-btn" onClick={() => void download()} data-testid="save-down">
          {s.saveDown}
        </button>
        <button
          type="button"
          className="seg-btn"
          onClick={() => picker.current?.click()}
          data-testid="save-load"
        >
          {s.saveLoad}
        </button>
        {backup && (
          <button
            type="button"
            className="seg-btn"
            onClick={() => void swapTo(backup, s.saveUndone)}
            data-testid="save-undo"
          >
            {s.saveUndo}
          </button>
        )}
      </div>
      <input
        ref={picker}
        type="file"
        accept=".nisave,.json,application/json,application/gzip"
        hidden
        data-testid="save-file"
        onChange={(e) => {
          void open(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {sum && pending && (
        <div className="save-ask" data-testid="save-ask">
          <p>{s.saveAsk}</p>
          <p className="save-sum">
            {fmt(s.saveSummary, { name: sum.nickname, gems: sum.gems, stars: sum.stars })}
          </p>
          <div className="save-keys">
            <button
              type="button"
              className="seg-btn seg-on"
              data-testid="save-yes"
              onClick={() => {
                const next = pending;
                setPending(null);
                void swapTo(next, s.saveLoaded);
              }}
            >
              {s.saveYes}
            </button>
            <button type="button" className="seg-btn" data-testid="save-no" onClick={() => setPending(null)}>
              {s.saveNo}
            </button>
          </div>
        </div>
      )}
      {note && (
        <p className="save-note" role="status" data-testid="save-note">
          {note}
        </p>
      )}
    </div>
  );
}

export function SettingsSheet({ store, db, onClose }: { store: GameStore; db?: Store; onClose(): void }) {
  const settings = useStore(store, (s) => s.profile?.settings);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const sheet = useRef<HTMLElement | null>(null);
  // focus starts on the close key (one press to leave) without scrolling a tall sheet down to it:
  // on a short phone the title and the first switches stay in view
  const closeKey = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeKey.current?.focus({ preventScroll: true });
  }, []);
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
    // the dim backdrop closes the sheet (Esc and the close key do too)
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
        <div className="sheet-row">
          <span>{s.step}</span>
          <StepPicker store={store} compact />
        </div>
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
        <Seg<Settings['restMinutes']>
          label={s.rest}
          testid="set-rest"
          value={settings.restMinutes === 0 ? 0 : settings.restMinutes >= 30 ? 30 : 15}
          options={[
            { v: 0, name: s.off },
            { v: 15, name: s.min15 },
            { v: 30, name: s.min30 },
          ]}
          onPick={(restMinutes) => set({ restMinutes })}
        />
        <Seg
          label={s.haptics}
          testid="set-haptics"
          value={settings.haptics}
          options={[
            { v: false, name: s.off },
            { v: true, name: s.on },
          ]}
          onPick={(haptics) => set({ haptics })}
        />
        {db && <SaveRow store={store} db={db} />}
        <div className="mt-5 flex justify-end">
          <Button tone="primary" ref={closeKey} onClick={onClose} data-testid="settings-close">
            {s.close}
          </Button>
        </div>
      </section>
    </div>
  );
}
