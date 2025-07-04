import { defineConfig, mergeConfig } from 'vitest/config';
import { resolve } from 'path';
import baseConfig from './.config/vitest.base';

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        '@': resolve(__dirname, './packages/core/src'),
        '@zerothrow/zerothrow': resolve(__dirname, './packages/core/src')
      }
    },
    test: {
      include: ['packages/core/test/**/*.test.ts', 'packages/core/test/**/*.test.tsx'],
      exclude: [
        'packages/core/test/examples/**/*.test.ts',
        'packages/core/test/examples/**/*.test.tsx',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        'packages/core/test/**/*performance*.test.ts',
      ],
      reporters: process.env.CI ? ['verbose', 'github-actions'] : ['verbose'],
      logHeapUsage: true,
      onConsoleLog(log) {
        // Always show console logs in CI for debugging
        if (process.env.CI) return;
        return false;
      },
      coverage: {
        include: ['packages/core/src/**/*.ts'],
        exclude: [
          '**/*.config.ts',
          '**/node_modules/**',
          'packages/core/src/platform/**',
          'packages/core/test/**',
        ],
        reporter: ['text', 'json-summary', 'json'],
      },
    },
  })
);
