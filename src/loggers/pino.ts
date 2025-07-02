import { Result } from '../result';
import { ZeroError } from '../error';

interface PinoSerializers {
  err?: (error: any) => any;
  result?: (result: any) => any;
}

export const zerothrowPinoSerializers: PinoSerializers = {
  err: (error: any) => {
    if (error instanceof ZeroError) {
      return {
        type: 'ZeroError',
        code: typeof error.code === 'symbol' ? String(error.code) : error.code,
        message: error.message,
        context: error.context,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
    }
    
    // Handle regular errors
    return {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
  },
  
  result: (result: any) => {
    if (result && typeof result === 'object' && 'ok' in result) {
      if (result.ok) {
        return {
          type: 'Result',
          status: 'ok',
          value: result.value,
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          type: 'Result', 
          status: 'err',
          error: zerothrowPinoSerializers.err!(result.error),
          timestamp: new Date().toISOString()
        };
      }
    }
    
    // Not a Result type, return as is
    return result;
  }
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
export function createPinoConfig(options: any = {}) {
  return {
    ...options,
    serializers: {
      ...options.serializers,
      ...zerothrowPinoSerializers
    }
  };
}

// For backward compatibility
export const createPinoLogger = createPinoConfig;