import { describe, it, expect } from 'vitest';
import { ZT, ZeroThrow } from '../src/index.js';

// Helper to extract plain Result without combinator methods
function toPlainResult<T, E extends Error>(result: ZeroThrow.Result<T, E>): ZeroThrow.Result<T, E> {
  return result.ok
    ? { ok: true, value: result.value }
    : { ok: false, error: result.error };
}

describe('Result Combinators', () => {
  it('all Results have combinator methods by default', () => {
    const result = ZT.ok(42);

    expect(typeof result.andThen).toBe('function');
    expect(typeof result.map).toBe('function');
    expect(typeof result.mapErr).toBe('function');
    expect(typeof result.orElse).toBe('function');
    expect(typeof result.unwrapOr).toBe('function');
    expect(typeof result.unwrapOrThrow).toBe('function');
    expect(typeof result.unwrapOrElse).toBe('function');
  });

  describe('andThen', () => {
    it('chains successful operations', () => {
      const result = ZT.ok(5)
        .andThen((x) => ZT.ok(x * 2))
        .andThen((x) => ZT.ok(x + 1));

      expect(toPlainResult(result)).toEqual({ ok: true, value: 11 });
    });

    it('short-circuits on error', () => {
      const error = new ZeroThrow.ZeroError('TEST_ERR', 'Failed');
      const result = ZT.ok(5)
        .andThen((_x) => ZT.err(error))
        .andThen((_x) => ZT.ok(_x + 1)); // This should not execute

      expect(toPlainResult(result)).toEqual({ ok: false, error });
    });

    it('propagates initial error', () => {
      const error = new ZeroThrow.ZeroError('INITIAL_ERR', 'Initial failure');
      const result = ZT.err<number>(error).andThen((x) =>
        ZT.ok(x * 2)
      ); // This should not execute

      expect(toPlainResult(result)).toEqual({ ok: false, error });
    });
  });

  describe('map', () => {
    it('transforms success values', () => {
      const result = ZT.ok(5)
        .map((x) => x * 2)
        .map((x) => `Result: ${x}`);

      expect(toPlainResult(result)).toEqual({ ok: true, value: 'Result: 10' });
    });

    it('preserves errors', () => {
      const error = new ZeroThrow.ZeroError('TEST_ERR', 'Failed');
      const result = ZT.err<number>(error).map((x) => x * 2);

      expect(toPlainResult(result)).toEqual({ ok: false, error });
    });
  });

  describe('mapErr', () => {
    it('transforms error values', () => {
      const original = new Error('Original');
      const result = ZT.err(original).mapErr(
        (e) => new ZeroThrow.ZeroError('MAPPED', `Mapped: ${e.message}`)
      );

      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe('MAPPED');
      expect((result as any).error.message).toBe('Mapped: Original');
    });

    it('preserves success values', () => {
      const result = ZT.ok(42).mapErr(
        (_e) => new ZeroThrow.ZeroError('NEVER', 'Should not happen')
      );

      expect(toPlainResult(result)).toEqual({ ok: true, value: 42 });
    });
  });

  describe('orElse', () => {
    it('returns original on success', () => {
      const result = ZT.ok(42).orElse(() => ZT.ok(99));

      expect(toPlainResult(result)).toEqual({ ok: true, value: 42 });
    });

    it('returns fallback on error', () => {
      const result = ZT.err<number>(new Error('Failed')).orElse(
        () => ZT.ok(99)
      );

      expect(toPlainResult(result)).toEqual({ ok: true, value: 99 });
    });

    it('can chain fallbacks', () => {
      const result = ZT.err<number>(new Error('Failed'))
        .orElse(() => ZT.err(new Error('Also failed')))
        .orElse(() => ZT.ok(42));

      expect(toPlainResult(result)).toEqual({ ok: true, value: 42 });
    });
  });

  describe('unwrapOr', () => {
    it('returns value on success', () => {
      const value = ZT.ok(42).unwrapOr(99);
      expect(value).toBe(42);
    });

    it('returns fallback on error', () => {
      const value = ZT.err<number>(new Error('Failed')).unwrapOr(
        99
      );
      expect(value).toBe(99);
    });
  });

  describe('unwrapOrThrow', () => {
    it('returns value on success', () => {
      const value = ZT.ok(42).unwrapOrThrow();
      expect(value).toBe(42);
    });

    it('throws error on failure', () => {
      const error = new Error('Test error');
      expect(() => ZT.err(error).unwrapOrThrow()).toThrow(error);
    });
  });

  describe('unwrapOrElse', () => {
    it('returns value on success', () => {
      const value = ZT.ok(42).unwrapOrElse(() => 99);
      expect(value).toBe(42);
    });

    it('returns computed fallback on error', () => {
      const error = new ZeroThrow.ZeroError('TEST_ERR', 'Test error');
      const value = ZT.err<number>(error).unwrapOrElse((e) => {
        expect(e.code).toBe('TEST_ERR');
        return 99;
      });
      expect(value).toBe(99);
    });

    it('passes error to fallback function', () => {
      const error = new ZeroThrow.ZeroError('CALC_ERR', 'Calculation failed');
      const value = ZT.err<number>(error).unwrapOrElse((e) => {
        if (e.code === 'CALC_ERR') return 0;
        return -1;
      });
      expect(value).toBe(0);
    });

    it('supports complex fallback computation', () => {
      const error = new ZeroThrow.ZeroError('NETWORK_ERR', 'Network timeout');
      const value = ZT.err<string>(error).unwrapOrElse((e) => {
        return `Fallback: ${e.message}`;
      });
      expect(value).toBe('Fallback: Network timeout');
    });
  });
});

