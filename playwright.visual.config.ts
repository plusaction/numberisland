import { defineConfig } from '@playwright/test';

/**
 * `pnpm shots`: renders every scene at each quality tier (WebGL2, software) and writes screenshots +
 * renderer counters (draw calls, triangles, geometries, textures, frame time) to docs/review/gfx/.
 * Draw calls / triangles / memory counts are GPU independent; frame times here are software-rendered and only
 * comparable with each other (real-device numbers come from `pnpm bench`, HUMAN).
 */
export default defineConfig({
  testDir: 'tests/visual',
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
      args: [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--js-flags=--expose-gc',
      ],
    },
  },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
