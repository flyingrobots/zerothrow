import { type Result, ok, err } from './result.js';
import { ZeroError } from './error.js';

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
    if (!result.ok) return result as Result<T[], E>;
    values[index++] = result.value;
  }

  return ok(values) as unknown as Result<T[], E>;
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
 * Get the first successful Result from an array of Result-producing functions
 * Evaluates lazily - stops on first success
 * Returns custom error if all fail
 */
export function firstSuccess<T, E extends Error = ZeroError>(
  attempts: Array<() => Result<T, E>>
): Result<T, E> {
  if (attempts.length === 0) {
    return err(new ZeroError('ALL_FAILED', 'All alternatives failed') as unknown as E);
  }
  
  for (const attempt of attempts) {
    const result = attempt();
    if (result.ok) return result;
  }
  
  // All attempts failed
  return err(new ZeroError('ALL_FAILED', 'All alternatives failed') as unknown as E);
}