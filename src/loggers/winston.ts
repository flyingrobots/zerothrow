import { Result } from '../result';
import { ZeroError } from '../error';

interface WinstonFormatInfo {
  level: string;
  message: string;
  [key: string]: any;
}

export const zerothrowWinstonFormat = {
  transform(info: WinstonFormatInfo): WinstonFormatInfo {
    // Format ZeroError instances
    if (info.error instanceof ZeroError) {
      info.zerothrow = {
        type: 'ZeroError',
        code: info.error.code,
        message: info.error.message,
        statusCode: info.error.statusCode,
        details: info.error.details,
        stack: info.error.stack
      };
      info.message = `[${info.error.code}] ${info.error.message}`;
    }
    
    // Format Result types
    if (info.result && typeof info.result === 'object' && 'isOk' in info.result && 'isErr' in info.result) {
      const result = info.result as Result<any, any>;
      
      if (result.isOk()) {
        info.zerothrow = {
          type: 'Result',
          status: 'ok',
          value: result.value
        };
        info.message = `[OK] ${info.message || 'Operation succeeded'}`;
      } else {
        info.zerothrow = {
          type: 'Result',
          status: 'err',
          error: result.error instanceof ZeroError ? {
            code: result.error.code,
            message: result.error.message,
            statusCode: result.error.statusCode,
            details: result.error.details
          } : {
            message: result.error.message || String(result.error)
          }
        };
        info.message = `[ERR] ${result.error instanceof ZeroError ? result.error.message : info.message || 'Operation failed'}`;
      }
    }
    
    // Add timestamp if not present
    if (!info.timestamp) {
      info.timestamp = new Date().toISOString();
    }
    
    return info;
  }
};

export function createWinstonLogger(winston: any, options: any = {}) {
  const format = winston.format;
  
  return winston.createLogger({
    ...options,
    format: format.combine(
      format.timestamp(),
      zerothrowWinstonFormat,
      options.format || format.json()
    )
  });
}