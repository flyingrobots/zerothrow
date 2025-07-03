import { ZeroThrow, ZT } from './index.js';
import { makeCombinable, type ResultCombinable } from './combinators.js';

/**
 * Type aliases to reduce boilerplate
 */

// (1) Shorthand for Result with ZeroError as default error type
export type ZTResult<T, E extends Error = ZeroThrow.ZeroError> = ZeroThrow.Result<T, E>;

// (2) Enhanced Promise with combinator methods built-in
export interface ZTPromise<T, E extends Error = ZeroThrow.ZeroError> extends Promise<ZeroThrow.Result<T, E> & ResultCombinable<T, E>> {
  // Direct access to combinator methods on the Promise itself
  andThen<U>(fn: (value: T) => ZeroThrow.Result<U, E>): ZTPromise<U, E>;
  map<U>(fn: (value: T) => U): ZTPromise<U, E>;
  mapErr<F extends Error>(fn: (error: E) => F): ZTPromise<T, F>;
  orElse(fallback: () => ZeroThrow.Result<T, E>): ZTPromise<T, E>;
  unwrapOr(fallback: T): Promise<T>;
  unwrapOrThrow(): Promise<T>;
}

/**
 * Convert a Promise<Result<T, E>> into a ZTPromise with combinator methods
 */
export function ztPromise<T, E extends Error = ZeroThrow.ZeroError>(promise: Promise<ZeroThrow.Result<T, E>>): ZTPromise<T, E> {
  const enhanced = promise.then(makeCombinable) as ZTPromise<T, E>;
  
  // Add combinator methods directly to the promise
  enhanced.andThen = function<U>(fn: (value: T) => ZeroThrow.Result<U, E>): ZTPromise<U, E> {
    return ztPromise(this.then(result => result.andThen(fn)));
  };
  
  enhanced.map = function<U>(fn: (value: T) => U): ZTPromise<U, E> {
    return ztPromise(this.then(result => result.map(fn)));
  };
  
  enhanced.mapErr = function<F extends Error>(fn: (error: E) => F): ZTPromise<T, F> {
    return ztPromise(this.then(result => result.mapErr(fn))) as ZTPromise<T, F>;
  };
  
  enhanced.orElse = function(fallback: () => ZeroThrow.Result<T, E>): ZTPromise<T, E> {
    return ztPromise(this.then(result => result.orElse(fallback)));
  };
  
  enhanced.unwrapOr = function(fallback: T): Promise<T> {
    return this.then(result => result.unwrapOr(fallback));
  };
  
  enhanced.unwrapOrThrow = function(): Promise<T> {
    return this.then(result => result.unwrapOrThrow());
  };
  
  return enhanced;
}

/**
 * Helper to create a ZTPromise directly from an async operation
 * This allows you to write functions that return ZTPromise without manual conversion
 */
export function ztAsync<T, E extends Error = ZeroThrow.ZeroError>(
  fn: () => Promise<ZeroThrow.Result<T, E>>
): ZTPromise<T, E> {
  return ztPromise(fn());
}

/**
 * Helper to create ZTResult values
 */
export const ztOk = <T, E extends Error = ZeroThrow.ZeroError>(value: T): ZTResult<T, E> => ({ ok: true, value });
export const ztErr = <E extends Error = ZeroThrow.ZeroError>(error: E | string | { code: string; message: string }): ZTResult<never, E> => {
  if (typeof error === 'string') {
    return { ok: false, error: new ZeroThrow.ZeroError('ERROR', error) as E };
  }
  if (error instanceof Error) {
    return { ok: false, error: error as E };
  }
  return { ok: false, error: new ZeroThrow.ZeroError((error as { code: string; message: string }).code, (error as { code: string; message: string }).message) as E };
};

/**
 * Type guard for ZTResult
 */
export function isZTResult<T, E extends Error = ZeroThrow.ZeroError>(value: unknown): value is ZTResult<T, E> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value.ok === true || (value.ok === false && 'error' in value && (value as { error: unknown }).error instanceof Error))
  );
}