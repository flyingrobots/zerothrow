import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "build", "test/integration/performance.test.ts"],
    globals: true,
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules",
        "test",
        "dist",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mockData",
        "src/eslint.ts" // Exclude ESLint rules from coverage
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      },
      watermarks: {
        lines: [80, 95],
        functions: [80, 95],
        branches: [80, 95],
        statements: [80, 95]
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1
      }
    },
    sequence: {
      shuffle: false
    },
    onConsoleLog(log) {
      // Filter out performance benchmark logs in CI
      if (process.env.CI && log.includes('Performance')) {
        return false;
      }
    }
  }
});