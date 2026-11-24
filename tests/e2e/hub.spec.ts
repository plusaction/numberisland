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
  // fed count survives a reload (wait for the write itself, not a guessed delay: software GL is slow here)
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const db: IDBDatabase = await new Promise((r) => {
            const q = indexedDB.open('numberisland');
            q.onsuccess = () => r(q.result);
          });
          const all: { friendFed: number }[] = await new Promise((r) => {
            const t = db.transaction('profiles').objectStore('profiles').getAll();
            t.onsuccess = () => r(t.result);
          });
          db.close();
          return all[0]?.friendFed;
        }),
      { timeout: 30_000 },
    )
    .toBe(2);
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

test('[D61] one number step for all stages: pick ③ on the island, it is saved, and a stage asks two-digit pairs', async ({
  page,
}, info) => {
  const errors = await collectErrors(page);
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  const picker = page.getByTestId('number-step');
  // the default is ①
  await expect(picker).toHaveAttribute('data-step', '1');
  const three = page.getByTestId('number-step-3');
  // press feel: the key goes down while it is held
  const box = await three.boundingBox();
  if (!box) throw new Error('no step key');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(three).toHaveAttribute('data-pressed', '');
  await page.mouse.up();
  await expect(picker).toHaveAttribute('data-step', '3');
  await expect(three).not.toHaveAttribute('data-pressed', '', { timeout: 2000 });
  // saved: survives a reload, and the settings sheet shows the same step
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const db: IDBDatabase = await new Promise((r) => {
            const q = indexedDB.open('numberisland');
            q.onsuccess = () => r(q.result);
          });
          const all: { settings: { numberStep: number } }[] = await new Promise((r) => {
            const t = db.transaction('profiles').objectStore('profiles').getAll();
            t.onsuccess = () => r(t.result);
          });
          db.close();
          return all[0]?.settings.numberStep;
        }),
      { timeout: 30_000 },
    )
    .toBe(3);
  await page.reload();
  await expect(page.getByTestId('number-step')).toHaveAttribute('data-step', '3', { timeout: 30_000 });
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings').getByTestId('number-step')).toHaveAttribute('data-step', '3');
  await page.keyboard.press('Escape');
  // a stage now asks two-digit with two-digit
  await page.evaluate(() => {
    const st = (
      globalThis as unknown as { __store: { getState(): { select(s: string): void; go(s: string): void } } }
    ).__store.getState();
    st.select('race');
    st.go('intro');
  });
  await page.getByTestId('go').click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-stage', 'race', { timeout: 60_000 });
  await page.waitForFunction(
    () =>
      (globalThis as unknown as { __stage?: { runtime: { state: { core: { asked: unknown } } } } }).__stage
        ?.runtime.state.core.asked,
    null,
    { timeout: 60_000 },
  );
  const ops = await page.evaluate(
    () =>
      (
        globalThis as unknown as {
          __stage: { runtime: { state: { core: { asked: { question: { operands: number[] } } } } } };
        }
      ).__stage.runtime.state.core.asked.question.operands,
  );
  expect(ops).toHaveLength(2);
  for (const n of ops) expect(n).toBeGreaterThanOrEqual(10);
  expect(errors).toEqual([]);
});

test('[D62] five maps per stage: only the first is open, its mission opens the next, and the next can be picked', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  const errors = await collectErrors(page);
  await startFresh(page, url(info, '/'));
  await throughPlacement(page);
  type St = {
    __store: {
      getState(): {
        select(s: string): void;
        go(s: string): void;
        profile: { maps: Record<string, number> };
      };
    };
  };
  await page.evaluate(() => (globalThis as unknown as St).__store.getState().select('fishing'));
  const maps = page.getByTestId('maps');
  await expect(maps).toHaveAttribute('data-open', '1');
  await expect(page.getByTestId('map-0')).toBeEnabled();
  await expect(page.getByTestId('map-1')).toBeDisabled();
  await expect(page.getByTestId('map-caption')).toContainText('해님 연못');
  // play map 1 through (its mission: finish a round)
  await page.evaluate(() => (globalThis as unknown as St).__store.getState().go('intro'));
  await page.getByTestId('go').click();
  await expect(page.getByTestId('stage')).toHaveAttribute('data-stage', 'fishing', { timeout: 60_000 });
  await expect(page.getByTestId('map-chip')).toContainText('한 판 끝내기');
  await page
    .getByTestId('skip-tutorial')
    .click({ timeout: 20_000 })
    .catch(() => {});
  for (let k = 0; k < 200; k++) {
    if (await page.getByTestId('result').isVisible()) break;
    await page.evaluate(() => {
      const s = (
        globalThis as unknown as { __stage?: { info(): { acceptsInput: boolean }; solveOne(): void } }
      ).__stage;
      if (s?.info().acceptsInput) s.solveOne();
    });
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId('result')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('map-mission')).toHaveAttribute('data-met', '1');
  await expect(page.getByTestId('map-mission')).toContainText('굽이 강가');
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as St).__store.getState().profile.maps.fishing))
    .toBe(2);
  // back on the island: map 2 is open and chosen by default
  await page.getByTestId('to-hub').click();
  await expect(page.getByTestId('maps')).toHaveAttribute('data-open', '2');
  await expect(page.getByTestId('maps')).toHaveAttribute('data-map', '1');
  await page.getByTestId('map-0').click();
  await expect(page.getByTestId('maps')).toHaveAttribute('data-map', '0');
  expect(errors).toEqual([]);
});
