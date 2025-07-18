import { ZeroError, type ErrorContext, type ErrorCode } from './error.js';
import { isDebugEnabled } from './debug.js';

export type Ok<T> = { ok: true; value: T };
export type Err<E extends Error = ZeroError> = { ok: false; error: E };
export type Result<T, E extends Error = ZeroError> = (Ok<T> | Err<E>) & ResultMethods<T, E>;

/**
 * Result methods - every Result has these built-in
 */
export interface ResultMethods<T, E extends Error = ZeroError> {
  /**
   * Chain operations that can fail
   */
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E>;

  /**
   * Transform errors while preserving success values
   */
  mapErr<F extends Error>(fn: (error: E) => F): Result<T, F>;

  /**
   * Transform success values while preserving errors
   */
  map<U>(fn: (value: T) => U): Result<U, E>;

  /**
   * Provide fallback value on error
   */
  orElse(fallback: () => Result<T, E>): Result<T, E>;

  /**
   * Get value or fallback
   */
  unwrapOr(fallback: T): T;

  /**
   * Get value or throw (use sparingly!)
   */
  unwrapOrThrow(): T;

  /**
   * Get value or compute fallback
   */
  unwrapOrElse(fn: (error: E) => T): T;

  /**
   * Execute side effect without changing the Result
   */
  tap(fn: (value: T) => void): Result<T, E>;

  /**
   * Execute side effect on error without changing the Result
   */
  tapErr(fn: (error: E) => void): Result<T, E>;

  /**
   * Execute side effect on any result
   */
  finally(fn: (value?: T) => void): Result<T, E>;

  /**
   * Discard the value and return void
   */
  void(): Result<void, E>;

  /**
   * Log debug information and return self for chaining
   */
  trace(label?: string): Result<T, E>;

  // Rust-style sugar methods
  
  /**
   * Pattern matching - handle both ok and error cases
   */
  match<U>(cases: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }): U;

  /**
   * Type guard to check if Result is Ok
   */
  isOk(): this is Ok<T>;

  /**
   * Type guard to check if Result is Err
   */
  isErr(): this is Err<E>;

  /**
   * Get value or panic with custom message
   */
  expect(message: string): T;

  /**
   * Flatten nested Results
   */
  flatten<U, F extends Error>(this: Result<Result<U, F>, E>): Result<U, E | F>;

  /**
   * Combine two Results into a tuple
   */
  zip<U>(other: Result<U, E>): Result<[T, U], E>;

  /**
   * Get success value or null (Rust-style)
   */
  okValue(): T | null;

  /**
   * Get error value or null (Rust-style)
   */
  errValue(): E | null;

  /**
   * Alias for unwrapOrThrow (Rust-style)
   */
  unwrap(): T;

  /**
   * Check if Result contains specific success value
   */
  contains(value: T): boolean;

  /**
   * Check if Result contains specific error
   */
  containsErr(error: E): boolean;
}

/**
 * Create a Result with built-in methods
 */
