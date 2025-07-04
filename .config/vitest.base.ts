import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: [
      'node_modules',
      'dist',
      'build',
      '.turbo',
      'coverage',
      '**/*.bench.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'coverage/**',
        'dist/**',
        'build/**',
        '**/node_modules/**',
        '**/test/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/test-*.ts',
        '**/scripts/**',
        '**/benchmark/**',
        '**/vitest.*.ts',
        '**/eslint.config.js',
        '**/examples/**'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true
      }
    }
  },
  resolve: {
    alias: {
      '@zerothrow/core': './src/index.ts'
    }
  }
});