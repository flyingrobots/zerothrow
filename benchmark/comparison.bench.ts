import { bench, describe } from 'vitest';
import { ok, err, tryR, tryRSync, ZeroError } from '../src/index.js';

/**
 * Performance comparison with other error handling patterns
 * 
 * Comparing zerothrow with:
 * 1. Native try/catch
 * 2. neverthrow-style pattern
 * 3. fp-ts Either pattern
 * 4. Custom Result implementations
 */

// Native JavaScript error handling
const nativeTryCatch = <T>(fn: () => T): { success: boolean; data?: T; error?: Error } => {
  try {
    return { success: true, data: fn() };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
};

// Neverthrow-style implementation (simplified)
class NeverthrowResult<T, E> {
  constructor(
    private readonly _isOk: boolean,
    private readonly _value?: T,
    private readonly _error?: E
  ) {}

  static ok<T>(value: T): NeverthrowResult<T, never> {
    return new NeverthrowResult(true, value, undefined);
  }

  static err<E>(error: E): NeverthrowResult<never, E> {
    return new NeverthrowResult(false, undefined, error);
  }

  get isOk(): boolean { return this._isOk; }
  get isErr(): boolean { return !this._isOk; }
  
  unwrap(): T {
    if (!this._isOk) throw new Error('Called unwrap on an Err');
    return this._value!;
  }
}

// fp-ts style Either (simplified)
type Left<E> = { _tag: 'Left'; left: E };
type Right<A> = { _tag: 'Right'; right: A };
type Either<E, A> = Left<E> | Right<A>;

const left = <E>(e: E): Either<E, never> => ({ _tag: 'Left', left: e });
const right = <A>(a: A): Either<never, A> => ({ _tag: 'Right', right: a });
const isRight = <E, A>(ma: Either<E, A>): ma is Right<A> => ma._tag === 'Right';

// Simple custom Result
type SimpleResult<T, E> = 
  | { type: 'ok'; value: T }
  | { type: 'error'; error: E };

const simpleOk = <T>(value: T): SimpleResult<T, never> => ({ type: 'ok', value });
const simpleErr = <E>(error: E): SimpleResult<never, E> => ({ type: 'error', error });

describe('Result Creation - Library Comparison', () => {
  bench('zerothrow - ok()', () => {
    ok(42);
  });

  bench('neverthrow-style - ok()', () => {
    NeverthrowResult.ok(42);
  });

  bench('fp-ts style - right()', () => {
    right(42);
  });

  bench('simple custom - ok()', () => {
    simpleOk(42);
  });

  bench('native - success object', () => {
    ({ success: true, data: 42 });
  });
});

describe('Error Creation - Library Comparison', () => {
  const error = new Error('test error');

  bench('zerothrow - err()', () => {
    err(error);
  });

  bench('neverthrow-style - err()', () => {
    NeverthrowResult.err(error);
  });

  bench('fp-ts style - left()', () => {
    left(error);
  });

  bench('simple custom - err()', () => {
    simpleErr(error);
  });

  bench('native - error object', () => {
    ({ success: false, error });
  });
});

describe('Try/Catch Wrapper - Library Comparison', () => {
  bench('zerothrow - tryRSync', () => {
    tryRSync(() => 42);
  });

  bench('zerothrow - tryR (async)', async () => {
    await tryR(() => 42);
  });

  bench('native try/catch wrapper', () => {
    nativeTryCatch(() => 42);
  });

  bench('neverthrow-style wrapper', () => {
    try {
      return NeverthrowResult.ok(42);
    } catch (e) {
      return NeverthrowResult.err(e);
    }
  });

  bench('fp-ts style wrapper', () => {
    try {
      return right(42);
    } catch (e) {
      return left(e);
    }
  });
});

describe('Error Handling Flow - Library Comparison', () => {
  const riskyOperation = () => {
    if (Math.random() > 0.5) throw new Error('Random failure');
    return 42;
  };

  bench('zerothrow - full flow with tryRSync', () => {
    const result = tryRSync(riskyOperation);
    if (result.ok) {
      return result.value * 2;
    } else {
      return 0;
    }
  });

  bench('native - full flow', () => {
    const result = nativeTryCatch(riskyOperation);
    if (result.success) {
      return result.data! * 2;
    } else {
      return 0;
    }
  });

  bench('neverthrow-style - full flow', () => {
    let result: NeverthrowResult<number, Error>;
    try {
      result = NeverthrowResult.ok(riskyOperation());
    } catch (e) {
      result = NeverthrowResult.err(e as Error);
    }
    
    if (result.isOk) {
      return result.unwrap() * 2;
    } else {
      return 0;
    }
  });

  bench('fp-ts style - full flow', () => {
    let result: Either<Error, number>;
    try {
      result = right(riskyOperation());
    } catch (e) {
      result = left(e as Error);
    }
    
    if (isRight(result)) {
      return result.right * 2;
    } else {
      return 0;
    }
  });
});

describe('Memory Efficiency - 1000 operations', () => {
  bench('zerothrow - 1000 ok() calls', () => {
    for (let i = 0; i < 1000; i++) {
      ok(i);
    }
  });

  bench('neverthrow-style - 1000 ok() calls', () => {
    for (let i = 0; i < 1000; i++) {
      NeverthrowResult.ok(i);
    }
  });

  bench('fp-ts style - 1000 right() calls', () => {
    for (let i = 0; i < 1000; i++) {
      right(i);
    }
  });

  bench('simple custom - 1000 ok() calls', () => {
    for (let i = 0; i < 1000; i++) {
      simpleOk(i);
    }
  });

  bench('native - 1000 success objects', () => {
    for (let i = 0; i < 1000; i++) {
      ({ success: true, data: i });
    }
  });
});

describe('Complex Error Handling - Library Comparison', () => {
  const complexOperation = async (id: number) => {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (id % 3 === 0) throw new Error(`Failed for id: ${id}`);
    return { id, data: `result-${id}` };
  };

  bench('zerothrow - async error handling', async () => {
    const result = await tryR(() => complexOperation(Math.floor(Math.random() * 10)));
    if (!result.ok) {
      return err(new ZeroError('COMPLEX_ERR', 'Operation failed', { cause: result.error }));
    }
    return result;
  });

  bench('native - async try/catch', async () => {
    try {
      const data = await complexOperation(Math.floor(Math.random() * 10));
      return { success: true, data };
    } catch (e) {
      return { 
        success: false, 
        error: new Error('Operation failed', { cause: e as Error })
      };
    }
  });

  bench('neverthrow-style - async handling', async () => {
    try {
      const data = await complexOperation(Math.floor(Math.random() * 10));
      return NeverthrowResult.ok(data);
    } catch (e) {
      return NeverthrowResult.err(new Error('Operation failed', { cause: e as Error }));
    }
  });
});

describe('Pattern Matching - Library Comparison', () => {
  const result = Math.random() > 0.5 ? ok(42) : err(new Error('failed'));
  
  bench('zerothrow - pattern matching', () => {
    if (result.ok) {
      return result.value * 2;
    } else {
      return -1;
    }
  });

  const neverthrowResult = Math.random() > 0.5 
    ? NeverthrowResult.ok(42) 
    : NeverthrowResult.err(new Error('failed'));
    
  bench('neverthrow-style - pattern matching', () => {
    if (neverthrowResult.isOk) {
      return neverthrowResult.unwrap() * 2;
    } else {
      return -1;
    }
  });

  const eitherResult: Either<Error, number> = Math.random() > 0.5 
    ? right(42) 
    : left(new Error('failed'));
    
  bench('fp-ts style - pattern matching', () => {
    if (isRight(eitherResult)) {
      return eitherResult.right * 2;
    } else {
      return -1;
    }
  });

  const nativeResult = Math.random() > 0.5 
    ? { success: true as const, data: 42 }
    : { success: false as const, error: new Error('failed') };
    
  bench('native - pattern matching', () => {
    if (nativeResult.success) {
      return nativeResult.data * 2;
    } else {
      return -1;
    }
  });
});