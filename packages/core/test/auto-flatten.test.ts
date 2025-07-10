import { describe, it, expect } from 'vitest';
import { ZT } from '../src/index.js';

describe('ZT.try auto-flatten behavior', () => {
  it('should auto-flatten sync Result-returning functions', () => {
    // Function that returns a Result (user mistake)
    const returnsResult = () => ZT.ok('inner-value');
    
    // Without auto-flatten, this would be Result<Result<string, Error>, Error>
    // With auto-flatten, it should be Result<string, Error>
    const result = ZT.try(() => returnsResult());
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('inner-value'); // Should be flattened, not a nested Result
      expect(typeof result.value).toBe('string'); // Should be the actual value, not a Result object
    }
  });

  it('should auto-flatten async Result-returning functions', async () => {
    // Async function that returns a Result (user mistake)
    const returnsAsyncResult = async () => ZT.ok('async-inner-value');
    
    // Without auto-flatten, this would be Result<Result<string, Error>, Error>
    // With auto-flatten, it should be Result<string, Error>
    const result = await ZT.try(() => returnsAsyncResult());
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('async-inner-value'); // Should be flattened
      expect(typeof result.value).toBe('string'); // Should be the actual value
    }
  });

  it('should auto-flatten error Results correctly', () => {
    // Function that returns an error Result
    const returnsErrorResult = () => ZT.err('inner-error');
    
    const result = ZT.try(() => returnsErrorResult());
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('inner-error');
    }
  });

  it('should not interfere with normal functions', () => {
    // Normal function that returns a plain value
    const normalFunction = () => 'normal-value';
    
    const result = ZT.try(() => normalFunction());
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('normal-value');
    }
  });

  it('should only flatten one level deep', () => {
    // Function that returns Result<Result<T, E>, E> (deeply nested)
    const returnsNestedResult = () => ZT.ok(ZT.ok('deeply-nested'));
    
    const result = ZT.try(() => returnsNestedResult());
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should only flatten one level, leaving inner Result intact
      expect(result.value.ok).toBe(true);
      if (result.value.ok) {
        expect(result.value.value).toBe('deeply-nested');
      }
    }
  });

  it('should handle functions that throw exceptions normally', () => {
    const throwingFunction = () => {
      throw new Error('I always throw');
    };

    const result = ZT.try(() => throwingFunction());
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('I always throw');
    }
  });

  it('should handle async functions that reject normally', async () => {
    const rejectingFunction = async () => {
      throw new Error('I always reject');
    };

    const result = await ZT.try(() => rejectingFunction());
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('I always reject');
    }
  });

  it('should handle mixed scenarios correctly', () => {
    // Test that a function returning a Result gets flattened
    const resultReturner = () => ZT.ok(42);
    const flattened = ZT.try(() => resultReturner());
    
    expect(flattened.ok).toBe(true);
    if (flattened.ok) {
      expect(flattened.value).toBe(42);
      expect(typeof flattened.value).toBe('number');
    }

    // Test that a normal function works as expected
    const normalReturner = () => 42;
    const normal = ZT.try(() => normalReturner());
    
    expect(normal.ok).toBe(true);
    if (normal.ok) {
      expect(normal.value).toBe(42);
    }

    // Both should have the same end result (the value 42)
    expect(flattened.ok && normal.ok && flattened.value === normal.value).toBe(true);
  });
});