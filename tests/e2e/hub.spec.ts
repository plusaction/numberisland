import { expect, test } from '@playwright/test';
import { collectErrors, startFresh, throughPlacement, url } from './helpers';

test('[G7] hub: 8 portals selectable by keyboard, info card + medals, intro and back', async ({
  page,
}, info) => {
  const errors = await collectErrors(page);
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  const card = page.getByTestId('info-card');
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    seen.add((await card.getAttribute('data-stage')) ?? '');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(120);
  }
  expect(seen.size).toBe(8);
  await expect(card.getByRole('img', { name: /별 0개/ })).toBeVisible();
  await expect(page.getByTestId('next-reward')).toBeVisible();
  // a not-yet-built stage says so instead of trapping the child
  await page
    .getByRole('button', { name: '숫자 카드 배틀' })
    .evaluate((el) => (el as HTMLButtonElement).click());
  await expect(page.getByTestId('soon')).toBeVisible();
  // fishing → intro → back to the island (P10)
  await page.getByRole('button', { name: '숫자 낚시' }).evaluate((el) => (el as HTMLButtonElement).click());
  await page.getByTestId('start').click();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.getByRole('button', { name: '섬으로' }).click();
  await expect(page.getByTestId('hub')).toBeVisible();
  expect(errors.filter((e) => !/Device Lost|Instance|popErrorScope|\[render\]|experimental/.test(e))).toEqual(
    [],
  );
});

test('[P4] progress survives a reload (IndexedDB)', async ({ page }, info) => {
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  // wait until the debounced save has really landed in IndexedDB (no fixed sleeps)
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<boolean>((res) => {
              const r = indexedDB.open('numberisland');
              r.onsuccess = () => {
                const g = r.result.transaction('profiles').objectStore('profiles').getAll();
                g.onsuccess = () =>
                  res((g.result as { placementDone?: boolean }[]).some((x) => x.placementDone));
              };
              r.onerror = () => res(false);
            }),
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 30_000 });
});
