import { type Result, err, _ok, _err } from './result.js';
import { ZeroError } from './error.js';

/**
 * Fluent combinators for Result types - chainable operations
 */

export interface ResultCombinable<T, E extends Error = ZeroError> {
  /**
   * Chain operations that can fail
   */
  andThen<U>(
    fn: (value: T) => Result<U, E>
  ): Result<U, E> & ResultCombinable<U, E>;

  /**
   * Transform errors while preserving success values
   */
  mapErr<F extends Error>(
    fn: (error: E) => F
  ): Result<T, F> & ResultCombinable<T, F>;

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

  /**
   * Execute side effect without changing the Result
   * Useful for logging, metrics, debugging
   */
  tap(fn: (value: T) => void): Result<T, E> & ResultCombinable<T, E>;

  /**
   * Execute side effect on error without changing the Result
   */
  tapErr(fn: (error: E) => void): Result<T, E> & ResultCombinable<T, E>;

  /**
   * Execute cleanup function regardless of success/failure
   * Gets the value if successful, undefined if error
   */
  finally(fn: (value?: T) => void): Result<T, E> & ResultCombinable<T, E>;
}

/**
 * Add combinators to Result type
 */
export function makeCombinable<T, E extends Error = ZeroError>(
  result: Result<T, E>
): Result<T, E> & ResultCombinable<T, E> {
  return Object.assign({}, result, {
    andThen: function <U>(
      this: Result<T, E>,
      fn: (value: T) => Result<U, E>
    ): Result<U, E> & ResultCombinable<U, E> {
      if (!this.ok) return makeCombinable(this as Result<U, E>);
      return makeCombinable(fn(this.value));
    },

    mapErr: function <F extends Error>(
      this: Result<T, E>,
      fn: (error: E) => F
    ): Result<T, F> & ResultCombinable<T, F> {
      if (this.ok) return makeCombinable(this as Result<T, F>);
      return makeCombinable(_err(fn(this.error)));
    },

    map: function <U>(
      this: Result<T, E>,
      fn: (value: T) => U
    ): Result<U, E> & ResultCombinable<U, E> {
      if (!this.ok) return makeCombinable(this as Result<U, E>);
      return makeCombinable(_ok(fn(this.value)));
    },

    orElse: function (
      this: Result<T, E>,
      fallback: () => Result<T, E>
    ): Result<T, E> & ResultCombinable<T, E> {
      if (this.ok) return makeCombinable(this);
      return makeCombinable(fallback());
    },

    unwrapOr: function (this: Result<T, E>, fallback: T): T {
      return this.ok ? this.value : fallback;
    },

    /**
     * @warning This method violates the zero-throw discipline by throwing exceptions.
     * Use only in tests or when absolutely necessary. Prefer unwrapOr() or proper
     * error handling instead.
     * @throws {Error} Throws the error if the Result is an Err
     */
    unwrapOrThrow: function (this: Result<T, E>): T {
      if (!this.ok) throw this.error;
      return this.value;
    },

    tap: function (
      this: Result<T, E>,
      fn: (value: T) => void
    ): Result<T, E> & ResultCombinable<T, E> {
      if (this.ok) fn(this.value);
      return makeCombinable(this);
    },

    tapErr: function (
      this: Result<T, E>,
      fn: (error: E) => void
    ): Result<T, E> & ResultCombinable<T, E> {
      if (!this.ok) fn(this.error);
      return makeCombinable(this);
    },

    finally: function (
      this: Result<T, E>,
      fn: (value?: T) => void
    ): Result<T, E> & ResultCombinable<T, E> {
      fn(this.ok ? this.value : undefined);
      return makeCombinable(this);
    },
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
export function pipe<
  T extends readonly [
    (arg: unknown) => unknown,
    ...Array<(arg: unknown) => unknown>,
  ],
>(...fns: T): (input: Parameters<T[0]>[0]) => ReturnType<T[number]> {
  return (input: Parameters<T[0]>[0]): ReturnType<T[number]> =>
    fns.reduce((acc, fn) => fn(acc), input) as ReturnType<T[number]>;
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

  return _ok(values) as Result<T[], E>;
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
  return err(
    new ZeroError('ALL_FAILED', 'All alternatives failed') as unknown as E
  );
}
