import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "build", "test/integration/performance.test.ts"],
    globals: true,
    reporters: ["verbose"]
  }
});