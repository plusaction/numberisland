import { expect, test } from '@playwright/test';
import { collectErrors, nonBlank, url } from './helpers';

test('[S3] engine demo boots on the expected backend and renders', async ({ page }, info) => {
  const errors = await collectErrors(page);
  const requests: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173')) requests.push(r.url());
  });
  await page.goto(url(info, '/?demo=engine&debug=1'));
  const hud = page.getByTestId('debug-hud');
  await expect(hud).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(4000);
  const backend = await hud.getAttribute('data-backend');
  // webgl project must be WebGL2. In the webgpu project, headless SwiftShader WebGPU loses its device
  // (Chromium 141 + three r186); the app must then recover onto WebGL2 and keep rendering.
  if (info.project.name === 'webgl') expect(backend).toBe('webgl2');
  else expect(['webgpu', 'webgl2']).toContain(backend);
  await page.screenshot({ path: `docs/review/m2/engine-${info.project.name}.png` });
  // canvas is not blank: sample pixels via a downscaled readback of the screenshot
  const shot = await page.getByTestId('world-canvas').screenshot();
  expect(await nonBlank(page)).toBe(true);
  expect(shot.byteLength).toBeGreaterThan(5_000);
  expect(requests, 'no external network requests (P1)').toEqual([]);
  const fatal = errors.filter(
    (e) => !/WebGPU is experimental|Device Lost|Instance reference|popErrorScope|\[render\] lost/.test(e),
  );
  expect(fatal).toEqual([]);
});

test('[S3] recovers after a simulated device/context loss', async ({ page }, info) => {
  await page.goto(url(info, '/?demo=engine&debug=1'));
  const hud = page.getByTestId('debug-hud');
  await expect(hud).toBeVisible({ timeout: 60_000 });
  await page.evaluate(async () => {
    const w = (globalThis as { __world?: { simulateLoss(): Promise<void> } }).__world;
    await w?.simulateLoss();
  });
  await page.waitForTimeout(1500);
  // after a WebGPU loss we fall back to WebGL2; a WebGL loss re-creates WebGL2
  await expect(hud).toHaveAttribute('data-backend', 'webgl2');
  const state = await page.evaluate(() => {
    const w = (
      globalThis as {
        __world?: {
          recoveries: number;
          tier: string;
          scene: { getObjectsByProperty(k: string, v: string): { visible: boolean }[] };
        };
      }
    ).__world;
    return {
      recoveries: w?.recoveries ?? 0,
      tier: w?.tier,
      labels: w?.scene.getObjectsByProperty('name', 'number-label').filter((o) => o.visible).length ?? 0,
      canvases: document.querySelectorAll('canvas').length,
    };
  });
  expect(state.recoveries).toBeGreaterThanOrEqual(1);
  expect(['low', 'balanced']).toContain(state.tier); // WebGL2 cannot run compute tiers
  expect(state.labels).toBe(3); // numbers survive the renderer swap
  expect(state.canvases).toBe(1);
  await page.screenshot({ path: `docs/review/m2/recovered-${info.project.name}.png` });
  expect(await nonBlank(page)).toBe(true);
});
