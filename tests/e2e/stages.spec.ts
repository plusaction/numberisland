import { expect, test } from '@playwright/test';
import { collectErrors, startFresh, throughPlacement, url } from './helpers';

/**
 * Functional stage tests run on the lightest tier: in this GPU-less CI every pixel is rasterised on the CPU,
 * so the PBR/post tiers would turn the latency guard into a measure of SwiftShader speed. Visual quality per
 * tier is checked separately (`pnpm shots`), real-device latency/FPS by `pnpm bench` (HUMAN).
 */
const STAGE_PATH = '/?tier=low';

for (const stage of ['fishing', 'bomb', 'slime'] as const) {
  test(`[A1:${stage}] [G2:${stage}] round → result with stars, new thing, next goal`, async ({
    page,
  }, info) => {
    test.setTimeout(300_000);
    const errors = await collectErrors(page);
    await startFresh(page, url(info, STAGE_PATH));
    await throughPlacement(page);
    await page.evaluate((s) => {
      const st = (
        globalThis as { __store?: { getState(): { select(s: string): void; go(s: string): void } } }
      ).__store?.getState();
      st?.select(s);
      st?.go('intro');
    }, stage);
    await page.getByTestId('go').click();
    await expect(page.getByTestId('stage')).toHaveAttribute('data-stage', stage);
    // tutorial: wordless ghost hand, skippable (P4, SPEC §11)
    await expect(page.getByTestId('tutorial')).toBeVisible();
    await page.getByTestId('skip-tutorial').click();
    await expect(page.getByTestId('tutorial')).toHaveCount(0);
    // hint ladder opens on demand
    await page.getByTestId('hint').click();
    await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-level', '1');
    await page.getByText('알았어!').click();
    for (let k = 0; k < 150; k++) {
      if (await page.getByTestId('result').isVisible()) break;
      await page.evaluate(() => (globalThis as { __stage?: { solveOne(): void } }).__stage?.solveOne());
      await page.waitForTimeout(900);
    }
    await expect(page.getByTestId('result')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('result-stars')).toHaveAttribute('data-stars', /[1-3]/);
    await expect(page.getByTestId('new-thing')).toBeVisible();
    await expect(page.getByTestId('new-thing')).not.toBeEmpty();
    await expect(page.getByTestId('next-goal')).toBeVisible();
    await expect(page.getByTestId('next-goal')).not.toBeEmpty();
    await page.waitForTimeout(2500); // let the star animation finish before the screenshot
    const lat = await page.evaluate(() => {
      const rt = (globalThis as { __stage?: { runtime: { latencyTicks: number[]; latencyMs: number[] } } })
        .__stage?.runtime;
      return { ticks: rt?.latencyTicks ?? [], ms: rt?.latencyMs ?? [] };
    });
    expect(lat.ms.length).toBeGreaterThan(5);
    // every input is consumed by the very next simulation step
    expect(Math.max(...lat.ticks)).toBeLessThanOrEqual(2);
    // wall clock from input to the scene sync that plays its sound/animation, measured on this machine.
    // CPU-only SwiftShader frames are slow, so the ≤100 ms target itself is checked on real GPUs (pnpm bench);
    // here we only guard against regressions (median ≤ 300 ms).
    const sorted = lat.ms.slice().sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)] as number;
    console.info(
      `[latency:${stage}] median ${median.toFixed(0)} ms, max ${(sorted[sorted.length - 1] as number).toFixed(0)} ms`,
    );
    // the sync that shows an input runs on the next rendered frame: compare with this machine's own frame
    // interval (CPU-rendered frames here take hundreds of ms; real devices are measured by pnpm bench)
    const frame = await page.evaluate(
      () =>
        new Promise<number>((done) => {
          const gaps: number[] = [];
          let last = performance.now();
          const t0 = last;
          const tick = (now: number) => {
            gaps.push(now - last);
            last = now;
            if (now - t0 < 1500) requestAnimationFrame(tick);
            else done(gaps.sort((x, y) => x - y)[Math.floor(gaps.length / 2)] ?? 0);
          };
          requestAnimationFrame(tick);
        }),
    );
    console.info(`[latency:${stage}] frame interval median ${frame.toFixed(0)} ms`);
    expect(median).toBeLessThanOrEqual(Math.max(300, frame * 1.5));
    await page.screenshot({ path: `docs/review/m4/e2e-${stage}-result-${info.project.name}.png` });
    // the round was saved: back on the island the stage shows its stars
    await page.getByTestId('to-hub').click();
    await expect(page.getByTestId('hub')).toBeVisible();
    expect(
      errors.filter((e) => !/Device Lost|Instance|popErrorScope|\[render\]|experimental/.test(e)),
    ).toEqual([]);
  });
}

test('[G7] exit is always available mid-round (P10)', async ({ page }, info) => {
  await startFresh(page, url(info, STAGE_PATH));
  await throughPlacement(page);
  await page.getByTestId('start').click();
  await page.getByTestId('go').click();
  await page.getByTestId('skip-tutorial').click();
  await page.getByTestId('exit').click();
  await expect(page.getByTestId('hub')).toBeVisible();
});

test('[G7] tutorial plays to the end by itself and unlocks input (no skip)', async ({ page }, info) => {
  test.setTimeout(180_000);
  await startFresh(page, url(info, STAGE_PATH));
  await throughPlacement(page);
  await page.getByTestId('start').click();
  await page.getByTestId('go').click();
  await expect(page.getByTestId('tutorial')).toBeVisible();
  await expect(page.getByTestId('tutorial')).toHaveCount(0, { timeout: 60_000 });
  const locked = await page.evaluate(
    () => (globalThis as { __stage?: { runtime: { locked: boolean } } }).__stage?.runtime.locked,
  );
  expect(locked).toBe(false);
});

test('[G7] keyboard H opens the hint panel; Escape closes it, then leaves the stage', async ({
  page,
}, info) => {
  await startFresh(page, url(info, STAGE_PATH));
  await throughPlacement(page);
  await page.getByTestId('start').click();
  await page.getByTestId('go').click();
  await page.getByTestId('skip-tutorial').click();
  await page.locator('body').press('KeyH');
  await expect(page.getByTestId('hint-panel')).toBeVisible();
  await page.locator('body').press('Escape');
  await expect(page.getByTestId('hint-panel')).toHaveCount(0);
  await page.locator('body').press('Escape');
  await expect(page.getByTestId('hub')).toBeVisible();
});

test('[E4] after hint 4 the new-numbers retry updates the goal shown to the child', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await startFresh(page, url(info, STAGE_PATH));
  await throughPlacement(page);
  await page.getByTestId('start').click(); // fishing is the default selection
  await page.getByTestId('go').click();
  await page.getByTestId('skip-tutorial').click();
  await page.getByTestId('hint').click();
  for (let i = 0; i < 3; i++) await page.getByTestId('hint-more').click();
  await expect(page.getByTestId('hint-panel')).toHaveAttribute('data-level', '4');
  const before = await page.getByTestId('goal').innerText();
  await page.getByText('알았어!').click();
  await expect(page.getByTestId('goal')).not.toHaveText(before);
  const target = await page.evaluate(
    () =>
      (globalThis as { __stage?: { runtime: { state: { puzzle: { target: number } } } } }).__stage?.runtime
        .state.puzzle.target,
  );
  await expect(page.getByTestId('goal')).toContainText(String(target));
});
