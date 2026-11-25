import { expect, type Page, test } from '@playwright/test';
import { startFresh, throughPlacement, url } from './helpers';

/**
 * "누른 숫자가 안 눌려" guard: in every tap stage, every thing that can be tapped right now is clicked with
 * the real mouse at its spot on screen, and the stage must react (its state changes). Then the tap is undone.
 * Phone size — the tightest layout, where an invisible overlay or a hidden hit shape hurt most.
 * Slime merges tap-then-tap, so there the second tap goes on another slime.
 */
const STAGES = ['fishing', 'bomb', 'slime', 'escape', 'pizza', 'cardbattle', 'zombie'] as const;

interface StageHook {
  runtime: { screenPos(id: number): { x: number; y: number } | null; state: Record<string, unknown> };
  info(): { acceptsInput: boolean };
  targets(): number[];
  undo(): void;
}

async function spot(page: Page, id: number) {
  return page.evaluate((t) => {
    const st = (globalThis as unknown as { __stage: StageHook }).__stage;
    const p = st.runtime.screenPos(t);
    return p ? { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight } : null;
  }, id);
}

async function signature(page: Page) {
  return page.evaluate(() => {
    const st = (globalThis as unknown as { __stage: StageHook }).__stage;
    const s = st.runtime.state;
    const { tick: _t, rng: _r, ...core } = (s.core ?? {}) as Record<string, unknown>;
    return JSON.stringify({ ...s, core, phaseLeft: 0 });
  });
}

test.describe.configure({ mode: 'serial' });
for (const id of STAGES) {
  test(`[${id}] every target reacts to a real tap`, async ({ page }, info) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await startFresh(page, url(info, '/?tier=low'));
    await throughPlacement(page);
    await page.evaluate((s) => {
      const st = (
        globalThis as unknown as { __store: { getState(): { go(x: string): void; select(x: string): void } } }
      ).__store.getState();
      st.go('hub');
      st.select(s);
      st.go('intro');
    }, id);
    await page.getByTestId('go').click();
    await page
      .getByTestId('skip-tutorial')
      .click({ timeout: 20_000 })
      .catch(() => {});
    await page.waitForFunction(
      () => (globalThis as unknown as { __stage?: StageHook }).__stage?.info().acceptsInput,
      null,
      { timeout: 120_000 },
    );
    const ids = await page.evaluate(() =>
      (globalThis as unknown as { __stage: StageHook }).__stage.targets(),
    );
    expect(ids.length).toBeGreaterThan(0);
    const dead: string[] = [];
    let tried = 0;
    for (const tid of ids) {
      const ready = await page.evaluate(
        () => (globalThis as unknown as { __stage: StageHook }).__stage.info().acceptsInput,
      );
      if (!ready) break;
      const at = await spot(page, tid);
      if (!at || at.x < 0 || at.y < 0 || at.x > 390 || at.y > 844) continue;
      const before = await signature(page);
      await page.mouse.click(at.x, at.y);
      await page.waitForTimeout(350);
      if (id === 'slime') {
        const other = ids.find((o) => o !== tid);
        const q = other === undefined ? null : await spot(page, other);
        if (q) {
          await page.mouse.click(q.x, q.y);
          await page.waitForTimeout(350);
        }
      }
      tried++;
      if ((await signature(page)) === before) dead.push(`#${tid}@${Math.round(at.x)},${Math.round(at.y)}`);
      else await page.evaluate(() => (globalThis as unknown as { __stage: StageHook }).__stage.undo());
      await page.waitForTimeout(150);
    }
    expect(tried).toBeGreaterThan(0);
    expect(dead, 'targets that did not react to a tap').toEqual([]);
  });
}
