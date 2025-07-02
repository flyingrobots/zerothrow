
import { ZeroError, ErrorContext, ErrorCode } from "./error";

export type Ok<T>                 = { ok: true;  value: T };
export type Err<E extends Error = ZeroError> = { ok: false; error: E };
export type Result<T, E extends Error = ZeroError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E extends Error>(error: E): Err<E> => ({ ok: false, error });

/**
 * Normalise an unknown thrown value into ZeroError
 * Optimized to avoid creating new errors when possible
 */
const normalise = (e: unknown): ZeroError => {
  if (e instanceof ZeroError) return e;
  if (e instanceof Error) {
    // Check if it already has ZeroError-like properties to avoid allocation
    if ('code' in e && typeof e.code === 'string' && 'context' in e) {
      return e as ZeroError;
    }
    return new ZeroError("UNKNOWN_ERR", e.message, { cause: e });
  }
  return new ZeroError("UNKNOWN_ERR", String(e));
};

/**
 * tryR(fn) executes fn and converts thrown exceptions into Result<T,E>
 * Optimized to handle sync functions without Promise overhead when possible
 */
export function tryR<T>(
  fn: () => T | Promise<T>,
  map?: (e: ZeroError) => ZeroError
): Promise<Result<T, ZeroError>> {
  try {
    const result = fn();
    
    // If it's a thenable (Promise or Promise-like), handle it
    if (result && typeof (result as any).then === 'function') {
      return Promise.resolve(result).then(
        value => ok(value),
        error => {
          const base = normalise(error);
          return err(map ? map(base) : base);
        }
      );
    }
    
    // For sync results, return a resolved promise for backward compatibility
    return Promise.resolve(ok(result));
  } catch (e) {
    const base = normalise(e);
    return Promise.resolve(err(map ? map(base) : base));
  }
}

/**
 * Synchronous version of tryR for better performance when async is not needed
 */
export function tryRSync<T>(
  fn: () => T,
  map?: (e: ZeroError) => ZeroError
): Result<T, ZeroError> {
  try {
    return ok(fn());
  } catch (e) {
    const base = normalise(e);
    return err(map ? map(base) : base);
  }
}

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
  const errorCode = code ?? (
    cause instanceof ZeroError ? cause.code : 
    'code' in cause && cause.code ? cause.code as ErrorCode :
    'WRAPPED_ERROR'
  );
  
  // Use cause's message if msg not provided
  const message = msg ?? cause.message;
  
  return new ZeroError(errorCode, message, { cause, context: ctx });
}

/**
 * Batch tryR for multiple operations - executes all and returns first error or all results
 */
export async function tryRBatch<T>(
  fns: Array<() => T | Promise<T>>,
  map?: (e: ZeroError) => ZeroError
): Promise<Result<T[], ZeroError>> {
  const results: T[] = [];
  
  for (const fn of fns) {
    const result = await tryR(fn, map);
    if (!result.ok) {
      return result as Err<ZeroError>;
    }
    results.push(result.value);
  }
  
  return ok(results);
}
