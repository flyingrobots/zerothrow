import { Result, ok, err } from './result';
import { ZeroError } from './error';

/**
 * Fluent combinators for Result types - chainable operations
 */

export interface ResultCombinable<T, E extends Error = ZeroError> {
  /**
   * Chain operations that can fail
   */
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> & ResultCombinable<U, E>;
  
  /**
   * Transform errors while preserving success values
   */
  mapErr<F extends Error>(fn: (error: E) => F): Result<T, F> & ResultCombinable<T, F>;
  
  /**
   * Transform success values while preserving errors
   */
  map<U>(fn: (value: T) => U): Result<U, E> & ResultCombinable<U, E>;
  
  /**
   * Provide fallback value on error
   */
  orElse(fallback: () => Result<T, E>): Result<T, E> & ResultCombinable<T, E>;
  
  /**
   * Get value or fallback
   */
  unwrapOr(fallback: T): T;
  
  /**
   * Get value or throw (use sparingly!)
   */
  unwrapOrThrow(): T;
}

/**
 * Add combinators to Result type
 */
export function makeCombinable<T, E extends Error = ZeroError>(
  result: Result<T, E>
): Result<T, E> & ResultCombinable<T, E> {
  return Object.assign({}, result, {
    andThen: function<U>(this: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> & ResultCombinable<U, E> {
      if (!this.ok) return makeCombinable(this as Result<U, E>);
      return makeCombinable(fn(this.value));
    },

    mapErr: function<F extends Error>(this: Result<T, E>, fn: (error: E) => F): Result<T, F> & ResultCombinable<T, F> {
      if (this.ok) return makeCombinable(this as Result<T, F>);
      return makeCombinable(err(fn(this.error)));
    },

    map: function<U>(this: Result<T, E>, fn: (value: T) => U): Result<U, E> & ResultCombinable<U, E> {
      if (!this.ok) return makeCombinable(this as Result<U, E>);
      return makeCombinable(ok(fn(this.value)));
    },

    orElse: function(this: Result<T, E>, fallback: () => Result<T, E>): Result<T, E> & ResultCombinable<T, E> {
      if (this.ok) return makeCombinable(this);
      return makeCombinable(fallback());
    },

    unwrapOr: function(this: Result<T, E>, fallback: T): T {
      return this.ok ? this.value : fallback;
    },

    /**
     * @warning This method violates the zero-throw discipline by throwing exceptions.
     * Use only in tests or when absolutely necessary. Prefer unwrapOr() or proper
     * error handling instead.
     * @throws {Error} Throws the error if the Result is an Err
     */
    unwrapOrThrow: function(this: Result<T, E>): T {
      if (!this.ok) throw this.error;
      return this.value;
    }
  });
}

/**
 * Pipe multiple operations together with full type inference
 * 
 * @example
 * const result = pipe(
 *   parseNumber,
 *   validateRange,
 *   formatOutput
 * )(input);
 */
export function pipe<A, B>(f1: (a: A) => B): (a: A) => B;
export function pipe<A, B, C>(f1: (a: A) => B, f2: (b: B) => C): (a: A) => C;
export function pipe<A, B, C, D>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D): (a: A) => D;
export function pipe<A, B, C, D, E>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E): (a: A) => E;
export function pipe<A, B, C, D, E, F>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E, f5: (e: E) => F): (a: A) => F;
export function pipe<A, B, C, D, E, F, G>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E, f5: (e: E) => F, f6: (f: F) => G): (a: A) => G;
export function pipe<A, B, C, D, E, F, G, H>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E, f5: (e: E) => F, f6: (f: F) => G, f7: (g: G) => H): (a: A) => H;
export function pipe<A, B, C, D, E, F, G, H, I>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E, f5: (e: E) => F, f6: (f: F) => G, f7: (g: G) => H, f8: (h: H) => I): (a: A) => I;
export function pipe<A, B, C, D, E, F, G, H, I, J>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E, f5: (e: E) => F, f6: (f: F) => G, f7: (g: G) => H, f8: (h: H) => I, f9: (i: I) => J): (a: A) => J;
export function pipe<A, B, C, D, E, F, G, H, I, J, K>(f1: (a: A) => B, f2: (b: B) => C, f3: (c: C) => D, f4: (d: D) => E, f5: (e: E) => F, f6: (f: F) => G, f7: (g: G) => H, f8: (h: H) => I, f9: (i: I) => J, f10: (j: J) => K): (a: A) => K;
export function pipe(...operations: Array<(input: any) => any>) {
  return (input: any) => operations.reduce((acc, op) => op(acc), input);
}

/**
 * Collect all Results - fail if any fail, succeed with array if all succeed
 * Optimized to avoid unnecessary allocations
 */
export function collect<T, E extends Error = ZeroError>(
  results: Array<Result<T, E>>
): Result<T[], E> {
  // Pre-allocate array if we know the size
  const values: T[] = new Array(results.length);
  let index = 0;
  
  for (const result of results) {
    if (!result.ok) return result;
    values[index++] = result.value;
  }
  
  return ok(values);
}

/**
 * Async version of collect for Promise<Result> arrays
 */
export async function collectAsync<T, E extends Error = ZeroError>(
  promises: Array<Promise<Result<T, E>>>
): Promise<Result<T[], E>> {
  const results = await Promise.all(promises);
  return collect(results);
}

/**
 * Try each Result in sequence until one succeeds
 */
export function firstSuccess<T, E extends Error = ZeroError>(
  results: Array<() => Result<T, E>>
): Result<T, E> {
  for (const getResult of results) {
    const result = getResult();
    if (result.ok) return result;
  }
  
  // Return a generic error that matches the expected type
  // The caller should handle this case appropriately
  return err(new ZeroError('ALL_FAILED', 'All alternatives failed') as unknown as E);
}