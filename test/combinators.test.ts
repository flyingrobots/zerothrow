import { describe, it, expect } from 'vitest';
import { ok, err, ZeroError, makeCombinable, pipe, collect, collectAsync, firstSuccess, Result } from '../src/index';

// Helper to extract plain Result without combinator methods
function toPlainResult<T, E extends Error>(result: Result<T, E>): Result<T, E> {
  return result.ok ? { ok: true, value: result.value } : { ok: false, error: result.error };
}

describe('makeCombinable', () => {
  it('should add combinator methods to Result', () => {
    const result = makeCombinable(ok(42));
    
    expect(typeof result.andThen).toBe('function');
    expect(typeof result.map).toBe('function');
    expect(typeof result.mapErr).toBe('function');
    expect(typeof result.orElse).toBe('function');
    expect(typeof result.unwrapOr).toBe('function');
    expect(typeof result.unwrapOrThrow).toBe('function');
  });

  describe('andThen', () => {
    it('chains successful operations', () => {
      const result = makeCombinable(ok(5))
        .andThen(x => ok(x * 2))
        .andThen(x => ok(x + 1));
      
      expect(toPlainResult(result)).toEqual({ ok: true, value: 11 });
    });

    it('short-circuits on error', () => {
      const error = new ZeroError('TEST_ERR', 'Failed');
      const result = makeCombinable(ok(5))
        .andThen(x => err(error))
        .andThen(x => ok(x + 1)); // This should not execute
      
      expect(toPlainResult(result)).toEqual({ ok: false, error });
    });

    it('propagates initial error', () => {
      const error = new ZeroError('INITIAL_ERR', 'Initial failure');
      const result = makeCombinable(err<number>(error))
        .andThen(x => ok(x * 2)); // This should not execute
      
      expect(toPlainResult(result)).toEqual({ ok: false, error });
    });
  });

  describe('map', () => {
    it('transforms success values', () => {
      const result = makeCombinable(ok(5))
        .map(x => x * 2)
        .map(x => `Result: ${x}`);
      
      expect(toPlainResult(result)).toEqual({ ok: true, value: 'Result: 10' });
    });

    it('preserves errors', () => {
      const error = new ZeroError('TEST_ERR', 'Failed');
      const result = makeCombinable(err<number>(error))
        .map(x => x * 2);
      
      expect(toPlainResult(result)).toEqual({ ok: false, error });
    });
  });

  describe('mapErr', () => {
    it('transforms error values', () => {
      const original = new Error('Original');
      const result = makeCombinable(err(original))
        .mapErr(e => new ZeroError('MAPPED', `Mapped: ${e.message}`));
      
      expect(result.ok).toBe(false);
      expect((result as any).error.code).toBe('MAPPED');
      expect((result as any).error.message).toBe('Mapped: Original');
    });

    it('preserves success values', () => {
      const result = makeCombinable(ok(42))
        .mapErr(e => new ZeroError('NEVER', 'Should not happen'));
      
      expect(toPlainResult(result)).toEqual({ ok: true, value: 42 });
    });
  });

  describe('orElse', () => {
    it('returns original on success', () => {
      const result = makeCombinable(ok(42))
        .orElse(() => ok(99));
      
      expect(toPlainResult(result)).toEqual({ ok: true, value: 42 });
    });

    it('returns fallback on error', () => {
      const result = makeCombinable(err<number>(new Error('Failed')))
        .orElse(() => ok(99));
      
      expect(toPlainResult(result)).toEqual({ ok: true, value: 99 });
    });

    it('can chain fallbacks', () => {
      const result = makeCombinable(err<number>(new Error('Failed')))
        .orElse(() => err(new Error('Also failed')))
        .orElse(() => ok(42));
      
      expect(toPlainResult(result)).toEqual({ ok: true, value: 42 });
    });
  });

  describe('unwrapOr', () => {
    it('returns value on success', () => {
      const value = makeCombinable(ok(42)).unwrapOr(99);
      expect(value).toBe(42);
    });

    it('returns fallback on error', () => {
      const value = makeCombinable(err<number>(new Error('Failed'))).unwrapOr(99);
      expect(value).toBe(99);
    });
  });

  describe('unwrapOrThrow', () => {
    it('returns value on success', () => {
      const value = makeCombinable(ok(42)).unwrapOrThrow();
      expect(value).toBe(42);
    });

    it('throws error on failure', () => {
      const error = new Error('Test error');
      expect(() => makeCombinable(err(error)).unwrapOrThrow()).toThrow(error);
    });
  });
});

