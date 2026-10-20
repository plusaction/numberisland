/**
 * `pnpm bench` — run on the child's real device (needs a GPU). Builds, serves `preview`, opens the engine demo
 * in Chrome (or the bundled Chromium), samples frame times for 15 s at 1920×1080 and prints JSON for
 * docs/HUMAN_INPUT.md (F6, S3/S5 GPU parts).
 */
import { execSync, spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

execSync('pnpm build', { stdio: 'inherit' });
const server = spawn('pnpm', ['preview'], { stdio: 'ignore', shell: process.platform === 'win32' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium
  .launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'] })
  .catch(() => chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu'] }));
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const t0 = Date.now();
await page.goto('http://localhost:4173/?demo=engine&debug=1');
await page.getByTestId('debug-hud').waitFor({ timeout: 30_000 });
const ttiMs = Date.now() - t0;
const result = await page.evaluate(
  () =>
    new Promise<{ frames: number[]; backend: string | null; tier: string | null }>((resolve) => {
      const frames: number[] = [];
      let last = performance.now();
      const end = last + 15_000;
      const f = (now: number) => {
        frames.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(f);
        else {
          const hud = document.querySelector('[data-testid="debug-hud"]');
          resolve({
            frames,
            backend: hud?.getAttribute('data-backend') ?? null,
            tier: hud?.getAttribute('data-tier') ?? null,
          });
        }
      };
      requestAnimationFrame(f);
    }),
);
const sorted = result.frames.slice(5).sort((a, b) => a - b);
const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
console.log(
  JSON.stringify(
    {
      date: new Date().toISOString(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      backend: result.backend,
      finalTier: result.tier,
      frames: sorted.length,
      p50ms: +pct(0.5).toFixed(2),
      p95ms: +pct(0.95).toFixed(2),
      timeToHudMs: ttiMs,
    },
    null,
    2,
  ),
);
await browser.close();
server.kill();
