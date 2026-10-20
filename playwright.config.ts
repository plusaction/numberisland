import { defineConfig } from '@playwright/test';

const base = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/**
 * Two projects: WebGPU (SwiftShader Vulkan adapter in headless Chromium) and forced WebGL2 (`?renderer=webgl`).
 * Software rendering ⇒ functional checks only; visual thresholds are relaxed (SPEC §17).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'reports/e2e.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'webgpu',
      use: {
        launchOptions: {
          executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
          args: [...base, '--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'],
        },
      },
    },
    {
      name: 'webgl',
      use: {
        launchOptions: { executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium', args: base },
      },
    },
  ],
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
