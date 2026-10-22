import { expect, test } from '@playwright/test';
import { startFresh, throughPlacement } from '../e2e/helpers';

/** Enter and leave every stage several times: scene graph, GPU geometry/texture counts and heap must plateau. */
test('no growth across repeated stage visits', async ({ page }) => {
  await startFresh(page, '/?renderer=webgl&tier=low');
  await throughPlacement(page);
  const snap = () =>
    page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        (globalThis as { gc?: () => void }).gc?.();
        await new Promise((r) => setTimeout(r, 100));
      }
      const w = (globalThis as { __world?: unknown }).__world as {
        scene: { traverse(cb: () => void): void };
        renderer: { info: { memory: { geometries: number; textures: number } } };
      };
      let objects = 0;
      w.scene.traverse(() => objects++);
      const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      return {
        objects,
        geometries: w.renderer.info.memory.geometries,
        textures: w.renderer.info.memory.textures,
        heapMB: Math.round((mem?.usedJSHeapSize ?? 0) / 1e6),
      };
    });
  const rows: unknown[] = [await snap()];
  for (let round = 0; round < Number(process.env.ROUNDS ?? 3); round++) {
    for (const stage of ['fishing', 'bomb', 'slime'] as const) {
      await page.evaluate((s) => {
        const st = (
          globalThis as { __store?: { getState(): { select(s: string): void; go(s: string): void } } }
        ).__store?.getState();
        st?.select(s);
        st?.go('intro');
      }, stage);
      await page.getByTestId('go').click();
      await expect(page.getByTestId('stage')).toHaveAttribute('data-stage', stage);
      const skip = page.getByTestId('skip-tutorial');
      if (await skip.isVisible().catch(() => false)) await skip.click();
      await page.waitForTimeout(800);
      await page.getByTestId('exit').click();
      await expect(page.getByTestId('hub')).toBeVisible();
    }
    await page.waitForTimeout(800);
    rows.push(await snap());
  }
  console.info(JSON.stringify(rows));
  const [, first, , last] = rows as { objects: number; geometries: number; textures: number }[];
  expect(last?.objects).toBe(first?.objects);
  expect(last?.geometries).toBeLessThanOrEqual((first?.geometries ?? 0) + 2);
  expect(last?.textures).toBeLessThanOrEqual((first?.textures ?? 0) + 1);
  const heap = rows as { heapMB: number }[];
  expect(heap[3]?.heapMB ?? 0, 'JS heap after 3 rounds vs after 1').toBeLessThanOrEqual(
    (heap[1]?.heapMB ?? 0) * 1.25 + 5,
  );
});
