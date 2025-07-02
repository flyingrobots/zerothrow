
import { defineConfig } from "vitest/config";
export default defineConfig({ 
  test: { 
    environment: "node",
    reporters: process.env.CI ? ['verbose', 'github-actions'] : ['verbose'],
    logHeapUsage: true,
    onConsoleLog(log) {
      // Always show console logs in CI for debugging
      if (process.env.CI) return;
      return false;
    }
  }
});
