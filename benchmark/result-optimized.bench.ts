import { bench, describe } from 'vitest';
import { ok as okOrig, err as errOrig, tryR as tryROrig, wrap as wrapOrig } from '../src/result';
import { ok as okOpt, err as errOpt, tryR as tryROpt, tryRSync, wrap as wrapOpt, releaseError, tryRBatch } from '../src/result-optimized';
import { ZeroError } from '../src/error';

describe('Optimized vs Original - ok/err', () => {
  bench('Original ok()', () => {
    okOrig(42);
  });

  bench('Optimized ok()', () => {
    okOpt(42);
  });

  bench('Original err()', () => {
    errOrig(new Error('test'));
  });

  bench('Optimized err()', () => {
    errOpt(new Error('test'));
  });
});

describe('Optimized vs Original - tryR sync', () => {
  bench('Original tryR - sync success', async () => {
    await tryROrig(() => 42);
  });

  bench('Optimized tryR - sync success', () => {
    const result = tryROpt(() => 42);
    // Handle both sync and async returns
    if (result instanceof Promise) {
      return result;
    }
    return result;
  });

  bench('Optimized tryRSync - sync success', () => {
    tryRSync(() => 42);
  });

  bench('Original tryR - sync failure', async () => {
    await tryROrig(() => { throw new Error('test'); });
  });

  bench('Optimized tryR - sync failure', () => {
    const result = tryROpt(() => { throw new Error('test'); });
    if (result instanceof Promise) {
      return result;
    }
    return result;
  });

  bench('Optimized tryRSync - sync failure', () => {
    tryRSync(() => { throw new Error('test'); });
  });
});

describe('Optimized vs Original - tryR async', () => {
  bench('Original tryR - async success', async () => {
    await tryROrig(async () => 42);
  });

  bench('Optimized tryR - async success', async () => {
    await tryROpt(async () => 42);
  });

  bench('Original tryR - async failure', async () => {
    await tryROrig(async () => { throw new Error('test'); });
  });

  bench('Optimized tryR - async failure', async () => {
    await tryROpt(async () => { throw new Error('test'); });
  });
});

describe('Optimized vs Original - wrap', () => {
  const baseError = new Error('base error');

  bench('Original wrap()', () => {
    wrapOrig(baseError, 'WRAP_ERR', 'Wrapped error');
  });

  bench('Optimized wrap() with pooling', () => {
    const err = wrapOpt(baseError, 'WRAP_ERR', 'Wrapped error');
    // Simulate error being released back to pool
    releaseError(err);
  });

  bench('Original wrap() with context', () => {
    wrapOrig(baseError, 'WRAP_ERR', 'Wrapped error', {
      userId: '123',
      operation: 'test'
    });
  });

  bench('Optimized wrap() with context', () => {
    const err = wrapOpt(baseError, 'WRAP_ERR', 'Wrapped error', {
      userId: '123',
      operation: 'test'
    });
    releaseError(err);
  });
});

describe('Batch operations', () => {
  const operations = Array(10).fill(0).map((_, i) => () => i * 2);
  
  bench('Original tryR - 10 sequential operations', async () => {
    const results = [];
    for (const op of operations) {
      const result = await tryROrig(op);
      if (result.ok) {
        results.push(result.value);
      }
    }
  });

  bench('Optimized tryRBatch - 10 operations', async () => {
    await tryRBatch(operations);
  });
});

describe('Memory allocation comparison', () => {
  bench('Original - 1000 tryR sync calls', async () => {
    for (let i = 0; i < 1000; i++) {
      await tryROrig(() => i);
    }
  });

  bench('Optimized - 1000 tryRSync calls', () => {
    for (let i = 0; i < 1000; i++) {
      tryRSync(() => i);
    }
  });

  bench('Original - 1000 error wraps', () => {
    const base = new Error('base');
    for (let i = 0; i < 1000; i++) {
      wrapOrig(base, 'CODE', 'message');
    }
  });

  bench('Optimized - 1000 pooled error wraps', () => {
    const base = new Error('base');
    for (let i = 0; i < 1000; i++) {
      const err = wrapOpt(base, 'CODE', 'message');
      releaseError(err);
    }
  });
});

describe('Real-world scenario comparison', () => {
  // Simulate a function that might throw
  const riskyOperation = (shouldFail: boolean) => {
    if (shouldFail) throw new Error('Operation failed');
    return { success: true, data: 'result' };
  };

  bench('Original - mixed success/failure pattern', async () => {
    for (let i = 0; i < 100; i++) {
      const result = await tryROrig(() => riskyOperation(i % 3 === 0));
      if (!result.ok) {
        wrapOrig(result.error, 'OP_FAILED', 'Operation failed', { iteration: i });
      }
    }
  });

  bench('Optimized - mixed success/failure pattern', () => {
    for (let i = 0; i < 100; i++) {
      const result = tryRSync(() => riskyOperation(i % 3 === 0));
      if (!result.ok) {
        const err = wrapOpt(result.error, 'OP_FAILED', 'Operation failed', { iteration: i });
        releaseError(err);
      }
    }
  });
});