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
    .getByRole('button', { name: '좀비 숫자 막기' })
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

test('[P9] settings sheet: switches apply at once, are saved, and the island ignores keys meanwhile', async ({
  page,
}, info) => {
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  const settings = () =>
    page.evaluate(() => {
      const s = (globalThis as unknown as { __store: { getState(): { profile: { settings: unknown } } } })
        .__store;
      return s.getState().profile.settings as {
        tts: boolean;
        shakeIntensity: number;
        reducedMotion: boolean | 'system';
        volumes: { bgm: number };
      };
    });
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  const before = await page.getByTestId('info-card').getAttribute('data-stage');
  await page.getByTestId('set-tts').getByRole('button', { name: '끔' }).click();
  await page.getByTestId('set-music').getByRole('button', { name: '끔' }).click();
  await page.getByTestId('set-shake').getByRole('button', { name: '끔' }).click();
  await page.getByTestId('set-motion').getByRole('button', { name: '켬' }).click();
  expect(await settings()).toMatchObject({ tts: false, shakeIntensity: 0, reducedMotion: true });
  expect((await settings()).volumes.bgm).toBe(0);
  // arrow keys do not turn the island under the sheet
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('info-card')).toHaveAttribute('data-stage', before ?? '');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings')).toHaveCount(0);
  // saved: still there after a reload
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
                  res(
                    (g.result as { settings?: { tts?: boolean } }[]).some((x) => x.settings?.tts === false),
                  );
              };
              r.onerror = () => res(false);
            }),
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByTestId('hub')).toBeVisible({ timeout: 30_000 });
  expect(await settings()).toMatchObject({ tts: false, reducedMotion: true });
});
