/** Sound recipes (docs/SOUND_LIST.md). Pure data: oscillator notes with envelopes. */
export type Wave = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface Note {
  /** Start offset in seconds. */
  at: number;
  freq: number;
  /** End frequency for slides. */
  to?: number;
  dur: number;
  wave: Wave;
  gain: number;
  /** Add filtered noise instead of a tone. */
  noise?: boolean;
}

export type SfxId =
  | 'ui.tap'
  | 'ui.back'
  | 'correct'
  | 'correct.big'
  | 'wrong.duck'
  | 'wrong.boing'
  | 'wrong.pfft'
  | 'coin'
  | 'star'
  | 'splash'
  | 'reel'
  | 'snip'
  | 'gift'
  | 'merge'
  | 'pop'
  | 'slime.split'
  | 'firework'
  | 'levelup'
  | 'whoosh'
  | 'fuse'
  | 'boom';

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export const SFX: Record<SfxId, Note[]> = {
  'ui.tap': [{ at: 0, freq: 880, to: 990, dur: 0.06, wave: 'sine', gain: 0.25 }],
  'ui.back': [{ at: 0, freq: 660, to: 520, dur: 0.08, wave: 'sine', gain: 0.22 }],
  correct: [
    { at: 0, freq: C5, dur: 0.12, wave: 'triangle', gain: 0.26 },
    { at: 0.09, freq: E5, dur: 0.12, wave: 'triangle', gain: 0.26 },
    { at: 0.18, freq: G5, dur: 0.22, wave: 'triangle', gain: 0.28 },
  ],
  'correct.big': [
    { at: 0, freq: C5, dur: 0.1, wave: 'triangle', gain: 0.26 },
    { at: 0.08, freq: E5, dur: 0.1, wave: 'triangle', gain: 0.26 },
    { at: 0.16, freq: G5, dur: 0.1, wave: 'triangle', gain: 0.26 },
    { at: 0.24, freq: C6, dur: 0.35, wave: 'triangle', gain: 0.3 },
  ],
  'wrong.duck': [
    { at: 0, freq: 520, to: 760, dur: 0.12, wave: 'square', gain: 0.12 },
    { at: 0.13, freq: 480, to: 700, dur: 0.14, wave: 'square', gain: 0.12 },
  ],
  'wrong.boing': [{ at: 0, freq: 180, to: 420, dur: 0.35, wave: 'sine', gain: 0.35 }],
  'wrong.pfft': [{ at: 0, freq: 300, dur: 0.3, wave: 'sine', gain: 0.18, noise: true }],
  coin: [
    { at: 0, freq: 1318, dur: 0.06, wave: 'square', gain: 0.1 },
    { at: 0.06, freq: 1760, dur: 0.16, wave: 'square', gain: 0.1 },
  ],
  star: [
    { at: 0, freq: 1568, dur: 0.18, wave: 'sine', gain: 0.22 },
    { at: 0.05, freq: 2093, dur: 0.25, wave: 'sine', gain: 0.18 },
  ],
  splash: [
    { at: 0, freq: 900, dur: 0.25, wave: 'sine', gain: 0.25, noise: true },
    { at: 0.02, freq: 400, to: 1200, dur: 0.12, wave: 'sine', gain: 0.12 },
  ],
  reel: [{ at: 0, freq: 300, to: 900, dur: 0.4, wave: 'triangle', gain: 0.12 }],
  snip: [
    { at: 0, freq: 3000, dur: 0.05, wave: 'sine', gain: 0.18, noise: true },
    { at: 0.05, freq: 1200, to: 600, dur: 0.08, wave: 'triangle', gain: 0.18 },
  ],
  gift: [
    { at: 0, freq: G5, dur: 0.1, wave: 'triangle', gain: 0.25 },
    { at: 0.1, freq: C6, dur: 0.1, wave: 'triangle', gain: 0.25 },
    { at: 0.2, freq: E5 * 2, dur: 0.3, wave: 'sine', gain: 0.25 },
  ],
  merge: [{ at: 0, freq: 220, to: 660, dur: 0.25, wave: 'sine', gain: 0.3 }],
  pop: [{ at: 0, freq: 700, to: 200, dur: 0.09, wave: 'sine', gain: 0.3 }],
  'slime.split': [
    { at: 0, freq: 500, to: 900, dur: 0.07, wave: 'sine', gain: 0.2 },
    { at: 0.07, freq: 600, to: 1000, dur: 0.07, wave: 'sine', gain: 0.2 },
  ],
  // cartoon "kaboom": soft low thump + noise burst + a silly falling slide (loud but never harsh)
  boom: [
    { at: 0, freq: 90, to: 40, dur: 0.45, wave: 'sine', gain: 0.4, noise: false },
    { at: 0, freq: 400, dur: 0.5, wave: 'sine', gain: 0.28, noise: true },
    { at: 0.35, freq: 700, to: 220, dur: 0.4, wave: 'triangle', gain: 0.12 },
  ],
  firework: [
    { at: 0, freq: 200, to: 1400, dur: 0.45, wave: 'triangle', gain: 0.12 },
    { at: 0.45, freq: 200, dur: 0.5, wave: 'sine', gain: 0.3, noise: true },
  ],
  levelup: [
    { at: 0, freq: C5, dur: 0.12, wave: 'square', gain: 0.1 },
    { at: 0.12, freq: E5, dur: 0.12, wave: 'square', gain: 0.1 },
    { at: 0.24, freq: G5, dur: 0.12, wave: 'square', gain: 0.1 },
    { at: 0.36, freq: C6, dur: 0.4, wave: 'triangle', gain: 0.3 },
  ],
  whoosh: [{ at: 0, freq: 1500, dur: 0.3, wave: 'sine', gain: 0.12, noise: true }],
  fuse: [{ at: 0, freq: 4000, dur: 0.4, wave: 'sine', gain: 0.04, noise: true }],
};

/** Peak estimate (sum of simultaneous note gains) — used by tests to guarantee no clipping. */
export function peakGain(notes: readonly Note[]): number {
  let peak = 0;
  for (const n of notes) {
    const overlap = notes
      .filter((m) => m.at < n.at + n.dur && n.at < m.at + m.dur)
      .reduce((s, m) => s + m.gain, 0);
    peak = Math.max(peak, overlap);
  }
  return peak;
}
