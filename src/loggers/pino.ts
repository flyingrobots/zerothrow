import { Result, ok, err } from '../result';
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
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
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
    if (result && typeof result === 'object' && 'isOk' in result && 'isErr' in result) {
      if (result.isOk()) {
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

export function createPinoLogger(options: any = {}) {
  return {
    ...options,
    serializers: {
      ...options.serializers,
      ...zerothrowPinoSerializers
    }
  };
}