import { defineConfig } from "vitest/config";

export default defineConfig({ 
  test: { 
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/test/integration/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.config.ts", "**/node_modules/**"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      }
    }
  }
});