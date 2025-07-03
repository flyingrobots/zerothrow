/**
 * ZT Namespace - ZeroThrow's unified API
 * 
 * Everything you need in two letters: ZT
 */

import { 
  type Result as _Result, 
  type Ok as _Ok, 
  type Err as _Err,
  ok as _ok, 
  err as _err,
  tryR as _tryR,
  tryRSync as _tryRSync,
  tryRBatch as _tryRBatch,
  wrap as _wrap,
  ZeroError as _ZeroError,
  type ErrorCode as _ErrorCode,
  type ErrorContext as _ErrorContext,
  makeCombinable as _makeCombinable,
  type ResultCombinable as _ResultCombinable,
  pipe as _pipe,
  collect as _collect,
  collectAsync as _collectAsync,
  firstSuccess as _firstSuccess
} from './index.js';

// Core types
export type Result<T, E extends Error = _ZeroError> = _Result<T, E>;
export type AnyError = Error; // For generic error constraints
export type Ok<T> = _Ok<T>;
export type OK<T> = _Ok<T>; // Alias for those who prefer all-caps
export type Err<E extends Error> = _Err<E>;
export type ERR<E extends Error> = _Err<E>; // Alias for those who prefer all-caps
export type Error = _ZeroError;
export type ErrorCode = _ErrorCode;
export type ErrorContext = _ErrorContext;

// Re-export ZeroError class
export const Error = _ZeroError;

// Enhanced Promise type with built-in combinators
export interface Promise<T, E extends Error = _ZeroError> extends globalThis.Promise<Result<T, E> & _ResultCombinable<T, E>> {
  andThen<U>(fn: (value: T) => Result<U, E>): Promise<U, E>;
  map<U>(fn: (value: T) => U): Promise<U, E>;
  mapErr<F extends Error>(fn: (error: E) => F): Promise<T, F>;
  orElse(fallback: () => Result<T, E>): Promise<T, E>;
  unwrapOr(fallback: T): globalThis.Promise<T>;
  unwrapOrThrow(): globalThis.Promise<T>;
}

// Core functions
export const ok = _ok;
export const err = _err;
export const tryR = _tryR;
export const tryRSync = _tryRSync;
export const tryRBatch = _tryRBatch;
export const wrap = _wrap;

// Combinator functions
export const pipe = _pipe;
export const collect = _collect;
export const collectAsync = _collectAsync;
export const firstSuccess = _firstSuccess;

// Make a result combinable
export const makeCombinable = _makeCombinable;

// Promise enhancement
export function promise<T, E extends Error = _ZeroError>(promise: globalThis.Promise<Result<T, E>>): Promise<T, E> {
  const enhanced = promise.then(_makeCombinable) as Promise<T, E>;
  
  enhanced.andThen = function<U>(fn: (value: T) => Result<U, E>): Promise<U, E> {
    return exports.promise(this.then(result => result.andThen(fn)));
  };
  
  enhanced.map = function<U>(fn: (value: T) => U): Promise<U, E> {
    return exports.promise(this.then(result => result.map(fn)));
  };
  
  enhanced.mapErr = function<F extends Error>(fn: (error: E) => F): Promise<T, F> {
    return exports.promise(this.then(result => result.mapErr(fn))) as Promise<T, F>;
  };
  
  enhanced.orElse = function(fallback: () => Result<T, E>): Promise<T, E> {
    return exports.promise(this.then(result => result.orElse(fallback)));
  };
  
  enhanced.unwrapOr = function(fallback: T): globalThis.Promise<T> {
    return this.then(result => result.unwrapOr(fallback));
  };
  
  enhanced.unwrapOrThrow = function(): globalThis.Promise<T> {
    return this.then(result => result.unwrapOrThrow());
  };
  
  return enhanced;
}

// Async helper
export function async<T, E extends Error = _ZeroError>(
  fn: () => globalThis.Promise<Result<T, E>>
): Promise<T, E> {
  return promise(fn());
}

// Type guards
export function isResult<T, E extends Error = _ZeroError>(value: unknown): value is Result<T, E> {
  if (typeof value !== 'object' || value === null) return false;
  if (!('ok' in value)) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.ok !== 'boolean') return false;
  
  if (obj.ok === true) {
    return 'value' in obj;
  } else {
    return 'error' in obj && obj.error instanceof globalThis.Error;
  }
}

export function isOk<T>(result: Result<T, Error>): result is Ok<T> {
  return result.ok === true;
}

export function isErr<E extends Error>(result: Result<unknown, E>): result is Err<E> {
  return result.ok === false;
}