describe('Monad API Chaining', () => {
  it('supports complex method chaining', () => {
    // Simulate a complex workflow: parse number, double it, validate range, format
    const parseNumber = (input: string): ZeroThrow.Result<number, ZeroThrow.ZeroError> => {
      const num = Number(input);
      return isNaN(num) ? ZT.err(new ZeroThrow.ZeroError('PARSE_ERR', 'Invalid number')) : ZT.ok(num);
    };

    const validateRange = (num: number): ZeroThrow.Result<number, ZeroThrow.ZeroError> => {
      return num > 100 ? ZT.err(new ZeroThrow.ZeroError('RANGE_ERR', 'Number too large')) : ZT.ok(num);
    };

    const result = parseNumber('5')
      .map(n => n * 2)                           // Transform: 5 -> 10
      .andThen(n => validateRange(n))            // Chain validation
      .mapErr(e => new ZeroThrow.ZeroError('CALC_ERR', `Calculation failed: ${e.message}`))
      .orElse(() => ZT.ok(0))                    // Fallback to 0 on error
      .map(n => `Result: ${n}`)                  // Format as string
      .unwrapOr('No result');

    expect(result).toBe('Result: 10');
  });

  it('chains with error propagation', () => {
    const parseNumber = (input: string): ZeroThrow.Result<number, ZeroThrow.ZeroError> => {
      const num = Number(input);
      return isNaN(num) ? ZT.err(new ZeroThrow.ZeroError('PARSE_ERR', 'Invalid number')) : ZT.ok(num);
    };

    const validateRange = (num: number): ZeroThrow.Result<number, ZeroThrow.ZeroError> => {
      return num > 100 ? ZT.err(new ZeroThrow.ZeroError('RANGE_ERR', 'Number too large')) : ZT.ok(num);
    };

    const result = parseNumber('invalid')
      .map(n => n * 2)                           // Should not execute
      .andThen(n => validateRange(n))            // Should not execute
      .mapErr(e => new ZeroThrow.ZeroError('CALC_ERR', `Calculation failed: ${e.message}`))
      .map(n => `Result: ${n}`)                  // Should not execute
      .unwrapOrElse(e => `Error: ${e.message}`); // Should execute with transformed error

    expect(result).toBe('Error: Calculation failed: Invalid number');
  });

  it('chains with orElse recovery', () => {
    const parseNumber = (input: string): ZeroThrow.Result<number, ZeroThrow.ZeroError> => {
      const num = Number(input);
      return isNaN(num) ? ZT.err(new ZeroThrow.ZeroError('PARSE_ERR', 'Invalid number')) : ZT.ok(num);
    };

    const result = parseNumber('invalid')
      .map(n => n * 2)                           // Should not execute
      .orElse(() => ZT.ok(42))                   // Recover with default value
      .map(n => n + 8)                           // Should execute: 42 + 8 = 50
      .unwrapOr(0);

    expect(result).toBe(50);
  });

  it('preserves types through chain', () => {
    const result = ZT.ok(42)
      .map(n => n.toString())                    // number -> string
      .andThen(s => ZT.ok(s.length))             // string -> number
      .map(len => len > 1)                       // number -> boolean
      .unwrapOr(false);

    expect(result).toBe(true);  // "42".length = 2, which is > 1
  });
});

describe('pipe', () => {
  it('composes functions left to right', () => {
    const add5 = (x: number) => x + 5;
    const double = (x: number) => x * 2;
    const toString = (x: number) => `Result: ${x}`;

    const pipeline = ZeroThrow.pipe(add5, double, toString);
    const result = pipeline(10);

    expect(result).toBe('Result: 30'); // (10 + 5) * 2 = 30
  });

  it('works with single function', () => {
    const double = (x: number) => x * 2;
    const pipeline = ZeroThrow.pipe(double);

    expect(pipeline(5)).toBe(10);
  });

  it('works with empty pipeline', () => {
    const pipeline = ZeroThrow.pipe();
    expect(pipeline(42)).toBe(42);
  });
});

