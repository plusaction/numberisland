import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/{unit,property,replay}/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'reports/coverage',
    },
  },
});
