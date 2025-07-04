import { describe, it, expect } from 'vitest';
import { ZT, ZeroThrow } from '../src/index.js';

describe('Result helpers', () => {
  it('ok()', () => {
    const result = ZT.ok(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });
  it('err()', () => {
    const e = new Error('boom');
    const result = ZT.err(e);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(e);
  });
  it('ZT.try success', async () => {
    const r = await ZT.try(() => 1);
    expect(r.ok).toBe(true);
  });
  it('ZT.try failure', async () => {
    const r = await ZT.try(() => {
      throw new Error('bad');
    });
    expect(r.ok).toBe(false);
  });
});

describe('wrap function', () => {
  it('wraps an error with code and message', () => {
    const cause = new Error('original error');
    const wrapped = ZeroThrow.wrap(cause, 'DB_ERR', 'Database connection failed');

    expect(wrapped).toBeInstanceOf(ZeroThrow.ZeroError);
    expect(wrapped.code).toBe('DB_ERR');
    expect(wrapped.message).toBe('Database connection failed');
    expect(wrapped.cause).toBe(cause);
  });

  it('wraps an error with context', () => {
    const cause = new Error('original error');
    const context = { userId: '123', operation: 'fetch' };
    const wrapped = ZeroThrow.wrap(cause, 'USER_ERR', 'User operation failed', context);

    expect(wrapped.context).toEqual(context);
  });

  it("uses cause's message when msg not provided", () => {
    const cause = new Error('original error message');
    const wrapped = ZeroThrow.wrap(cause, 'DB_ERR');

    expect(wrapped.message).toBe('original error message');
    expect(wrapped.code).toBe('DB_ERR');
    expect(wrapped.cause).toBe(cause);
  });

  it('extracts code and message from ZeroError cause', () => {
    const cause = new ZeroThrow.ZeroError('ORIGINAL_CODE', 'original message');
    const wrapped = ZeroThrow.wrap(cause);

    expect(wrapped.code).toBe('ORIGINAL_CODE');
    expect(wrapped.message).toBe('original message');
    expect(wrapped.cause).toBe(cause);
  });

  it('uses WRAPPED_ERROR code for regular errors when code not provided', () => {
    const cause = new Error('some error');
    const wrapped = ZeroThrow.wrap(cause);

    expect(wrapped.code).toBe('WRAPPED_ERROR');
    expect(wrapped.message).toBe('some error');
    expect(wrapped.cause).toBe(cause);
  });

  it('preserves stack trace through cause chain', () => {
    const cause = new Error('original error');
    const wrapped = ZeroThrow.wrap(cause, 'WRAP_CODE', 'wrapped message');

    expect(wrapped.cause).toBe(cause);
    expect(wrapped.stack).toContain('wrap');
    // The original error's stack is preserved via the cause chain
    expect(cause.stack).toBeDefined();
  });

  it('displays full error chain with toString()', () => {
    const originalError = new Error('database connection timeout');
    const dbError = ZeroThrow.wrap(originalError, 'DB_ERROR', 'Failed to fetch user', {
      userId: 123,
    });
    const apiError = ZeroThrow.wrap(dbError, 'API_ERROR', 'User endpoint failed', {
      endpoint: '/api/user/123',
    });

    const str = apiError.toString();

    // Check top-level error
    expect(str).toContain('ZeroError [API_ERROR]: User endpoint failed');
    expect(str).toContain('"endpoint": "/api/user/123"');

    // Check middle error
    expect(str).toContain('Caused by: ZeroError: Failed to fetch user');
    expect(str).toContain('"userId": 123');

    // Check original error
    expect(str).toContain('Caused by: Error: database connection timeout');
  });

  it('getFullStack includes all stack traces', () => {
    const originalError = new Error('original');
    const wrapped = ZeroThrow.wrap(originalError, 'WRAPPED', 'wrapped error');

    const fullStack = wrapped.getFullStack();

    expect(fullStack).toContain('wrapped error');
    expect(fullStack).toContain('Caused by:');
    expect(fullStack).toContain('original');
  });
});

describe('ZT.try advanced cases', () => {
  it('handles errors with ZeroError-like properties', async () => {
    const errorLike = Object.assign(new Error('Error with code'), {
      code: 'CUSTOM_CODE',
      context: { data: 'test' },
    });

    const result = await ZT.try(() => {
      throw errorLike;
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(errorLike); // Should return the same object
      expect(result.error.code).toBe('CUSTOM_CODE');
    }
  });

  it('handles sync functions', async () => {
    const r = await ZT.try(() => 'sync result');
    expect(r.ok).toBe(true);
    expect(r.value).toBe('sync result');
  });

  it('applies map function on error', async () => {
    const r = await ZT.try(
      () => {
        throw new Error('original');
      },
      (e) => new ZeroThrow.ZeroError('MAPPED_ERR', 'Mapped error', { cause: e })
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('MAPPED_ERR');
      expect(r.error.message).toBe('Mapped error');
    }
  });

  it('normalizes non-Error throws to ZeroError', async () => {
    const r = await ZT.try(() => {
       
      throw 'string error';
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBeInstanceOf(ZeroThrow.ZeroError);
      expect(r.error.code).toBe('UNKNOWN_ERR');
      expect(r.error.message).toBe('string error');
    }
  });

  it('preserves ZeroError instances', async () => {
    const originalError = new ZeroThrow.ZeroError('CUSTOM_ERR', 'Custom error');
    const r = await ZT.try(() => {
      throw originalError;
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(originalError);
    }
  });

  it('handles null and undefined throws', async () => {
    const r1 = await ZT.try(() => {
       
      throw null;
    });
    const r2 = await ZT.try(() => {
       
      throw undefined;
    });

    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r1.ok) expect(r1.error.message).toBe('null');
    if (!r2.ok) expect(r2.error.message).toBe('undefined');
  });
});

describe('Additional branch coverage tests', () => {
  it('handles errors without stack property', () => {
    const errorWithoutStack = new Error('No stack');
    Object.defineProperty(errorWithoutStack, 'stack', { value: undefined });

    const zeroError = new ZeroThrow.ZeroError('TEST_ERROR', 'Test error', {
      cause: errorWithoutStack,
    });
    Object.defineProperty(zeroError, 'stack', { value: undefined });

    const fullStack = zeroError.getFullStack();
    expect(fullStack).toBe('\n\nCaused by:\nError: No stack');
  });

  it('handles errors without name property', () => {
    const errorWithoutName = new Error('No name');
    Object.defineProperty(errorWithoutName, 'name', { value: undefined });

    const zeroError = new ZeroThrow.ZeroError('TEST_ERROR', 'Test error', {
      cause: errorWithoutName,
    });

    const str = zeroError.toString();
    expect(str).toContain('Caused by: Error: No name');
  });

  it('extracts code from error with code property', () => {
    // Create an error with a code property
    const errorWithCode = new Error('Error with code') as Error & {
      code: string;
    };
    errorWithCode.code = 'CUSTOM_CODE';

    const wrapped = ZeroThrow.wrap(errorWithCode);
    expect(wrapped.code).toBe('CUSTOM_CODE');
  });
});
