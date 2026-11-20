import { describe, expect, it } from 'vitest';
import { saveFileName, saveSummary } from '../../src/application/usecases/savefile';
import { defaultProfile } from '../../src/domain/profile';
import { blobToProfile, profileToBlob } from '../../src/infra/storage/savefile';

const sample = () => {
  const p = defaultProfile('p-test', '하늘 별!', '2026-11-20T00:00:00.000Z');
  p.economy.coins = 37;
  p.stageStats.race.stars = 3;
  p.stageStats.bomb.stars = 2;
  p.toys = ['top', 'robot'];
  return p;
};

describe('save files', () => {
  it('a downloaded save opens back to the same profile (gzip)', async () => {
    const p = sample();
    const back = await blobToProfile(await profileToBlob(p));
    expect(back).toEqual(p);
  });

  it('plain JSON saves (browsers without CompressionStream) open too', async () => {
    const p = sample();
    const json = JSON.stringify({ app: 'numberisland', profiles: [p] });
    expect(await blobToProfile(new Blob([json]))).toEqual(p);
  });

  it('an older save is migrated on the way in', async () => {
    const p = sample() as unknown as Record<string, unknown>;
    const old: Record<string, unknown> = { ...p, version: 3 };
    delete old.badges;
    delete old.stamps;
    const back = await blobToProfile(new Blob([JSON.stringify({ app: 'numberisland', profiles: [old] })]));
    expect(back.economy.coins).toBe(37);
    expect(back.badges).toEqual([]);
  });

  it('other files are refused', async () => {
    await expect(blobToProfile(new Blob(['hello']))).rejects.toThrow();
    await expect(
      blobToProfile(new Blob([JSON.stringify({ app: 'other', profiles: [{}] })])),
    ).rejects.toThrow();
    await expect(
      blobToProfile(new Blob([JSON.stringify({ app: 'numberisland', profiles: [] })])),
    ).rejects.toThrow();
  });

  it('summary and file name', () => {
    const p = sample();
    expect(saveSummary(p)).toMatchObject({ nickname: '하늘 별!', gems: 37, stars: 5 });
    expect(saveFileName(p, new Date(2026, 10, 20))).toBe('numberisland-save-20261120.nisave');
    expect(saveFileName({ ...p, nickname: 'Mia 7' }, new Date(2026, 0, 5))).toBe(
      'numberisland-Mia7-20260105.nisave',
    );
  });
});