function createResult<T, E extends Error>(base: Ok<T> | Err<E>): Result<T, E> {
  const result = base as Result<T, E>;

  result.andThen = function<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (!result.ok) return createResult({ ok: false, error: result.error } as Err<E>) as Result<U, E>;
    return fn(result.value);
  };

  result.mapErr = function<F extends Error>(fn: (error: E) => F): Result<T, F> {
    if (result.ok) return createResult({ ok: true, value: result.value } as Ok<T>) as Result<T, F>;
    return createResult({ ok: false, error: fn(result.error) });
  };

  result.map = function<U>(fn: (value: T) => U): Result<U, E> {
    if (!result.ok) return createResult({ ok: false, error: result.error } as Err<E>) as Result<U, E>;
    return createResult({ ok: true, value: fn(result.value) });
  };

  result.orElse = function(fallback: () => Result<T, E>): Result<T, E> {
    if (result.ok) return result;
    return fallback();
  };

  result.unwrapOr = function(fallback: T): T {
    return result.ok ? result.value : fallback;
  };

  result.unwrapOrThrow = function(): T {
    if (!result.ok) throw result.error;
    return result.value;
  };

  result.unwrapOrElse = function(fn: (error: E) => T): T {
    return result.ok ? result.value : fn(result.error);
  };

  result.tap = function(fn: (value: T) => void): Result<T, E> {
    if (result.ok) fn(result.value);
    return result;
  };

  result.tapErr = function(fn: (error: E) => void): Result<T, E> {
    if (!result.ok) fn(result.error);
    return result;
  };

  result.finally = function(fn: (value?: T) => void): Result<T, E> {
    if (result.ok) fn(result.value);
    else fn();
    return result;
  };

  result.void = function(): Result<void, E> {
    if (!result.ok) return createResult({ ok: false, error: result.error } as Err<E>) as Result<void, E>;
    return createResult({ ok: true, value: undefined as void });
  };

  result.trace = function(label?: string): Result<T, E> {
    if (isDebugEnabled()) {
      const prefix = label ? `[${label}] ` : '';
      if (result.ok) {
        // Use globalThis for universal compatibility
        if (typeof globalThis !== 'undefined' && 'console' in globalThis) {
          (globalThis.console as Console).log(`${prefix}Result.Ok:`, result.value);
        }
      } else {
        // Use globalThis for universal compatibility
        if (typeof globalThis !== 'undefined' && 'console' in globalThis) {
          (globalThis.console as Console).error(`${prefix}Result.Err:`, result.error);
        }
      }
    }
    return result;
  };

  // Rust-style sugar methods

  result.match = function<U>(cases: { ok: (value: T) => U; err: (error: E) => U }): U {
    const baseResult = result as Ok<T> | Err<E>;
    if (baseResult.ok) return cases.ok(baseResult.value);
    return cases.err(baseResult.error);
  };

  result.isOk = function(): this is Ok<T> {
    const baseResult = result as Ok<T> | Err<E>;
    return baseResult.ok;
  };

  result.isErr = function(): this is Err<E> {
    const baseResult = result as Ok<T> | Err<E>;
    return !baseResult.ok;
  };

  result.expect = function(message: string): T {
    const baseResult = result as Ok<T> | Err<E>;
    if (!baseResult.ok) {
      throw new Error(`${message}: ${baseResult.error.message}`);
    }
    return baseResult.value;
  };

  result.flatten = function<U, F extends Error>(this: Result<Result<U, F>, E>): Result<U, E | F> {
    const baseResult = result as Ok<T> | Err<E>;
    if (!baseResult.ok) return createResult({ ok: false, error: baseResult.error }) as Result<U, E | F>;
    return baseResult.value as Result<U, F>;
  };

  result.zip = function<U>(other: Result<U, E>): Result<[T, U], E> {
    const baseResult = result as Ok<T> | Err<E>;
    const baseOther = other as Ok<U> | Err<E>;
    if (!baseResult.ok) return createResult({ ok: false, error: baseResult.error }) as Result<[T, U], E>;
    if (!baseOther.ok) return createResult({ ok: false, error: baseOther.error }) as Result<[T, U], E>;
    return createResult({ ok: true, value: [baseResult.value, baseOther.value] as [T, U] });
  };

  result.okValue = function(): T | null {
    const baseResult = result as Ok<T> | Err<E>;
    return baseResult.ok ? baseResult.value : null;
  };

  result.errValue = function(): E | null {
    const baseResult = result as Ok<T> | Err<E>;
    return baseResult.ok ? null : baseResult.error;
  };

  result.unwrap = function(): T {
    return result.unwrapOrThrow();
  };

  result.contains = function(value: T): boolean {
    const baseResult = result as Ok<T> | Err<E>;
    return baseResult.ok && baseResult.value === value;
  };

  result.containsErr = function(error: E): boolean {
    const baseResult = result as Ok<T> | Err<E>;
    return !baseResult.ok && baseResult.error === error;
  };

  return result;
}

// Public API - all Results have combinators built-in
export const ok = <T>(value: T): Result<T, ZeroError> => 
  createResult({ ok: true, value });

export const err = <E extends Error>(error: E): Result<never, E> => 
  createResult({ ok: false, error });

/**
 * Normalise an unknown thrown value into ZeroError
 * Optimized to avoid creating new errors when possible
 */
export const normalise = (e: unknown): ZeroError => {
  if (e instanceof ZeroError) return e;
  if (e instanceof Error) {
    // Check if it already has ZeroError-like properties to avoid allocation
    if ('code' in e && typeof e.code === 'string' && 'context' in e) {
      return e as ZeroError;
    }
    return new ZeroError('UNKNOWN_ERR', e.message, { cause: e });
  }
  return new ZeroError('UNKNOWN_ERR', String(e));
};

/**
 * wrap(cause, code?, msg?, ctx?) lifts an existing error into a new coded layer.
 * If code/msg are not provided, they are extracted from the cause error.
 */
export function wrap<C extends ErrorContext = ErrorContext>(
  cause: Error,
  code?: ErrorCode,
  msg?: string,
  ctx?: C
): ZeroError<C> {
  // Extract code from cause if not provided
  const errorCode =
    code ??
    (cause instanceof ZeroError
      ? cause.code
      : 'code' in cause && cause.code
        ? (cause.code as ErrorCode)
        : 'WRAPPED_ERROR');

  // Use cause's message if msg not provided
  const message = msg ?? cause.message;

  return new ZeroError(errorCode, message, { 
    cause, 
    ...(ctx !== undefined && { context: ctx })
  });
}