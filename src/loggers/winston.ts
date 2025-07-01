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
      const codeStr = typeof info.error.code === 'symbol' ? String(info.error.code) : String(info.error.code);
      info.zerothrow = {
        type: 'ZeroError',
        code: codeStr,
        message: info.error.message,
        context: info.error.context,
        stack: info.error.stack
      };
      info.message = `[${codeStr}] ${info.error.message}`;
    }
    
    // Format Result types
    if (info.result && typeof info.result === 'object' && 'ok' in info.result) {
      const result = info.result as Result<any, any>;
      
      if (result.ok) {
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
            code: typeof result.error.code === 'symbol' ? String(result.error.code) : result.error.code,
            message: result.error.message,
            context: result.error.context
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