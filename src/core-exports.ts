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
  tryR as _tryR,
  tryRSync as _tryRSync,
  tryRBatch as _tryRBatch,
  wrap as _wrap
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
export interface Async<T, E extends globalThis.Error = _ZeroError> extends globalThis.Promise<Result<T, E> & _ResultCombinable<T, E>> {
  andThen<U>(fn: (value: T) => Result<U, E>): Async<U, E>;
  map<U>(fn: (value: T) => U): Async<U, E>;
  mapErr<F extends globalThis.Error>(fn: (error: E) => F): Async<T, F>;
  orElse(fallback: () => Result<T, E>): Async<T, E>;
  unwrapOr(fallback: T): globalThis.Promise<T>;
  unwrapOrThrow(): globalThis.Promise<T>;
}

// ==========================================
// FUNCTIONS - Clean names for ZeroThrow namespace
// ==========================================

// Factory functions (unchanged)
export const ok = _ok;
export const err = _err;

// NEW: attempt function (replaces tryR, tryRSync, tryRBatch)
// Single overloaded function that handles all cases
export function attempt<T>(fn: () => T): Result<T, _ZeroError>;
export function attempt<T>(fn: () => Promise<T>): Promise<Result<T, _ZeroError>>;
export function attempt<T>(fn: () => T, mapError: (e: unknown) => _ZeroError): Result<T, _ZeroError>;
export function attempt<T>(fn: () => Promise<T>, mapError: (e: unknown) => _ZeroError): Promise<Result<T, _ZeroError>>;
export function attempt<T>(operations: Array<() => T | Promise<T>>): Promise<Result<T[], _ZeroError>>;
export function attempt<T>(operations: Array<() => T | Promise<T>>, mapError: (e: unknown) => _ZeroError): Promise<Result<T[], _ZeroError>>;
export function attempt<T>(
  fnOrOps: (() => T) | (() => Promise<T>) | Array<() => T | Promise<T>>,
  mapError?: (e: unknown) => _ZeroError
): Result<T, _ZeroError> | Promise<Result<T, _ZeroError>> | Promise<Result<T[], _ZeroError>> {
  // Handle array of operations (batch)
  if (Array.isArray(fnOrOps)) {
    return _tryRBatch(fnOrOps as any, mapError as any) as any;
  }
  
  // Try to execute the function
  try {
    const result = fnOrOps();
    
    // If it's a promise, use tryR
    if (result && typeof result === 'object' && 'then' in result) {
      return _tryR(fnOrOps as () => Promise<T>, mapError as any) as any;
    }
    
    // Otherwise use tryRSync
    return _tryRSync(fnOrOps as () => T, mapError as any) as any;
  } catch (e) {
    // Function threw synchronously, use tryRSync
    return _tryRSync(fnOrOps as () => T, mapError as any) as any;
  }
}

// Temporary alias for grace period
export { attempt as try };

// Error wrapping (unchanged name)
export { _wrap as wrap };

// NEW: enhance function for promise enhancement (replaces promise())
export function enhance<T, E extends globalThis.Error = _ZeroError>(
  promise: globalThis.Promise<Result<T, E>>
): Async<T, E> {
  const enhanced = promise.then(_makeCombinable) as Async<T, E>;
  
  enhanced.andThen = function<U>(fn: (value: T) => Result<U, E>): Async<U, E> {
    return enhance(this.then(result => result.andThen(fn)));
  };
  
  enhanced.map = function<U>(fn: (value: T) => U): Async<U, E> {
    return enhance(this.then(result => result.map(fn)));
  };
  
  enhanced.mapErr = function<F extends globalThis.Error>(fn: (error: E) => F): Async<T, F> {
    return enhance(this.then(result => result.mapErr(fn))) as Async<T, F>;
  };
  
  enhanced.orElse = function(fallback: () => Result<T, E>): Async<T, E> {
    return enhance(this.then(result => result.orElse(fallback)));
  };
  
  enhanced.unwrapOr = function(fallback: T): globalThis.Promise<T> {
    return this.then(result => result.unwrapOr(fallback));
  };
  
  enhanced.unwrapOrThrow = function(): globalThis.Promise<T> {
    return this.then(result => result.unwrapOrThrow());
  };
  
  return enhanced;
}

// NEW: fromAsync helper (replaces async())
export function fromAsync<T, E extends globalThis.Error = _ZeroError>(
  fn: () => globalThis.Promise<Result<T, E>>
): Async<T, E> {
  return enhance(fn());
}

// Combinator functions (unchanged)
export const pipe = _pipe;
export const collect = _collect;
export const collectAsync = _collectAsync;
export const firstSuccess = _firstSuccess;

// Internal function - makeCombinable (not exported)
// Note: 'enhance' is used for the promise wrapper function above