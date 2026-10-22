import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { startFresh } from '../e2e/helpers';

const OUT = process.env.SHOT_OUT ?? 'docs/review/gfx';
const TIERS = (process.env.SHOT_TIERS ?? 'low,balanced,high').split(',');

/** Average renderer counters + real frame interval over ~2 s (reads three's renderer.info directly). */
async function measure(page: Page) {
  return page.evaluate(async () => {
    const w = (globalThis as { __world?: unknown }).__world as {
      renderer: {
        info: {
          render: { drawCalls?: number; calls?: number; triangles: number };
          memory: { geometries: number; textures: number };
        };
      };
      backend: string;
      tier: string;
    };
    const acc = { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
    const gaps: number[] = [];
    let last = performance.now();
    const t0 = last;
    await new Promise<void>((done) => {
      const tick = (now: number) => {
        const i = w.renderer.info;
        acc.drawCalls += i.render.drawCalls ?? i.render.calls ?? 0;
        acc.triangles += i.render.triangles;
        acc.geometries += i.memory.geometries;
        acc.textures += i.memory.textures;
        gaps.push(now - last);
        last = now;
        if (now - t0 < 2000) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    const n = gaps.length;
    gaps.sort((a, b) => a - b);
    const r = (v: number) => Math.round(v * 10) / 10;
    return {
      backend: w.backend,
      tier: w.tier,
      drawCalls: r(acc.drawCalls / n),
      triangles: Math.round(acc.triangles / n),
      geometries: r(acc.geometries / n),
      textures: r(acc.textures / n),
      fps: r(n / 2),
      frameMsP50: r(gaps[Math.floor(n * 0.5)] ?? 0),
      frameMsP95: r(gaps[Math.floor(n * 0.95)] ?? 0),
    };
  });
}

test('render every scene at each tier', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  const report: Record<string, unknown> = {};
  for (const tier of TIERS) {
    const q = `?renderer=webgl&tier=${tier}`;
    await startFresh(page, `/${q}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${tier}-welcome.png` });
    report[`${tier}/welcome`] = await measure(page);
    await page.getByText('모험 시작!').click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${tier}-placement.png` });
    report[`${tier}/placement`] = await measure(page);
    for (let i = 0; i < 8 && !(await page.getByTestId('hub').isVisible()); i++) {
      const btn = page.locator('[data-testid=choices] button').first();
      if (await btn.isVisible()) await btn.click();
      await page.waitForTimeout(400);
    }
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/${tier}-hub.png` });
    report[`${tier}/hub`] = await measure(page);
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
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${OUT}/${tier}-${stage}.png` });
      report[`${tier}/${stage}`] = await measure(page);
      await page.getByTestId('exit').click();
      await expect(page.getByTestId('hub')).toBeVisible();
    }
    // after visiting all stages (pipelines are cached; give the warm-up a moment like the first visit)
    await page.waitForTimeout(3500);
    report[`${tier}/hub-after-stages`] = await measure(page);
  }
  writeFileSync(`${OUT}/perf.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.info(JSON.stringify(report, null, 1));
});
