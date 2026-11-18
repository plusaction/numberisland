/**
 * Background music (SPEC §8.2): a tiny tracker. Each game mode has its own composed 8-bar song — its own
 * groove, chords, bass line, melody and instruments — instead of one random noodle at different tempos.
 * All synthesised (no audio files, P1). Pure data + a pure step expander (tested); `audio.ts` plays it.
 *
 * Pattern strings are one bar each (`steps` characters):
 * - drums: `x` hit, `o` soft hit, `.` rest
 * - bass: `1` chord root, `3` third, `5` fifth, `8` octave, `b` a step below the root (walking), `.` rest
 * - arp / stab: `0`–`3` chord tone (3 = root an octave up), `.` rest
 * - pad: `x` = play the bar's chord here (held until the next `x` or the bar end)
 * - melody: `1`–`7` scale degree, `a`–`g` the same an octave up, `-` hold, `.` rest
 */
import { createRng } from '../../domain/rng/rng';

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

export type Instrument =
  | 'pluck' // ukulele / pizzicato: bright attack, quick decay
  | 'bell' // music box / glockenspiel: sine + inharmonic partial, long ring
  | 'marimba' // wooden: sine + octave knock, short
  | 'pad' // two detuned saws through a soft filter, slow attack
  | 'organ' // squares with a little detune: accordion / funfair organ
  | 'lead' // square with vibrato
  | 'bass' // round triangle bass
  | 'wobble' // squelchy filtered bass with a downward bend (slime, zombie)
  | 'kick'
  | 'snare'
  | 'hat'
  | 'clap'
  | 'shaker'
  | 'tick'; // clock tick (bomb)

export type PartKind = 'drum' | 'bass' | 'arp' | 'pad' | 'melody';

export interface Part {
  kind: PartKind;
  inst: Instrument;
  gain: number;
  /** One string per bar (shorter lists repeat). */
  bars: readonly string[];
  /** Octave shift (melody/arp/pad are around the root's octave above middle C, bass two below). */
  octave?: number;
}

