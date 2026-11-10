import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { startFresh, throughPlacement, url } from './helpers';

/** Serious / critical axe violations on the current screen (the 3D canvas is decoration for axe). */
async function violations(page: Page) {
  const r = await new AxeBuilder({ page }).exclude('canvas').analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

test('[P9] no serious accessibility violations: welcome, island, settings, stage', async ({ page }, info) => {
  test.setTimeout(240_000);
  await startFresh(page, url(info, '/'));
  expect(await violations(page), 'welcome').toEqual([]);
  await throughPlacement(page);
  expect(await violations(page), 'island').toEqual([]);
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  expect(await violations(page), 'settings').toEqual([]);
  // Tab never leaves the sheet; closing gives the focus back to the gear key
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid=settings]'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('open-settings')).toBeFocused();
  for (const stage of ['fishing', 'race'] as const) {
    await page.evaluate(
      (s) =>
        (globalThis as unknown as { __store: { getState(): { select(x: string): void } } }).__store
          .getState()
          .select(s),
      stage,
    );
    await page.getByTestId('start').click();
    await page.getByTestId('go').click();
    await page
      .getByTestId('skip-tutorial')
      .click({ timeout: 20_000 })
      .catch(() => {});
    await expect(page.getByTestId('stage')).toBeVisible();
    await page.waitForTimeout(2500); // past the intro cut
    expect(await violations(page), stage).toEqual([]);
    await page.getByTestId('exit').click();
    await expect(page.getByTestId('hub')).toBeVisible({ timeout: 30_000 });
  }
});

test('[S2] a crashing screen shows the friendly retry card, not a blank page', async ({ page }, info) => {
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  await page.evaluate(() => {
    (globalThis as { __crashUi?: boolean }).__crashUi = true;
    // any state change re-renders the island screen, which now throws
    (globalThis as unknown as { __store: { getState(): { select(x: string): void } } }).__store
      .getState()
      .select('bomb');
  });
  await expect(page.getByTestId('ui-crash')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 해 볼까?' })).toBeVisible();
});