describe('pipe', () => {
  it('composes functions left to right', () => {
    const add5 = (x: number) => x + 5;
    const double = (x: number) => x * 2;
    const toString = (x: number) => `Result: ${x}`;
    
    const pipeline = pipe(add5, double, toString);
    const result = pipeline(10);
    
    expect(result).toBe('Result: 30'); // (10 + 5) * 2 = 30
  });

  it('works with single function', () => {
    const double = (x: number) => x * 2;
    const pipeline = pipe(double);
    
    expect(pipeline(5)).toBe(10);
  });

  it('works with empty pipeline', () => {
    const pipeline = pipe();
    expect(pipeline(42)).toBe(42);
  });
});

describe('collect', () => {
  it('collects all successful results', () => {
    const results = [
      ok(1),
      ok(2),
      ok(3)
    ];
    
    const collected = collect(results);
    expect(collected).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('fails on first error', () => {
    const error = new ZeroError('TEST_ERR', 'Failed at index 1');
    const results = [
      ok(1),
      err(error),
      ok(3) // This should not be evaluated
    ];
    
    const collected = collect(results);
    expect(collected).toEqual({ ok: false, error });
  });

  it('handles empty array', () => {
    const collected = collect([]);
    expect(collected).toEqual({ ok: true, value: [] });
  });

  it('preserves types correctly', () => {
    const results = [
      ok('hello'),
      ok('world')
    ];
    
    const collected = collect(results);
    expect(collected.ok).toBe(true);
    expect((collected as any).value).toEqual(['hello', 'world']);
  });
});

describe('collectAsync', () => {
  it('collects all successful async results', async () => {
    const promises = [
      Promise.resolve(ok(1)),
      Promise.resolve(ok(2)),
      Promise.resolve(ok(3))
    ];
    
    const collected = await collectAsync(promises);
    expect(collected).toEqual({ ok: true, value: [1, 2, 3] });
  });

  it('fails on first error in async results', async () => {
    const error = new ZeroError('ASYNC_ERR', 'Async failure');
    const promises = [
      Promise.resolve(ok(1)),
      Promise.resolve(err(error)),
      Promise.resolve(ok(3))
    ];
    
    const collected = await collectAsync(promises);
    expect(collected).toEqual({ ok: false, error });
  });

  it('handles mixed timing of promises', async () => {
    const promises = [
      new Promise<typeof ok1>(resolve => setTimeout(() => resolve(ok(1)), 10)),
      Promise.resolve(ok(2)),
      new Promise<typeof ok3>(resolve => setTimeout(() => resolve(ok(3)), 5))
    ];
    
    const collected = await collectAsync(promises);
    expect(collected).toEqual({ ok: true, value: [1, 2, 3] });
  });
});

describe('firstSuccess', () => {
  it('returns first successful result', () => {
    const results = [
      () => err(new Error('First failed')),
      () => ok(42),
      () => ok(99) // Should not be evaluated
    ];
    
    const first = firstSuccess(results);
    expect(first).toEqual({ ok: true, value: 42 });
  });

  it('returns custom error when all fail', () => {
    const results = [
      () => err(new Error('First failed')),
      () => err(new Error('Second failed')),
      () => err(new Error('Third failed'))
    ];
    
    const first = firstSuccess(results);
    expect(first.ok).toBe(false);
    expect((first as any).error.code).toBe('ALL_FAILED');
    expect((first as any).error.message).toBe('All alternatives failed');
  });

  it('works with single successful option', () => {
    const results = [() => ok('success')];
    const first = firstSuccess(results);
    
    expect(first).toEqual({ ok: true, value: 'success' });
  });

  it('works with empty array', () => {
    const first = firstSuccess([]);
    expect(first.ok).toBe(false);
    expect((first as any).error.code).toBe('ALL_FAILED');
  });

  it('evaluates lazily', () => {
    let evaluated = 0;
    const results = [
      () => { evaluated++; return err(new Error('Failed')); },
      () => { evaluated++; return ok(42); },
      () => { evaluated++; return ok(99); } // Should not be evaluated
    ];
    
    const first = firstSuccess(results);
    expect(first).toEqual({ ok: true, value: 42 });
    expect(evaluated).toBe(2); // Only first two should be evaluated
  });
});