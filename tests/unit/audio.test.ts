import { describe, expect, it } from 'vitest';
import { BGM_PRESETS, type BgmId, generatePattern } from '../../src/infra/audio/bgm';
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
  it('BGM patterns are deterministic per seed and vary between seeds', () => {
    for (const id of Object.keys(BGM_PRESETS) as BgmId[]) {
      expect(generatePattern(id, 1)).toEqual(generatePattern(id, 1));
      expect(generatePattern(id, 1)).not.toEqual(generatePattern(id, 2));
      expect(generatePattern(id, 1)).toHaveLength(64);
    }
  });
});