describe('collect', () => {
  it('collects all successful results', () => {
    const results = [ZT.ok(1), ZT.ok(2), ZT.ok(3)];

    const collected = ZeroThrow.collect(results);
    expect(collected.ok).toBe(true);
    expect(collected.value).toEqual([1, 2, 3]);
  });

  it('fails on first error', () => {
    const error = new ZeroThrow.ZeroError('TEST_ERR', 'Failed at index 1');
    const results = [
      ZT.ok(1),
      ZT.err(error),
      ZT.ok(3), // This should not be evaluated
    ];

    const collected = ZeroThrow.collect(results);
    expect(collected.ok).toBe(false);
    expect(collected.error).toEqual(error);
  });

  it('handles empty array', () => {
    const collected = ZeroThrow.collect([]);
    expect(collected.ok).toBe(true);
    expect(collected.value).toEqual([]);
  });

  it('preserves types correctly', () => {
    const results = [ZT.ok('hello'), ZT.ok('world')];

    const collected = ZeroThrow.collect(results);
    expect(collected.ok).toBe(true);
    expect((collected as any).value).toEqual(['hello', 'world']);
  });
});

describe('collectAsync', () => {
  it('collects all successful async results', async () => {
    const promises = [
      Promise.resolve(ZT.ok(1)),
      Promise.resolve(ZT.ok(2)),
      Promise.resolve(ZT.ok(3)),
    ];

    const collected = await ZeroThrow.collectAsync(promises);
    expect(collected.ok).toBe(true);
    expect(collected.value).toEqual([1, 2, 3]);
  });

  it('fails on first error in async results', async () => {
    const error = new ZeroThrow.ZeroError('ASYNC_ERR', 'Async failure');
    const promises = [
      Promise.resolve(ZT.ok(1)),
      Promise.resolve(ZT.err(error)),
      Promise.resolve(ZT.ok(3)),
    ];

    const collected = await ZeroThrow.collectAsync(promises);
    expect(collected.ok).toBe(false);
    expect(collected.error).toEqual(error);
  });

  it('handles mixed timing of promises', async () => {
    const promises = [
      new Promise<ZeroThrow.Result<number, Error>>((resolve) =>
        setTimeout(() => resolve(ZT.ok(1)), 10)
      ),
      Promise.resolve(ZT.ok(2)),
      new Promise<ZeroThrow.Result<number, Error>>((resolve) => setTimeout(() => resolve(ZT.ok(3)), 5)),
    ];

    const collected = await ZeroThrow.collectAsync(promises);
    expect(collected.ok).toBe(true);
    expect(collected.value).toEqual([1, 2, 3]);
  });
});

describe('firstSuccess', () => {
  it('returns first successful result', () => {
    const results = [
      () => ZT.err(new Error('First failed')),
      () => ZT.ok(42),
      () => ZT.ok(99), // Should not be evaluated
    ];

    const first = ZeroThrow.firstSuccess(results);
    expect(first.ok).toBe(true);
    expect(first.value).toBe(42);
  });

  it('returns custom error when all fail', () => {
    const results = [
      () => ZT.err(new Error('First failed')),
      () => ZT.err(new Error('Second failed')),
      () => ZT.err(new Error('Third failed')),
    ];

    const first = ZeroThrow.firstSuccess(results);
    expect(first.ok).toBe(false);
    expect((first as any).error.code).toBe('ALL_FAILED');
    expect((first as any).error.message).toBe('All alternatives failed');
  });

  it('works with single successful option', () => {
    const results = [() => ZT.ok('success')];
    const first = ZeroThrow.firstSuccess(results);

    expect(first.ok).toBe(true);
    expect(first.value).toBe('success');
  });

  it('works with empty array', () => {
    const first = ZeroThrow.firstSuccess([]);
    expect(first.ok).toBe(false);
    expect((first as any).error.code).toBe('ALL_FAILED');
  });

  it('evaluates lazily', () => {
    let evaluated = 0;
    const results = [
      () => {
        evaluated++;
        return ZT.err(new Error('Failed'));
      },
      () => {
        evaluated++;
        return ZT.ok(42);
      },
      () => {
        evaluated++;
        return ZT.ok(99);
      }, // Should not be evaluated
    ];

    const first = ZeroThrow.firstSuccess(results);
    expect(first.ok).toBe(true);
    expect(first.value).toBe(42);
    expect(evaluated).toBe(2); // Only first two should be evaluated
  });
});
