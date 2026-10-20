import { expect, test } from '@playwright/test';
import { collectErrors, startFresh, throughPlacement, url } from './helpers';

for (const stage of ['fishing', 'bomb', 'slime'] as const) {
  test(`[A1:${stage}] [G2:${stage}] round → result with stars, new thing, next goal`, async ({
    page,
  }, info) => {
    test.setTimeout(300_000);
    const errors = await collectErrors(page);
    await startFresh(page, url(info, '/'));
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
    await expect(page.getByTestId('new-thing')).not.toBeEmpty();
    await expect(page.getByTestId('next-goal')).not.toBeEmpty();
    const latency = await page.evaluate(
      () =>
        (globalThis as { __stage?: { runtime: { latencyTicks: number[] } } }).__stage?.runtime.latencyTicks ??
        [],
    );
    expect(latency.length).toBeGreaterThan(0);
    // input → state change within 6 simulation ticks (= 100 ms at 60 Hz)
    expect(Math.max(...latency)).toBeLessThanOrEqual(6);
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
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  await page.getByTestId('start').click();
  await page.getByTestId('go').click();
  await page.getByTestId('skip-tutorial').click();
  await page.getByTestId('exit').click();
  await expect(page.getByTestId('hub')).toBeVisible();
});
