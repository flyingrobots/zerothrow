
import { ZeroError, ErrorContext, ErrorCode } from "./error";

export type Ok<T>                 = { ok: true;  value: T };
export type Err<E extends Error = ZeroError> = { ok: false; error: E };
export type Result<T, E extends Error = ZeroError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E extends Error>(error: E): Err<E> => ({ ok: false, error });

/**
 * Normalise an unknown thrown value into ZeroError
 */
const normalise = (e: unknown): ZeroError =>
  e instanceof ZeroError ? e :
  e instanceof Error     ? new ZeroError("UNKNOWN_ERR", e.message, { cause: e }) :
                           new ZeroError("UNKNOWN_ERR", String(e));

/**
 * tryR(fn) executes fn and converts thrown exceptions into Result<T,E>
 */
export async function tryR<T>(
  fn: () => Promise<T> | T,
  map?: (e: ZeroError) => ZeroError
): Promise<Result<T, ZeroError>> {
  try {
    return ok(await fn());
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
