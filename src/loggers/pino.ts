import { ZT } from '../index.js';

interface PinoSerializers {
  err?: (error: unknown) => unknown;
  result?: (result: unknown) => unknown;
}

/**
 * Type guard to check if a value is a Result type
 */
function isResult(value: unknown): value is ZT.Result<unknown, ZT.AnyError> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'ok' in value &&
    typeof (value as Record<string, unknown>).ok === 'boolean' &&
    ((value as Record<string, unknown>).ok === true
      ? 'value' in value
      : 'error' in value)
  );
}

export const zerothrowPinoSerializers: PinoSerializers = {
  err: (error: unknown) => {
    if (error instanceof ZT.Error) {
      return {
        type: 'ZeroError',
        code: typeof error.code === 'symbol' ? String(error.code) : error.code,
        message: error.message,
        context: error.context,
        // Only include stack in debug mode or if explicitly enabled
        ...(process?.env?.LOG_LEVEL === 'debug' ||
        process?.env?.LOG_STACK === 'true'
          ? { stack: error.stack }
          : {}),
      };
    }

    // Handle regular errors
    if (error instanceof Error) {
      return {
        type: error.constructor.name,
        message: error.message,
        // Only include stack in debug mode or if explicitly enabled
        ...(process?.env?.LOG_LEVEL === 'debug' ||
        process?.env?.LOG_STACK === 'true'
          ? { stack: error.stack }
          : {}),
      };
    }

    // Handle non-Error types
    return {
      type: 'Unknown',
      message: String(error),
    };
  },

  result: (result: unknown) => {
    // Use type guard for Result<T, E>
    if (isResult(result)) {
      if (result.ok) {
        return {
          type: 'Result',
          status: 'ok',
          value: result.value,
        };
      } else {
        return {
          type: 'Result',
          status: 'err',
          error: zerothrowPinoSerializers.err
            ? zerothrowPinoSerializers.err(result.error)
            : result.error,
        };
      }
    }

    // Not a Result type, return as is
    return result;
  },
};

/**
 * Creates a Pino configuration with ZeroThrow serializers.
 *
 * Usage:
 * ```typescript
 * import pino from 'pino';
 * import { createPinoConfig } from '@flyingrobots/zerothrow/loggers';
 *
 * const logger = pino(createPinoConfig({
 *   level: 'info',
 *   // other pino options
 * }));
 * ```
 */
interface PinoOptions {
  level?: string;
  serializers?: Record<string, unknown>;
  [key: string]: unknown;
}

export function createPinoConfig(options: PinoOptions = {}) {
  return {
    ...options,
    serializers: {
      ...options.serializers,
      ...zerothrowPinoSerializers,
    },
  };
}

/** @deprecated Use createPinoConfig instead. This returns a config object, not a logger instance. */
export const createPinoLogger = createPinoConfig;
