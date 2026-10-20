import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { defaultProfile, HISTORY_LIMIT, pushHistory } from '../../src/domain/profile';
import { parseProfile } from '../../src/infra/storage/schema';
import { exportProfiles, importProfiles, memoryStore, openStore } from '../../src/infra/storage/store';

const now = '2026-10-20T09:00:00.000Z';

describe('[P4] 데이터 안정성', () => {
  it('IndexedDB round-trip keeps every field', async () => {
    const store = await openStore();
    expect(store.persistent).toBe(true);
    const p = defaultProfile('p1', '하늘', now);
    p.economy.coins = 42;
    p.stageStats.fishing = { stars: 3, plays: 2, bestCorrect: 8 };
    await store.putProfile(p);
    expect(await store.getProfile('p1')).toEqual(p);
  });

  it('max 3 profiles', async () => {
    const s = memoryStore();
    for (const id of ['a', 'b', 'c']) await s.putProfile(defaultProfile(id, id, now));
    await expect(s.putProfile(defaultProfile('d', 'd', now))).rejects.toThrow();
  });

  it('gzip export → import round-trip', async () => {
    const ps = [defaultProfile('x', '별', now), defaultProfile('y', '달', now)];
    const blob = await exportProfiles(ps);
    expect(blob.size).toBeGreaterThan(50);
    expect(await importProfiles(blob)).toEqual(ps);
  });

  it('rejects files that are not backups', async () => {
    const blob = new Blob([JSON.stringify({ hello: 1 })]);
    const gz = await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
    await expect(importProfiles(gz)).rejects.toThrow();
  });

  it('corrupt fields are repaired without losing valid progress (P2)', () => {
    const p = defaultProfile('z', '구름', now) as unknown as Record<string, unknown>;
    (p.economy as { coins: number }).coins = 77;
    p.settings = { broken: true };
    p.adaptive = 'garbage';
    const { profile, repaired } = parseProfile(p, now);
    expect(profile.economy.coins).toBe(77);
    expect(repaired.some((r) => r.startsWith('reset settings'))).toBe(true);
    expect(repaired).toContain('reset adaptive');
    expect(profile.settings.term).toBe('1-2');
  });

  it('migrates v0 drafts and refuses newer versions', () => {
    const p = defaultProfile('m', '바다', now) as unknown as Record<string, unknown>;
    delete p.firsts;
    p.version = 0;
    const { profile, repaired } = parseProfile(p, now);
    expect(profile.version).toBe(1);
    expect(repaired).toContain('migrated to v1');
    expect(() => parseProfile({ ...p, version: 99 }, now)).toThrow();
  });

  it('one bad history entry drops only that entry; negative coins clamp, snacks kept; one bad stage keeps the rest', () => {
    const base = defaultProfile('f', '꽃', now);
    const entry = {
      qid: 'q',
      skill: 'ADD_CARRY',
      level: 'A2',
      correct: true,
      hints: 0,
      ms: 1,
      given: 1,
      answer: 1,
      at: now,
      stage: 'fishing',
    } as const;
    const raw = structuredClone(base) as unknown as Record<string, unknown>;
    raw.history = [entry, { ...entry, skill: 'NOPE' }, entry];
    raw.economy = { coins: -1, snacks: 50 };
    raw.stageStats = {
      ...base.stageStats,
      fishing: { stars: 3, plays: 4, bestCorrect: 8 },
      bomb: { stars: 9 },
    };
    (raw.adaptive as { mastery: Record<string, unknown> }).mastery.ADD_CARRY = 'x';
    (raw.adaptive as { level: string }).level = 'B3';
    const { profile } = parseProfile(raw, now);
    expect(profile.history).toHaveLength(2);
    expect(profile.economy).toEqual({ coins: 0, snacks: 50 });
    expect(profile.stageStats.fishing.stars).toBe(3);
    expect(profile.stageStats.bomb.stars).toBe(0);
    expect(profile.adaptive.level).toBe('B3');
    expect(profile.adaptive.mastery.SUB_BORROW).toBe(base.adaptive.mastery.SUB_BORROW);
  });

  it('saver: debounced write, pagehide flush, failed write is retried not lost', async () => {
    const s = memoryStore();
    const failing = {
      ...s,
      putProfile: async () => {
        throw new Error('quota');
      },
    };
    const { createSaver } = await import('../../src/infra/storage/store');
    const saver = createSaver(failing, 10);
    saver.save(defaultProfile('s', 's', now));
    await saver.flush();
    expect(saver.pending?.id).toBe('s');
    saver.dispose();
    const ok = createSaver(s, 10);
    ok.save(defaultProfile('t', 't', now));
    await ok.flush();
    expect(ok.pending).toBeNull();
    expect(await s.getProfile('t')).not.toBeNull();
    ok.dispose();
  });

  it('history is a ring buffer of 500', () => {
    let h = defaultProfile('h', 'h', now).history;
    for (let i = 0; i < 600; i++) {
      h = pushHistory(h, {
        qid: `q${i}`,
        skill: 'ADD_CARRY',
        level: 'A2',
        correct: true,
        hints: 0,
        ms: 1000,
        given: 1,
        answer: 1,
        at: now,
        stage: 'fishing',
      });
    }
    expect(h).toHaveLength(HISTORY_LIMIT);
    expect(h[0]?.qid).toBe('q100');
  });
});
