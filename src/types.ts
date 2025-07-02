import { Result, ZeroError } from './index.js';
import { ResultCombinable, makeCombinable } from './combinators.js';

/**
 * Type aliases to reduce boilerplate
 */

// (1) Shorthand for Result with ZeroError as default error type
export type ZTResult<T> = Result<T, ZeroError>;

// (2) Shorthand for Promise<Result<T, ZeroError>>
export type ZTPromise<T> = Promise<Result<T, ZeroError>>;

// (3) Enhanced Promise with combinator methods
export interface ZTPromiseCombinable<T> extends Promise<Result<T, ZeroError> & ResultCombinable<T, ZeroError>> {
  // Direct access to combinator methods on the Promise itself
  andThen<U>(fn: (value: T) => Result<U, ZeroError>): ZTPromiseCombinable<U>;
  map<U>(fn: (value: T) => U): ZTPromiseCombinable<U>;
  mapErr<F extends Error>(fn: (error: ZeroError) => F): Promise<Result<T, F> & ResultCombinable<T, F>>;
  orElse(fallback: () => Result<T, ZeroError>): ZTPromiseCombinable<T>;
  unwrapOr(fallback: T): Promise<T>;
  unwrapOrThrow(): Promise<T>;
}

/**
 * Convert a Promise<Result<T, ZeroError>> into an enhanced promise with combinator methods
 */
export function ztPromise<T>(promise: Promise<Result<T, ZeroError>>): ZTPromiseCombinable<T> {
  const enhanced = promise.then(makeCombinable) as ZTPromiseCombinable<T>;
  
  // Add combinator methods directly to the promise
  enhanced.andThen = function<U>(fn: (value: T) => Result<U, ZeroError>): ZTPromiseCombinable<U> {
    return ztPromise(this.then(result => result.andThen(fn)));
  };
  
  enhanced.map = function<U>(fn: (value: T) => U): ZTPromiseCombinable<U> {
    return ztPromise(this.then(result => result.map(fn)));
  };
  
  enhanced.mapErr = function<F extends Error>(fn: (error: ZeroError) => F) {
    return this.then(result => result.mapErr(fn));
  };
  
  enhanced.orElse = function(fallback: () => Result<T, ZeroError>): ZTPromiseCombinable<T> {
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
 * Helper to create ZTResult values
 */
export const ztOk = <T>(value: T): ZTResult<T> => ({ ok: true, value });
export const ztErr = (error: ZeroError | string | { code: string; message: string }): ZTResult<never> => {
  if (typeof error === 'string') {
    return { ok: false, error: new ZeroError('ERROR', error) };
  }
  if (error instanceof ZeroError) {
    return { ok: false, error };
  }
  return { ok: false, error: new ZeroError(error.code, error.message) };
};

/**
 * Type guard for ZTResult
 */
export function isZTResult<T>(value: unknown): value is ZTResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value.ok === true || (value.ok === false && 'error' in value && (value as any).error instanceof ZeroError))
  );
}