import { describe, it, expect } from 'vitest';
import { ZT, ZeroThrow } from '../src/index.js';

describe('tryRSync', () => {
  it('should handle sync success', () => {
    const result = ZT.try(() => 42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('should handle sync failure', () => {
    const result = ZT.try(() => {
      throw new Error('test error');
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ZeroThrow.ZeroError);
      expect(result.error.code).toBe('UNKNOWN_ERR');
      expect(result.error.message).toBe('test error');
    }
  });

  it('should apply map function on error', () => {
    const result = ZT.try(
      () => {
        throw new Error('original');
      },
      (e) => new ZeroThrow.ZeroError('MAPPED', 'Mapped: ' + e.message)
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MAPPED');
      expect(result.error.message).toBe('Mapped: original');
    }
  });

  it('should preserve ZeroError instances', () => {
    const customError = new ZeroThrow.ZeroError('CUSTOM', 'Custom error');
    const result = ZT.try(() => {
      throw customError;
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(customError);
    }
  });
});

describe('tryRBatch', () => {
  it('should handle all successful operations', async () => {
    const fns = [() => 1, () => 2, async () => 3, () => 4];

    const result = await ZT.try(fns);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([1, 2, 3, 4]);
    }
  });

  it('should stop on first error', async () => {
    const fns = [
      () => 1,
      () => {
        throw new Error('failed at 2');
      },
      () => 3, // This should not execute
    ];

    const result = await ZT.try(fns);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('failed at 2');
    }
  });

  it('should handle async errors', async () => {
    const fns = [
      () => 1,
      async () => {
        throw new Error('async fail');
      },
      () => 3,
    ];

    const result = await ZT.try(fns);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('async fail');
    }
  });

  it('should apply map function to errors', async () => {
    const fns = [
      () => 1,
      () => {
        throw new Error('original');
      },
    ];

    const result = await ZT.try(
      fns,
      (e) => new ZeroThrow.ZeroError('BATCH_ERR', 'Batch failed: ' + e.message)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BATCH_ERR');
      expect(result.error.message).toBe('Batch failed: original');
    }
  });

  it('should handle empty array', async () => {
    const result = await ZT.try([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });
});

describe('optimized tryR', () => {
  it('should return Result directly for synchronous functions', () => {
    const result = ZT.try(() => 42);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('should handle promises efficiently', async () => {
    const result = await ZT.try(async () => 'async value');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('async value');
    }
  });
});
