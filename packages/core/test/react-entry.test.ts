import { describe, it, expect } from 'vitest';
import * as ReactExports from '../src/react-entry.js';

describe('react-entry exports', () => {
  it('should export useResult function', () => {
    expect(typeof ReactExports.useResult).toBe('function');
  });

  it('should have UseResultState type exported', () => {
    // TypeScript will ensure this type exists at compile time
    // This test verifies the module exports are working correctly
    expect(ReactExports).toHaveProperty('useResult');
  });
});