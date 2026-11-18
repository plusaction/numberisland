import { expect, test } from '@playwright/test';
import { url } from './helpers';

/**
 * [P1] PWA (D52): after the first visit the service worker keeps this version on the device, so the game
 * starts again with the network switched off.
 */
test('[P1] second visit starts offline (service worker cache)', async ({ page, context }, info) => {
  test.setTimeout(180_000);
  await page.goto(url(info, '/'));
  await expect(page.getByText('모험 시작!')).toBeVisible({ timeout: 60_000 });
  // wait until the worker has cached everything and controls the page
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 })
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('모험 시작!')).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(() => page.evaluate(() => !!(globalThis as { __world?: unknown }).__world), { timeout: 60_000 })
    .toBe(true);
  await context.setOffline(false);
});
