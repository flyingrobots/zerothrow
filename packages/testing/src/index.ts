// @zerothrow/testing - Unified test matchers for ZeroThrow
// This package provides a convenient all-in-one solution for test matchers

export * from '@zerothrow/jest';
export * from '@zerothrow/vitest';

// Auto-detect and setup based on environment
export function setup() {
  // Try to detect test runner and auto-setup
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as any;
    
    // Check for Jest
    if (g.expect && g.expect.extend && g.jest) {
      import('@zerothrow/jest').then((m) => m.setup()).catch(() => {});
    }
    // Check for Vitest
    else if (g.expect && g.expect.extend && g.vi) {
      import('@zerothrow/vitest').then((m) => m.setup()).catch(() => {});
    }
  }
}

// Export convenience functions for manual setup
export { setup as setupJest } from '@zerothrow/jest';
export { setup as setupVitest } from '@zerothrow/vitest';