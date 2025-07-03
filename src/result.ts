import { ZeroError, type ErrorContext, type ErrorCode } from './error.js';
import { makeCombinable, type ResultCombinable } from './combinators.js';

export type Ok<T> = { ok: true; value: T };
export type Err<E extends Error = ZeroError> = { ok: false; error: E };
export type Result<T, E extends Error = ZeroError> = Ok<T> | Err<E>;

// Internal plain Result factories - no combinators
export const _ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const _err = <E extends Error>(error: E): Err<E> => ({ ok: false, error });

// Public API - returns combinable Results
export const ok = <T>(value: T): Result<T, ZeroError> & ResultCombinable<T, ZeroError> => 
  makeCombinable(_ok(value));

export const err = <E extends Error>(error: E): Result<never, E> & ResultCombinable<never, E> => 
  makeCombinable(_err(error));

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

  return new ZeroError(errorCode, message, { cause, context: ctx });
}

