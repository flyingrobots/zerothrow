import { describe, it, expect } from 'vitest';
import { ZT } from '../src/index.js';

describe('tryRSync', () => {
  it('should handle sync success', () => {
    const result = ZT.tryRSync(() => 42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('should handle sync failure', () => {
    const result = ZT.tryRSync(() => {
      throw new Error('test error');
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ZT.Error);
      expect(result.error.code).toBe('UNKNOWN_ERR');
      expect(result.error.message).toBe('test error');
    }
  });

  it('should apply map function on error', () => {
    const result = ZT.tryRSync(
      () => {
        throw new Error('original');
      },
      (e) => new ZT.Error('MAPPED', 'Mapped: ' + e.message)
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MAPPED');
      expect(result.error.message).toBe('Mapped: original');
    }
  });

  it('should preserve ZeroError instances', () => {
    const customError = new ZT.Error('CUSTOM', 'Custom error');
    const result = ZT.tryRSync(() => {
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

    const result = await ZT.tryRBatch(fns);
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

    const result = await ZT.tryRBatch(fns);
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

    const result = await ZT.tryRBatch(fns);
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

    const result = await ZT.tryRBatch(
      fns,
      (e) => new ZT.Error('BATCH_ERR', 'Batch failed: ' + e.message)
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BATCH_ERR');
      expect(result.error.message).toBe('Batch failed: original');
    }
  });

  it('should handle empty array', async () => {
    const result = await ZT.tryRBatch([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });
});

describe('optimized tryR', () => {
  it('should still return Promise for backward compatibility', async () => {
    const result = ZT.tryR(() => 42);
    expect(result).toBeInstanceOf(Promise);
    const resolved = await result;
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value).toBe(42);
    }
  });

  it('should handle promises efficiently', async () => {
    const result = await ZT.tryR(async () => 'async value');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('async value');
    }
  });
});
