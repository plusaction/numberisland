import { describe, expect, it } from 'vitest';
import { type BgmId, expandSong, SONGS, songTiming } from '../../src/infra/audio/bgm';
import { peakGain, SFX, type SfxId } from '../../src/infra/audio/sfx';

describe('[F4] 사운드 레시피', () => {
  it('no recipe can clip (summed simultaneous gain ≤ 0.9) and every SOUND_LIST id exists', async () => {
    const { readFileSync } = await import('node:fs');
    const doc = readFileSync('docs/SOUND_LIST.md', 'utf8');
    for (const id of Object.keys(SFX) as SfxId[]) {
      expect(peakGain(SFX[id]), id).toBeLessThanOrEqual(0.9);
      expect(doc.includes(id), `${id} documented`).toBe(true);
    }
  });
  it('every mode has its own song: deterministic per seed, in range, full loop, and not a copy of another', () => {
    const sigs = new Set<string>();
    for (const id of Object.keys(SONGS) as BgmId[]) {
      const a = expandSong(id, 1);
      expect(a).toEqual(expandSong(id, 1));
      const { loop, stepDur } = songTiming(id);
      expect(loop).toBe(SONGS[id].steps * 8);
      expect(stepDur).toBeGreaterThan(0.05);
      expect(stepDur).toBeLessThan(0.3);
      for (const e of a) {
        expect(e.step).toBeGreaterThanOrEqual(0);
        expect(e.step).toBeLessThan(loop);
        if (e.midi) {
          expect(e.midi).toBeGreaterThanOrEqual(24);
          expect(e.midi).toBeLessThanOrEqual(100);
        }
      }
      // melody + drums actually present
      expect(a.some((e) => ['kick', 'tick', 'shaker'].includes(e.inst))).toBe(true);
      expect(a.filter((e) => e.len >= 1 && e.midi > 0).length).toBeGreaterThan(20);
      sigs.add(
        `${SONGS[id].bpm}|${SONGS[id].steps}|${a
          .filter((e) => e.midi)
          .slice(0, 12)
          .map((e) => e.midi)
          .join(',')}`,
      );
    }
    expect(sigs.size).toBe(Object.keys(SONGS).length);
  });

  it('BGM never piles up into clipping: the sounds starting on any one step stay under the bus headroom', () => {
    for (const id of Object.keys(SONGS) as BgmId[]) {
      const per = new Map<number, number>();
      for (const e of expandSong(id, 7)) per.set(e.step, (per.get(e.step) ?? 0) + e.gain);
      expect(Math.max(...per.values()), id).toBeLessThanOrEqual(1.0001);
    }
  });
});
