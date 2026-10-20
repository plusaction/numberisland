import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/domain/rng/rng';

describe('rng (P6)', () => {
  it('is deterministic and restorable from state', () => {
    const a = createRng('seed');
    const b = createRng('seed');
    for (let i = 0; i < 100; i++) expect(a.u32()).toBe(b.u32());
    const snap = a.state();
    const c = createRng(snap);
    expect(c.u32()).toBe(a.u32());
  });
  it('fork does not advance the parent and is label-specific', () => {
    const a = createRng(7);
    const before = createRng(7).u32();
    a.fork('x');
    expect(a.u32()).toBe(before);
    expect(createRng(7).fork('x').u32()).not.toBe(createRng(7).fork('y').u32());
  });
  it('int is uniform-ish and inclusive', () => {
    const r = createRng(1);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30000; i++) counts[r.int(0, 2)]!++;
    for (const c of counts) expect(c).toBeGreaterThan(9000);
  });
});