export interface Song {
  bpm: number;
  /** Steps per bar: 16 (4/4 in 16ths) or 12 (6/8 in 8ths, waltzes and tarantellas). */
  steps: 12 | 16;
  /** 0..0.5: how late the off-beat steps are. */
  swing: number;
  /** MIDI note of the key (tonic). */
  root: number;
  scale: readonly number[];
  /** Chord per bar as a scale degree (0-based), 8 bars. */
  chords: readonly number[];
  parts: readonly Part[];
  /** Seeded variation: chance that a melody note gets a neighbour-note ornament on repeats. */
  ornament: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MIXO = [0, 2, 4, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const HARM_MINOR = [0, 2, 3, 5, 7, 8, 11];

export const SONGS: Record<BgmId, Song> = {
  // a sunny ukulele stroll round the island
  island: {
    bpm: 100,
    steps: 16,
    swing: 0.12,
    root: 60,
    scale: MAJOR,
    chords: [0, 4, 5, 3, 0, 4, 3, 4],
    ornament: 0.15,
    parts: [
      { kind: 'drum', inst: 'kick', gain: 0.44, bars: ['x.......x.......'] },
      { kind: 'drum', inst: 'shaker', gain: 0.12, bars: ['..x...x...x...xo'] },
      { kind: 'drum', inst: 'clap', gain: 0.18, bars: ['....x.......x...'] },
      { kind: 'bass', inst: 'bass', gain: 0.32, bars: ['1.....5.1...5...'] },
      { kind: 'arp', inst: 'pluck', gain: 0.13, bars: ['0.1.2.1.0.1.2.1.'] },
      {
        kind: 'melody',
        inst: 'bell',
        gain: 0.16,
        bars: [
          '3---5---6-5-3---',
          '2---4---5-4-2---',
          '1---3---6-5-3-1-',
          '2-------........',
          '3---5---c---a---',
          'b-a-5---4---3---',
          '4---6---5-4-3-2-',
          '1-------........',
        ],
      },
    ],
  },
  // a calm waltz by the pond: marimba ripples over a soft pad, a water-drop bell now and then
  fishing: {
    bpm: 76,
    steps: 12,
    swing: 0,
    root: 62,
    scale: MAJOR,
    chords: [0, 3, 0, 4, 5, 3, 4, 0],
    ornament: 0.1,
    parts: [
      { kind: 'pad', inst: 'pad', gain: 0.07, bars: ['x...........'] },
      { kind: 'bass', inst: 'bass', gain: 0.28, bars: ['1.....5.....'] },
      { kind: 'arp', inst: 'marimba', gain: 0.14, bars: ['..1.2...1.2.', '..2.3...2.1.'] },
      {
        kind: 'melody',
        inst: 'bell',
        gain: 0.14,
        bars: [
          '5-----3-----',
          '6---5-4-----',
          '3-----1-----',
          '2-----------',
          '5-----c-----',
          'a---6-4-----',
          '5---4-2-----',
          '1-----......',
        ],
      },
      { kind: 'drum', inst: 'shaker', gain: 0.06, bars: ['......o.....'] },
    ],
  },
  // tick-tock: a cute but tense pizzicato over a ticking clock, the line climbs like a fuse
  bomb: {
    bpm: 116,
    steps: 16,
    swing: 0,
    root: 57,
    scale: DORIAN,
    chords: [0, 0, 3, 4, 0, 0, 5, 4],
    ornament: 0.1,
    parts: [
      { kind: 'drum', inst: 'tick', gain: 0.12, bars: ['x.o.x.o.x.o.x.o.'] },
      { kind: 'drum', inst: 'kick', gain: 0.45, bars: ['x.....x.x.......'] },
      { kind: 'drum', inst: 'snare', gain: 0.16, bars: ['....x.......x...'] },
      { kind: 'bass', inst: 'bass', gain: 0.3, bars: ['1.1.5.1.1.1.5.b.'] },
      {
        kind: 'melody',
        inst: 'pluck',
        gain: 0.15,
        bars: [
          '1.3.5.3.1.3.5.3.',
          '1.3.5.6.5.3.1...',
          '4.6.a.6.4.6.a.6.',
          '5.7.b.7.5---....',
          '1.3.5.3.1.3.5.3.',
          '3.5.6.a.6.5.3...',
          '6.a.c.a.6.a.c.a.',
          '5.6.7.b.5---....',
        ],
      },
    ],
  },
  // boing-boing: a squelchy jelly bass with slides and a skipping melody
  slime: {
    bpm: 104,
    steps: 16,
    swing: 0.22,
    root: 65,
    scale: LYDIAN,
    chords: [0, 1, 0, 4, 0, 1, 5, 4],
    ornament: 0.18,
    parts: [
      { kind: 'drum', inst: 'kick', gain: 0.45, bars: ['x...x...x...x...'] },
      { kind: 'drum', inst: 'hat', gain: 0.06, bars: ['..x...x...x...x.'] },
      { kind: 'drum', inst: 'clap', gain: 0.16, bars: ['....x.......x..o'] },
      { kind: 'bass', inst: 'wobble', gain: 0.3, bars: ['1..1..5.1..8..5.'] },
      {
        kind: 'melody',
        inst: 'lead',
        gain: 0.1,
        bars: [
          '5.5.3-..6.5.3...',
          '2.2.4-..5.4.2...',
          '5.5.3-..a.6.5...',
          '4---3---2---....',
          '5.5.3-..6.5.3...',
          '6.6.a-..c.a.6...',
          '5.4.3.2.4.3.2.1.',
          '1---........5.5.',
        ],
      },
    ],
  },
  // a silly-spooky monster march: walking bass, funfair organ, claps on 2 and 4 — never scary
  zombie: {
    bpm: 100,
    steps: 16,
    swing: 0.3,
    root: 55,
    scale: HARM_MINOR,
    chords: [0, 0, 3, 4, 0, 5, 3, 4],
    ornament: 0.12,
    parts: [
      { kind: 'drum', inst: 'kick', gain: 0.45, bars: ['x.......x.......'] },
      { kind: 'drum', inst: 'clap', gain: 0.2, bars: ['....x.......x...'] },
      { kind: 'drum', inst: 'hat', gain: 0.05, bars: ['x.x.x.x.x.x.x.x.'] },
      { kind: 'bass', inst: 'wobble', gain: 0.3, bars: ['1...3...5...b...'] },
      { kind: 'arp', inst: 'organ', gain: 0.06, bars: ['..0...12..0...12'] },
      {
        kind: 'melody',
        inst: 'organ',
        gain: 0.1,
        bars: [
          '5---6-5-4-3-2---',
          '1---2-3-5-------',
          '4---5-4-3-2-1---',
          '7---------......',
          '5---6-5-4-3-2---',
          'a---6-5-6-7-a---',
          '6---5-4-3-2-7---',
          '1---------......',
        ],
      },
    ],
  },
  // a mysterious music box in a quiet room: bells, a soft pad, almost no drums
  escape: {
    bpm: 84,
    steps: 16,
    swing: 0.05,
    root: 58,
    scale: LYDIAN,
    chords: [0, 1, 0, 1, 5, 4, 1, 4],
    ornament: 0.08,
    parts: [
      { kind: 'pad', inst: 'pad', gain: 0.07, bars: ['x...............'] },
      { kind: 'bass', inst: 'bass', gain: 0.22, bars: ['1.......5.......'] },
      { kind: 'arp', inst: 'bell', gain: 0.08, bars: ['0...2...3...2...'] },
      {
        kind: 'melody',
        inst: 'bell',
        gain: 0.13,
        bars: [
          '5.....4.3.......',
          '2.....3.4.......',
          '5.....c.a.......',
          '6---------......',
          '5.....4.3.......',
          '2.....4.6.......',
          '5.....4.2.......',
          '1---------......',
        ],
      },
      { kind: 'drum', inst: 'shaker', gain: 0.05, bars: ['........o.......'] },
    ],
  },
  // a quick tarantella: accordion oom-pah, tambourine jingles, a twirling melody
  pizza: {
    bpm: 132,
    steps: 12,
    swing: 0,
    root: 62,
    scale: MIXO,
    chords: [0, 0, 4, 4, 3, 0, 4, 0],
    ornament: 0.15,
    parts: [
      { kind: 'drum', inst: 'kick', gain: 0.42, bars: ['x.....x.....'] },
      { kind: 'drum', inst: 'shaker', gain: 0.1, bars: ['..x.x...x.xo'] },
      { kind: 'bass', inst: 'bass', gain: 0.28, bars: ['1.....5.....'] },
      { kind: 'arp', inst: 'organ', gain: 0.07, bars: ['..012...012.'] },
      {
        kind: 'melody',
        inst: 'pluck',
        gain: 0.15,
        bars: [
          '3.4.5.c.b.a.',
          '5.4.3.2.3.4.',
          '5.6.7.b.a.7.',
          '5---4-3-----',
          '3.4.5.c.b.a.',
          '6.5.4.6.5.4.',
          '5.4.3.4.2.7.',
          '1-----......',
        ],
      },
    ],
  },
  // a game-show groove: clapping, a slap-ish bass, bright electric-piano bells
  cards: {
    bpm: 108,
    steps: 16,
    swing: 0.18,
    root: 60,
    scale: MIXO,
    chords: [0, 3, 0, 4, 0, 3, 5, 4],
    ornament: 0.12,
    parts: [
      { kind: 'drum', inst: 'kick', gain: 0.4, bars: ['x..x....x.x.....'] },
      { kind: 'drum', inst: 'snare', gain: 0.17, bars: ['....x.......x...'] },
      { kind: 'drum', inst: 'hat', gain: 0.06, bars: ['x.x.x.xox.x.x.xo'] },
      { kind: 'bass', inst: 'bass', gain: 0.32, bars: ['1..8..1.5..1.b..'] },
      { kind: 'pad', inst: 'bell', gain: 0.06, bars: ['..x.....x.......'] },
      {
        kind: 'melody',
        inst: 'lead',
        gain: 0.09,
        bars: [
          '5-5-6-5-3-------',
          '4-4-5-4-2-------',
          '5-5-6-5-c---a---',
          'b---------......',
          '5-5-6-5-3-------',
          '6-6-7-6-4-------',
          '5-4-3-2-3-5-6-7-',
          'a---------......',
        ],
      },
    ],
  },
  // full speed: four-on-the-floor, pumping octave bass, a racing arpeggio and a heroic line
  race: {
    bpm: 144,
    steps: 16,
    swing: 0,
    root: 64,
    scale: MAJOR,
    chords: [0, 5, 3, 4, 0, 5, 3, 4],
    ornament: 0.08,
    parts: [
      { kind: 'drum', inst: 'kick', gain: 0.5, bars: ['x...x...x...x...'] },
      { kind: 'drum', inst: 'snare', gain: 0.17, bars: ['....x.......x...'] },
      { kind: 'drum', inst: 'hat', gain: 0.07, bars: ['..x...x...x...x.'] },
      { kind: 'bass', inst: 'bass', gain: 0.3, bars: ['18181818181818b8'] },
      { kind: 'arp', inst: 'pluck', gain: 0.09, bars: ['0123012301230123'] },
      {
        kind: 'melody',
        inst: 'lead',
        gain: 0.1,
        bars: [
          '5-------6---7---',
          'a-------7-6-5---',
          '6-------5---4---',
          '5---------------',
          '5-------6---7---',
          'a-------c---b---',
          'a---7---6---7---',
          'a---------------',
        ],
      },
    ],
  },
  // the result fanfare: brassy organ chords and a bouncy victory tune
  result: {
    bpm: 112,
    steps: 16,
    swing: 0.1,
    root: 60,
    scale: MAJOR,
    chords: [0, 3, 4, 0, 0, 3, 4, 0],
    ornament: 0.1,
    parts: [
      { kind: 'drum', inst: 'kick', gain: 0.45, bars: ['x.......x.x.....'] },
      { kind: 'drum', inst: 'snare', gain: 0.15, bars: ['....x.......x..o'] },
      { kind: 'bass', inst: 'bass', gain: 0.3, bars: ['1...5...1...5...'] },
      { kind: 'pad', inst: 'organ', gain: 0.05, bars: ['x.......x.......'] },
      {
        kind: 'melody',
        inst: 'bell',
        gain: 0.15,
        bars: [
          '1-3-5---c---a---',
          '6-a-c---a-------',
          '7-b-d---b-5-----',
          'c---------------',
          '1-3-5---c---a---',
          '6-a-c---a---6---',
          '5-7-b---5---7---',
          'c---------------',
        ],
      },
    ],
  },
};

/** One sound in the loop (time in steps from the loop start). */
export interface BgmEvent {
  step: number;
  inst: Instrument;
  /** MIDI note (drums: unused, 0). */
  midi: number;
  /** Length in steps. */
  len: number;
  gain: number;
}

const degreeToMidi = (song: Song, deg: number, octave: number) => {
  const n = song.scale.length;
  const o = Math.floor(deg / n);
  const d = ((deg % n) + n) % n;
  return song.root + (song.scale[d] ?? 0) + 12 * (o + octave);
};

/** Chord tones (as scale degrees) of the chord built on `deg`: root, third, fifth, octave. */
const chordDegrees = (deg: number) => [deg, deg + 2, deg + 4, deg + 7];

/**
 * The whole 8-bar loop as events. `seed` adds a little ornamentation on some melody notes so long sessions
 * do not repeat note-for-note (same seed = same music).
 */
export function expandSong(id: BgmId, seed: number | string): BgmEvent[] {
  const song = SONGS[id];
  const rng = createRng(`bgm-${id}-${seed}`);
  const out: BgmEvent[] = [];
  const S = song.steps;
  for (let bar = 0; bar < song.chords.length; bar++) {
    const chord = song.chords[bar] ?? 0;
    const tones = chordDegrees(chord);
    for (const part of song.parts) {
      const pat = part.bars[bar % part.bars.length] ?? '';
      const oct = part.octave ?? 0;
      for (let s = 0; s < S; s++) {
        const c = pat[s] ?? '.';
        if (c === '.' || c === '-') continue;
        const step = bar * S + s;
        // held length: count the following '-'
        let len = 1;
        while (pat[s + len] === '-') len++;
        switch (part.kind) {
          case 'drum':
            out.push({
              step,
              inst: part.inst,
              midi: 0,
              len: 1,
              gain: c === 'o' ? part.gain * 0.5 : part.gain,
            });
            break;
          case 'bass': {
            const deg =
              c === '1'
                ? tones[0]
                : c === '3'
                  ? tones[1]
                  : c === '5'
                    ? tones[2]
                    : c === '8'
                      ? (tones[0] ?? 0) + 7
                      : (tones[0] ?? 0) - 1;
            out.push({
              step,
              inst: part.inst,
              midi: degreeToMidi(song, deg ?? 0, -2 + oct),
              len: Math.max(len, 2),
              gain: part.gain,
            });
            break;
          }
          case 'arp': {
            const deg = tones[Number(c)] ?? tones[0] ?? 0;
            out.push({ step, inst: part.inst, midi: degreeToMidi(song, deg, oct), len: 1, gain: part.gain });
            break;
          }
          case 'pad': {
            // until the next 'x' or the end of the bar
            let hold = 1;
            while (s + hold < S && pat[s + hold] !== 'x') hold++;
            for (const deg of tones.slice(0, 3))
              out.push({
                step,
                inst: part.inst,
                midi: degreeToMidi(song, deg, oct),
                len: hold,
                gain: part.gain,
              });
            break;
          }
          case 'melody': {
            const up = c >= 'a' && c <= 'g';
            const deg = (up ? c.charCodeAt(0) - 97 : Number(c) - 1) + (up ? 7 : 0);
            const midi = degreeToMidi(song, deg, 1 + oct);
            // on the second half of the loop now and then a quick grace note from above
            if (bar >= 4 && len >= 2 && rng.chance(song.ornament)) {
              out.push({
                step,
                inst: part.inst,
                midi: degreeToMidi(song, deg + 1, 1 + oct),
                len: 1,
                gain: part.gain * 0.7,
              });
              out.push({ step: step + 1, inst: part.inst, midi, len: len - 1, gain: part.gain });
            } else out.push({ step, inst: part.inst, midi, len, gain: part.gain });
            break;
          }
        }
      }
    }
  }
  // mastering: if the loudest moment (everything starting on one step) is over the headroom, the whole
  // song is turned down evenly — the balance between the parts stays as written
  const per = new Map<number, number>();
  for (const e of out) per.set(e.step, (per.get(e.step) ?? 0) + e.gain);
  const peak = Math.max(0, ...per.values());
  if (peak > HEADROOM) for (const e of out) e.gain *= HEADROOM / peak;
  return out.sort((a, b) => a.step - b.step);
}

/** The most gain allowed to start on one step (the BGM bus is mixed far below the effects). */
export const HEADROOM = 1;

/** Loop length in steps and seconds per step. */
export const songTiming = (id: BgmId) => {
  const s = SONGS[id];
  const beatsPerBar = s.steps === 12 ? 2 : 4; // 6/8: two dotted beats; 4/4: four
  const stepsPerBeat = s.steps / beatsPerBar;
  return { loop: s.steps * s.chords.length, stepDur: 60 / s.bpm / stepsPerBeat, swing: s.swing };
};

export const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);
