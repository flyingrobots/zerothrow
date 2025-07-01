import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["tests/examples/**"],
    coverage: {
      exclude: [
        "tests/**",
        "test/**",
        "dist/**",
        "node_modules/**",
        "vitest.config.ts",
        "eslint.config.js"
      ]
    }
  }
});