import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: [
      'tests/examples/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      'test/**/*performance*.test.ts',
    ],
    reporters: process.env.CI ? ['verbose', 'github-actions'] : ['verbose'],
    logHeapUsage: true,
    onConsoleLog(log) {
      // Always show console logs in CI for debugging
      if (process.env.CI) return;
      return false;
    },
    coverage: {
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.config.ts',
        '**/node_modules/**',
        'src/platform/**',
        'tests/**',
      ],
      reporter: ['text', 'json-summary', 'json'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
