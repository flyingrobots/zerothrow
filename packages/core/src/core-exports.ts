/**
 * Core Exports - Single source of truth for all public ZeroThrow APIs
 * This file defines the clean, standardized names for the ZeroThrow namespace
 */

// Import everything from current locations
import {
  type Result as _Result,
  type Ok as _Ok,
  type Err as _Err,
  ok as _ok,
  err as _err,
  wrap as _wrap,
  normalise as _normalise
} from './result.js';

import {
  ZeroError as _ZeroError,
  type ErrorCode as _ErrorCode,
  type ErrorContext as _ErrorContext
} from './error.js';

import {
  makeCombinable as _makeCombinable,
  type ResultCombinable as _ResultCombinable,
  pipe as _pipe,
  collect as _collect,
  collectAsync as _collectAsync,
  firstSuccess as _firstSuccess
} from './combinators.js';

// ==========================================
// TYPES - Clean names for ZeroThrow namespace
// ==========================================

// Core Result types (unchanged)
export type Result<T, E extends globalThis.Error = _ZeroError> = _Result<T, E>;
export type Ok<T> = _Ok<T>;
export type Err<E extends globalThis.Error> = _Err<E>;

// Error types (unchanged)
export { _ZeroError as ZeroError };
export type ErrorCode = _ErrorCode;
export type ErrorContext = _ErrorContext;

// NEW: Async type to replace Promise interface
export interface Async<TValue, TError extends globalThis.Error = _ZeroError> extends globalThis.Promise<Result<TValue, TError> & _ResultCombinable<TValue, TError>> {
  andThen<UValue>(fn: (value: TValue) => Result<UValue, TError> | Async<UValue, TError>): Async<UValue, TError>;
  map<UValue>(fn: (value: TValue) => UValue): Async<UValue, TError>;
  mapErr<FError extends globalThis.Error>(fn: (error: TError) => FError): Async<TValue, FError>;
  orElse(fallback: () => Result<TValue, TError>): Async<TValue, TError>;
  unwrapOr(fallback: TValue): globalThis.Promise<TValue>;
  unwrapOrThrow(): globalThis.Promise<TValue>;
  tap(fn: (value: TValue) => void): Async<TValue, TError>;
  tapErr(fn: (error: TError) => void): Async<TValue, TError>;
  finally(fn: (value?: TValue) => void): Async<TValue, TError>;
  void(): Async<void, TError>;
}

// ==========================================
// FUNCTIONS - Clean names for ZeroThrow namespace
// ==========================================

// Factory functions (unchanged)
export const ok = _ok;
export const err = _err;

// NEW: attempt function (replaces tryR, tryRSync, tryRBatch)
// Single overloaded function that handles all cases
export function attempt<T>(fn: () => T): Result<T, _ZeroError> & _ResultCombinable<T, _ZeroError>;
export function attempt<T>(fn: () => Promise<T>): Promise<Result<T, _ZeroError> & _ResultCombinable<T, _ZeroError>>;
export function attempt<T>(fn: () => T, mapError: (e: unknown) => _ZeroError): Result<T, _ZeroError> & _ResultCombinable<T, _ZeroError>;
export function attempt<T>(fn: () => Promise<T>, mapError: (e: unknown) => _ZeroError): Promise<Result<T, _ZeroError> & _ResultCombinable<T, _ZeroError>>;
export function attempt<T>(operations: Array<() => T | Promise<T>>): Promise<Result<T[], _ZeroError> & _ResultCombinable<T[], _ZeroError>>;
export function attempt<T>(operations: Array<() => T | Promise<T>>, mapError: (e: unknown) => _ZeroError): Promise<Result<T[], _ZeroError> & _ResultCombinable<T[], _ZeroError>>;
export function attempt<T>(
  fnOrOps: (() => T) | (() => Promise<T>) | Array<() => T | Promise<T>>,
  mapError?: (e: unknown) => _ZeroError
): (Result<T, _ZeroError> & _ResultCombinable<T, _ZeroError>) | Promise<Result<T, _ZeroError> & _ResultCombinable<T, _ZeroError>> | Promise<Result<T[], _ZeroError> & _ResultCombinable<T[], _ZeroError>> {
  // Handle array of operations (batch)
  if (Array.isArray(fnOrOps)) {
    return attemptBatch(fnOrOps, mapError);
  }
  
  // Try to execute the function
  try {
    const result = fnOrOps();
    
    // If it's a promise, handle async
    if (result && typeof result === 'object' && 'then' in result) {
      // Don't call fn again, use the existing promise
      return (result as Promise<T>).then(
        (value) => ok(value),
        (error) => {
          const base = _normalise(error);
          return err(mapError ? mapError(base) : base);
        }
      );
    }
    
    // Sync result
    return ok(result as T);
  } catch (e) {
    // Function threw synchronously
    const base = _normalise(e);
    return err(mapError ? mapError(base) : base);
  }
}


