import { bench, describe } from 'vitest';
import { ok, err, tryR, tryRSync, tryRBatch, wrap } from '../src/result.js';
import { ZeroError } from '../src/error.js';

describe('Result performance - ok/err', () => {
  bench('ok()', () => {
    ok(42);
  });

  bench('err()', () => {
    err(new Error('test'));
  });
});

describe('Result performance - tryR sync', () => {
  bench('tryR - sync success', async () => {
    await tryR(() => 42);
  });

  bench('tryRSync - sync success', () => {
    tryRSync(() => 42);
  });

  bench('tryR - sync failure', async () => {
    await tryR(() => { throw new Error('test'); });
  });

  bench('tryRSync - sync failure', () => {
    tryRSync(() => { throw new Error('test'); });
  });
});

describe('Result performance - tryR async', () => {
  bench('tryR - async success', async () => {
    await tryR(async () => 42);
  });

  bench('tryR - async failure', async () => {
    await tryR(async () => { throw new Error('test'); });
  });
});

describe('Result performance - wrap', () => {
  const baseError = new Error('base error');

  bench('wrap()', () => {
    wrap(baseError, 'WRAP_ERR', 'Wrapped error');
  });

  bench('wrap() with context', () => {
    wrap(baseError, 'WRAP_ERR', 'Wrapped error', {
      userId: '123',
      operation: 'test'
    });
  });
});

describe('Batch operations', () => {
  const operations = Array(10).fill(0).map((_, i) => () => i * 2);
  
  bench('tryR - 10 sequential operations', async () => {
    const results = [];
    for (const op of operations) {
      const result = await tryR(op);
      if (result.ok) {
        results.push(result.value);
      }
    }
  });

  bench('tryRBatch - 10 operations', async () => {
    await tryRBatch(operations);
  });
});

describe('Memory allocation patterns', () => {
  bench('1000 tryR sync calls', async () => {
    for (let i = 0; i < 1000; i++) {
      await tryR(() => i);
    }
  });

  bench('1000 tryRSync calls', () => {
    for (let i = 0; i < 1000; i++) {
      tryRSync(() => i);
    }
  });

  bench('1000 error wraps', () => {
    const base = new Error('base');
    for (let i = 0; i < 1000; i++) {
      wrap(base, 'CODE', 'message');
    }
  });
});

describe('Real-world scenario', () => {
  // Simulate a function that might throw
  const riskyOperation = (shouldFail: boolean) => {
    if (shouldFail) throw new Error('Operation failed');
    return { success: true, data: 'result' };
  };

  bench('Mixed success/failure pattern', async () => {
    for (let i = 0; i < 100; i++) {
      const shouldFail = i % 3 === 0; // ~33% failure rate
      const result = await tryR(() => riskyOperation(shouldFail));
      if (!result.ok) {
        // Simulate error handling
        const wrapped = wrap(result.error, 'OP_FAILED', 'Operation failed in batch');
      }
    }
  });

  bench('tryRSync with mixed pattern', () => {
    for (let i = 0; i < 100; i++) {
      const shouldFail = i % 3 === 0;
      const result = tryRSync(() => riskyOperation(shouldFail));
      if (!result.ok) {
        const wrapped = wrap(result.error, 'OP_FAILED', 'Operation failed in batch');
      }
    }
  });
});