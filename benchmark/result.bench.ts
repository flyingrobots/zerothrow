import { bench, describe } from 'vitest';
import { ok, err, tryR, wrap, ZeroError } from '../src/index';

// Baseline comparisons
const nativeThrow = () => {
  try {
    throw new Error('test error');
  } catch (e) {
    return e;
  }
};

const nativeReturn = () => {
  return { success: false, error: new Error('test error') };
};

describe('Result Creation Performance', () => {
  bench('ok() - simple value', () => {
    ok(42);
  });

  bench('ok() - object value', () => {
    ok({ id: 1, name: 'test', data: [1, 2, 3, 4, 5] });
  });

  bench('err() - simple error', () => {
    err(new Error('test'));
  });

  bench('err() - ZeroError', () => {
    err(new ZeroError('TEST_ERR', 'Test error'));
  });

  bench('native throw/catch (baseline)', () => {
    nativeThrow();
  });

  bench('native return object (baseline)', () => {
    nativeReturn();
  });
});

describe('tryR Performance', () => {
  bench('tryR - sync success', async () => {
    await tryR(() => 42);
  });

  bench('tryR - async success', async () => {
    await tryR(async () => 42);
  });

  bench('tryR - sync failure', async () => {
    await tryR(() => { throw new Error('test'); });
  });

  bench('tryR - async failure', async () => {
    await tryR(async () => { throw new Error('test'); });
  });

  bench('tryR - with map function', async () => {
    await tryR(
      () => { throw new Error('test'); },
      (e) => new ZeroError('MAPPED', 'Mapped error', { cause: e })
    );
  });

  bench('native async/await try/catch (baseline)', async () => {
    try {
      await Promise.resolve(42);
    } catch (e) {
      return e;
    }
  });
});

describe('Error Normalization Performance', () => {
  bench('tryR - Error instance', async () => {
    await tryR(() => { throw new Error('test'); });
  });

  bench('tryR - ZeroError instance', async () => {
    await tryR(() => { throw new ZeroError('CODE', 'message'); });
  });

  bench('tryR - string throw', async () => {
    await tryR(() => { throw 'string error'; });
  });

  bench('tryR - object throw', async () => {
    await tryR(() => { throw { code: 'ERR', message: 'test' }; });
  });

  bench('tryR - null throw', async () => {
    await tryR(() => { throw null; });
  });
});

describe('wrap Performance', () => {
  const baseError = new Error('base error');

  bench('wrap - simple', () => {
    wrap(baseError, 'WRAP_ERR', 'Wrapped error');
  });

  bench('wrap - with context', () => {
    wrap(baseError, 'WRAP_ERR', 'Wrapped error', {
      userId: '123',
      operation: 'test',
      timestamp: Date.now()
    });
  });

  bench('native Error wrapping (baseline)', () => {
    const e = new Error('Wrapped error');
    e.cause = baseError;
    return e;
  });
});

describe('Memory Allocation Tests', () => {
  bench('ok() allocation - 1000 iterations', () => {
    for (let i = 0; i < 1000; i++) {
      ok(i);
    }
  });

  bench('err() allocation - 1000 iterations', () => {
    const error = new Error('test');
    for (let i = 0; i < 1000; i++) {
      err(error);
    }
  });

  bench('tryR allocation - 1000 iterations', async () => {
    for (let i = 0; i < 1000; i++) {
      await tryR(() => i);
    }
  });
});

describe('Real-world Scenarios', () => {
  // Simulate database operation
  const dbOperation = async (shouldFail: boolean) => {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (shouldFail) throw new Error('DB connection failed');
    return { id: 1, data: 'result' };
  };

  bench('DB operation - success path', async () => {
    const result = await tryR(() => dbOperation(false));
    if (result.ok) {
      return result.value;
    }
  });

  bench('DB operation - error path with wrap', async () => {
    const result = await tryR(() => dbOperation(true));
    if (!result.ok) {
      return wrap(result.error, 'DB_ERR', 'Database operation failed', {
        operation: 'select',
        table: 'users'
      });
    }
  });

  // Simulate API request parsing
  const parseJSON = (str: string) => {
    return tryR(() => JSON.parse(str));
  };

  bench('JSON parsing - valid', async () => {
    await parseJSON('{"id":1,"name":"test"}');
  });

  bench('JSON parsing - invalid', async () => {
    await parseJSON('{invalid json}');
  });
});