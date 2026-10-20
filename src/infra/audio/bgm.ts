/** Procedural BGM presets + seeded pattern generation (SPEC §8.2). Pure data/logic. */
import { createRng } from '../../domain/rng/rng';
import type { Wave } from './sfx';

export type BgmId =
  | 'island'
  | 'fishing'
  | 'bomb'
  | 'slime'
  | 'zombie'
  | 'escape'
  | 'pizza'
  | 'cards'
  | 'race'
  | 'result';

export interface BgmPreset {
  bpm: number;
  root: number; // MIDI note
  scale: readonly number[]; // semitone offsets
  lead: Wave;
  bass: Wave;
  swing: number;
  density: number; // 0..1 melody note probability
}

const MAJOR_PENTA = [0, 2, 4, 7, 9];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MIXO = [0, 2, 4, 5, 7, 9, 10];

export const BGM_PRESETS: Record<BgmId, BgmPreset> = {
  island: {
    bpm: 96,
    root: 60,
    scale: MAJOR_PENTA,
    lead: 'triangle',
    bass: 'sine',
    swing: 0.1,
    density: 0.55,
  },
  fishing: { bpm: 78, root: 62, scale: MAJOR_PENTA, lead: 'sine', bass: 'sine', swing: 0.15, density: 0.4 },
  bomb: { bpm: 112, root: 57, scale: MIXO, lead: 'square', bass: 'triangle', swing: 0, density: 0.5 },
  slime: { bpm: 100, root: 65, scale: LYDIAN, lead: 'triangle', bass: 'sine', swing: 0.2, density: 0.5 },
  zombie: { bpm: 104, root: 55, scale: MIXO, lead: 'triangle', bass: 'square', swing: 0.25, density: 0.45 },
  escape: { bpm: 88, root: 58, scale: LYDIAN, lead: 'sine', bass: 'triangle', swing: 0.05, density: 0.4 },
  pizza: { bpm: 120, root: 62, scale: MAJOR, lead: 'square', bass: 'triangle', swing: 0.2, density: 0.6 },
  cards: { bpm: 92, root: 60, scale: MAJOR, lead: 'triangle', bass: 'sine', swing: 0.1, density: 0.5 },
  race: { bpm: 140, root: 64, scale: MAJOR_PENTA, lead: 'square', bass: 'sawtooth', swing: 0, density: 0.7 },
  result: { bpm: 108, root: 60, scale: MAJOR, lead: 'triangle', bass: 'sine', swing: 0.1, density: 0.6 },
};

export interface BgmStep {
  lead: number | null; // midi
  bass: number | null;
  hat: boolean;
}

/** 4 bars × 16 steps; seed varies the melody so repeats don't tire the ear. */
export function generatePattern(id: BgmId, seed: number | string): BgmStep[] {
  const p = BGM_PRESETS[id];
  const rng = createRng(`bgm-${id}-${seed}`);
  const steps: BgmStep[] = [];
  const chordRoots = [0, 5, 3, 4].map((d) => p.scale[d % p.scale.length] ?? 0); // I–vi–IV–V-ish
  let deg = 2;
  for (let bar = 0; bar < 4; bar++) {
    const chord = chordRoots[bar] ?? 0;
    for (let s = 0; s < 16; s++) {
      const onBeat = s % 4 === 0;
      let lead: number | null = null;
      if (rng.chance(onBeat ? Math.min(1, p.density + 0.25) : p.density * 0.6)) {
        deg = Math.max(0, Math.min(p.scale.length * 2 - 1, deg + rng.int(-2, 2)));
        const oct = Math.floor(deg / p.scale.length);
        lead = p.root + 12 + (p.scale[deg % p.scale.length] ?? 0) + oct * 12;
      }
      const bass =
        s % 8 === 0 ? p.root - 12 + chord : s % 8 === 6 && rng.chance(0.5) ? p.root - 12 + chord + 7 : null;
      steps.push({ lead, bass, hat: s % 2 === 1 && rng.chance(0.7) });
    }
  }
  return steps;
}

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);