// Internal: batch implementation
async function attemptBatch<T>(
  fns: Array<() => T | Promise<T>>,
  map?: (e: unknown) => _ZeroError
): Promise<Result<T[], _ZeroError> & _ResultCombinable<T[], _ZeroError>> {
  const results: T[] = [];

  for (const fn of fns) {
    // Always await Promise.resolve to handle both sync and async uniformly
    const promisedResult = Promise.resolve().then(() => fn()).then(
      (value) => ok(value),
      (error) => {
        const base = _normalise(error);
        return err(map ? map(base) : base);
      }
    );
    
    const result = await promisedResult;
    if (!result.ok) {
      return result as Result<T[], _ZeroError> & _ResultCombinable<T[], _ZeroError>;
    }
    results.push(result.value);
  }

  return ok(results);
}

// Temporary alias for grace period
export { attempt as try };

// Error wrapping (unchanged name)
export { _wrap as wrap };

// NEW: enhance function for promise enhancement (replaces promise())
export function enhance<TValue, TError extends globalThis.Error = _ZeroError>(
  promise: globalThis.Promise<Result<TValue, TError>>
): Async<TValue, TError> {
  const enhanced = promise.then(_makeCombinable) as Async<TValue, TError>;
  
  enhanced.andThen = function<UValue>(fn: (value: TValue) => Result<UValue, TError> | Async<UValue, TError>): Async<UValue, TError> {
    return enhance(this.then(result => {
      if (!result.ok) return result as Result<UValue, TError>;
      const fnResult = fn(result.value);
      // If it's already an Async, return it; otherwise wrap the Result
      if (fnResult && typeof fnResult === 'object' && 'then' in fnResult) {
        return fnResult as Async<UValue, TError>;
      }
      return fnResult as Result<UValue, TError>;
    }));
  };
  
  enhanced.map = function<UValue>(fn: (value: TValue) => UValue): Async<UValue, TError> {
    return enhance(this.then(result => result.map(fn)));
  };
  
  enhanced.mapErr = function<FError extends globalThis.Error>(fn: (error: TError) => FError): Async<TValue, FError> {
    return enhance(this.then(result => result.mapErr(fn))) as Async<TValue, FError>;
  };
  
  enhanced.orElse = function(fallback: () => Result<TValue, TError>): Async<TValue, TError> {
    return enhance(this.then(result => result.orElse(fallback)));
  };
  
  enhanced.unwrapOr = function(fallback: TValue): globalThis.Promise<TValue> {
    return this.then(result => result.unwrapOr(fallback));
  };
  
  enhanced.unwrapOrThrow = function(): globalThis.Promise<TValue> {
    return this.then(result => result.unwrapOrThrow());
  };
  
  enhanced.tap = function(fn: (value: TValue) => void): Async<TValue, TError> {
    return enhance(this.then(result => result.tap(fn)));
  };
  
  enhanced.tapErr = function(fn: (error: TError) => void): Async<TValue, TError> {
    return enhance(this.then(result => result.tapErr(fn)));
  };
  
  enhanced.finally = function(fn: (value?: TValue) => void): Async<TValue, TError> {
    return enhance(this.then(result => result.finally(fn)));
  };
  
  enhanced.void = function(): Async<void, TError> {
    return enhance(this.then(result => result.void()));
  };
  
  return enhanced;
}

// NEW: fromAsync helper (replaces async())
export function fromAsync<TValue, TError extends globalThis.Error = _ZeroError>(
  fn: () => globalThis.Promise<Result<TValue, TError>>
): Async<TValue, TError> {
  return enhance(fn());
}

// Combinator functions (unchanged)
export const pipe = _pipe;
export const collect = _collect;
export const collectAsync = _collectAsync;
export const firstSuccess = _firstSuccess;

// Type guards
export function isResult<T = unknown, E extends globalThis.Error = _ZeroError>(
  value: unknown
): value is Result<T, E> {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('ok' in value) ||
    typeof (value as { ok: unknown }).ok !== 'boolean'
  ) {
    return false;
  }
  
  const v = value as { ok: boolean; value?: unknown; error?: unknown };
  if (v.ok === true) {
    return 'value' in v;
  } else {
    return 'error' in v && v.error instanceof globalThis.Error;
  }
}

export function isOk<T = unknown>(value: unknown): value is Ok<T> {
  return isResult(value) && value.ok === true;
}

export function isErr<E extends globalThis.Error = _ZeroError>(
  value: unknown
): value is Err<E> {
  return isResult(value) && value.ok === false;
}


