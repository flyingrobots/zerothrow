import { ZeroError } from '../error.js';

interface WinstonFormatInfo {
  level: string;
  message: string;
  error?: unknown;
  result?: unknown;
  timestamp?: string;
  zerothrow?: unknown;
  [key: string]: unknown;
}

export const zerothrowWinstonFormat = {
  transform(info: WinstonFormatInfo): WinstonFormatInfo {
    // Shallow clone to avoid mutation - only copy fields we'll modify
    const transformed: WinstonFormatInfo = { ...info };

    // Format ZeroError instances
    if (info.error instanceof ZeroError) {
      const codeStr =
        typeof info.error.code === 'symbol'
          ? String(info.error.code)
          : String(info.error.code);
      transformed.zerothrow = {
        type: 'ZeroError',
        code: codeStr,
        message: info.error.message,
        context: info.error.context,
        // Only include stack in debug mode
        ...(process?.env?.LOG_LEVEL === 'debug' ||
        process?.env?.LOG_STACK === 'true'
          ? { stack: info.error.stack }
          : {}),
      };
      transformed.formattedMessage = `[${codeStr}] ${info.error.message}`;
      // Leave original error untouched for downstream formats
    }

    // Format Result types
    if (
      info.result &&
      typeof info.result === 'object' &&
      'ok' in info.result &&
      typeof (info.result as Record<string, unknown>).ok === 'boolean'
    ) {
      const result = info.result as {
        ok: boolean;
        value?: unknown;
        error?: unknown;
      };

      if (result.ok) {
        transformed.zerothrow = {
          type: 'Result',
          status: 'ok',
          value: result.value,
        };
        transformed.formattedMessage = `[OK] ${info.message || 'Operation succeeded'}`;
      } else {
        transformed.zerothrow = {
          type: 'Result',
          status: 'err',
          error:
            result.error instanceof ZeroError
              ? {
                  code:
                    typeof result.error.code === 'symbol'
                      ? String(result.error.code)
                      : result.error.code,
                  message: result.error.message,
                  context: result.error.context,
                }
              : result.error instanceof Error
                ? {
                    message: result.error.message,
                  }
                : {
                    message: String(result.error),
                  },
        };
        const errorMessage =
          result.error instanceof ZeroError
            ? result.error.message
            : info.message || 'Operation failed';
        transformed.formattedMessage = `[ERR] ${errorMessage}`;
      }
      // Leave original result untouched for downstream formats
    }

    return transformed;
  },
};

/**
 * Creates a Winston logger with ZeroThrow format.
 *
 * Usage:
 * ```typescript
 * import winston from 'winston';
 * import { createWinstonLogger } from '@flyingrobots/zerothrow/loggers';
 *
 * const logger = createWinstonLogger(winston, {
 *   level: 'info',
 *   // other winston options
 * });
 *
 * // Or use the format directly:
 * const logger = winston.createLogger({
 *   format: winston.format.combine(
 *     winston.format.timestamp(),
 *     zerothrowWinstonFormat,
 *     winston.format.json()
 *   )
 * });
 * ```
 */
interface WinstonModule {
  format: {
    combine: (...formats: unknown[]) => unknown;
    timestamp: () => unknown;
    json: () => unknown;
    [key: string]: unknown;
  };
  createLogger: (options: unknown) => unknown;
}

interface WinstonOptions {
  level?: string;
  format?: unknown;
  [key: string]: unknown;
}

export function createWinstonLogger(
  winston: WinstonModule,
  options: WinstonOptions = {}
) {
  const format = winston.format;

  return winston.createLogger({
    ...options,
    format: format.combine(
      format.timestamp(),
      zerothrowWinstonFormat,
      options.format || format.json()
    ),
  });
}
