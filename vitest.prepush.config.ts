import { defineConfig } from "vitest/config";

export default defineConfig({ 
  test: { 
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/test/integration/**"],
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
        "src/eslint.ts"
      ]
    }
  }
});