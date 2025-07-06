import { ZeroError, type ErrorContext, type ErrorCode } from './error.js';

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