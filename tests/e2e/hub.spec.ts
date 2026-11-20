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
  // every stage is built now: each one offers its start key (no "준비 중" left)
  await page
    .getByRole('button', { name: '좀비 숫자 막기', exact: true })
    .evaluate((el) => (el as HTMLButtonElement).click());
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(page.getByTestId('soon')).toHaveCount(0);
  // fishing → intro → back to the island (P10)
  await page
    .getByRole('button', { name: '숫자 낚시', exact: true })
    .evaluate((el) => (el as HTMLButtonElement).click());
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

test('[G7] dragging the island turns it and settles on the portal now in front; a plain tap does not turn', async ({
  page,
}, info) => {
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  const card = page.getByTestId('info-card');
  const before = await card.getAttribute('data-stage');
  const vp = page.viewportSize() ?? { width: 1280, height: 800 };
  const y = vp.height * 0.3;
  // a tap on empty sea keeps the selection
  await page.mouse.click(vp.width * 0.04, vp.height * 0.5);
  await expect(card).toHaveAttribute('data-stage', before ?? '');
  // drag a third of the screen to the right
  await page.mouse.move(vp.width * 0.3, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(vp.width * (0.3 + 0.045 * i), y, { steps: 2 });
  await page.mouse.up();
  await expect(card).not.toHaveAttribute('data-stage', before ?? '', { timeout: 10_000 });
  // and back again the other way
  const turned = await card.getAttribute('data-stage');
  await page.mouse.move(vp.width * 0.66, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(vp.width * (0.66 - 0.045 * i), y, { steps: 2 });
  await page.mouse.up();
  await expect(card).not.toHaveAttribute('data-stage', turned ?? '', { timeout: 10_000 });
});

test('[R2] long game on the island: badges, snack feeding (never below zero), today’s adventure', async ({
  page,
}, info) => {
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  await expect(page.getByTestId('hub')).toBeVisible();
  // three badge slots per stage, none owned yet
  await expect(page.locator('[data-testid=badges] > li')).toHaveCount(3);
  await expect(page.locator('[data-testid=badges] > li[data-owned=true]')).toHaveCount(0);
  // no snack: feeding changes nothing
  const feed = page.getByTestId('feed');
  await feed.click();
  await expect(feed).toHaveAttribute('data-fed', '0');
  // give two snacks and a badge the way a finished round would
  await page.evaluate(() => {
    const st = (
      globalThis as unknown as {
        __store: { getState(): { profile: Record<string, never>; setProfile(p: unknown): void } };
      }
    ).__store.getState();
    const p = st.profile as unknown as { economy: { snacks: number }; badges: string[] };
    st.setProfile({ ...p, economy: { ...p.economy, snacks: 2 }, badges: ['bomb.noHint'] });
  });
  await feed.click();
  await feed.click();
  await feed.click();
  await expect(feed).toHaveAttribute('data-fed', '2');
  await expect(feed).toHaveAttribute('data-snacks', '0');
  // today's adventure points at a stage; pressing it selects that stage
  const daily = page.getByTestId('daily');
  await expect(daily).toHaveAttribute('data-done', '0');
  await daily.click();
  const picked = await page.getByTestId('info-card').getAttribute('data-stage');
  expect(picked).toBeTruthy();
  await page.evaluate(() =>
    (globalThis as unknown as { __store: { getState(): { select(s: string): void } } }).__store
      .getState()
      .select('bomb'),
  );
  await expect(page.locator('[data-testid=badges] > li[data-owned=true]')).toHaveCount(1);
  // fed count survives a reload
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByTestId('feed')).toHaveAttribute('data-fed', '2', { timeout: 30_000 });
});

test('[P7] save file: download, open it back after changes, and undo the swap (nothing is lost)', async ({
  page,
}, info) => {
  const errors = await collectErrors(page);
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  type S = {
    __store: { getState(): { profile: { economy: { coins: number } }; setProfile(p: unknown): void } };
  };
  const gems = () =>
    page.evaluate(() => (globalThis as unknown as S).__store.getState().profile.economy.coins);
  const setGems = (n: number) =>
    page.evaluate((v) => {
      const st = (globalThis as unknown as S).__store.getState();
      st.setProfile({ ...st.profile, economy: { ...st.profile.economy, coins: v } });
    }, n);
  await setGems(12);
  // the gem icon replaces the old coin emoji in the hub
  await expect(page.getByTestId('coins').locator('svg.gem-icon')).toBeVisible();
  await page.getByTestId('open-settings').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('save-down').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^numberisland-.+-\d{8}\.nisave$/);
  const file = await download.path();
  await expect(page.getByTestId('save-note')).toBeVisible();
  // play on (more gems), then open the older file: a look first, then the swap
  await setGems(40);
  await page.getByTestId('save-file').setInputFiles(file);
  await expect(page.getByTestId('save-ask')).toContainText('보석 12');
  await page.getByTestId('save-yes').click();
  await expect.poll(gems).toBe(12);
  // the replaced record (40 gems) is kept: one tap brings it back
  await page.getByTestId('save-undo').click();
  await expect.poll(gems).toBe(40);
  // a wrong file changes nothing
  await page
    .getByTestId('save-file')
    .setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByTestId('save-note')).toHaveText('열 수 없는 파일이야');
  await expect.poll(gems).toBe(40);
  expect(errors).toEqual([]);
});
