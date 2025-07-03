import { describe, it, expect } from 'vitest';
import { 
  ZTResult, 
  ZTPromise, 
  ztOk, 
  ztErr, 
  ztPromise, 
  isZTResult 
} from '../src/types.js';
import { ZT, ZeroThrow } from '../src/index.js';

describe('Type Aliases', () => {
  describe('ZTResult type', () => {
    it('should work as alias for ZeroThrow.Result', () => {
      const result: ZTResult<number> = ztOk(42);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(42);
    });

    it('should support custom error types', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      
      const result: ZTResult<string, CustomError> = ztErr(new CustomError('fail'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(CustomError);
    });
  });

  describe('Helper functions', () => {
    it('ztOk creates ok results', () => {
      const result = ztOk('success');
      expect(result.ok).toBe(true);
      expect(result).toHaveProperty('value', 'success');
    });

    it('ztErr creates error results from string', () => {
      const result = ztErr('Operation failed');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ZeroThrow.ZeroError);
        expect(result.error.code).toBe('ERROR');
        expect(result.error.message).toBe('Operation failed');
      }
    });

    it('ztErr creates error results from object', () => {
      const result = ztErr({ code: 'FAIL', message: 'Operation failed' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ZeroThrow.ZeroError);
        expect(result.error.code).toBe('FAIL');
        expect(result.error.message).toBe('Operation failed');
      }
    });

    it('ztErr creates error results from ZeroThrow.ZeroError with context', () => {
      const context = { userId: 123 };
      const error = new ZeroThrow.ZeroError('FAIL', 'Operation failed', { context });
      const result = ztErr(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error.context).toEqual(context);
      }
    });

    it('ztErr creates error results with existing error', () => {
      const error = new Error('Original error');
      const result = ztErr(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(error);
        expect(result.error.message).toBe('Original error');
      }
    });
  });

  describe('ZTPromise', () => {
    it('should enhance promises with combinator methods', async () => {
      const promise: ZTPromise<number> = ztPromise(Promise.resolve(ZT.ok(42)));
      
      const result = await promise
        .map(x => x * 2)
        .andThen(x => ZT.ok(x + 8));
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(92);
    });

    it('should handle error mapping', async () => {
      const promise: ZTPromise<string> = ztPromise(
        Promise.resolve(ZT.err(new ZeroThrow.ZeroError('ORIGINAL', 'fail')))
      );
      
      const result = await promise
        .mapErr(e => new ZeroThrow.ZeroError('MAPPED', e.message));
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MAPPED');
      }
    });

    it('should support custom error types', async () => {
      class ApiError extends Error {
        constructor(public statusCode: number, message: string) {
          super(message);
        }
      }
      
      const promise: ZTPromise<string, ApiError> = ztPromise(
        Promise.resolve(ZT.err(new ApiError(404, 'Not found')))
      );
      
      const value = await promise.unwrapOr('default');
      expect(value).toBe('default');
    });
  });

  describe('isZTResult type guard', () => {
    it('should identify ZTResult types', () => {
      expect(isZTResult(ztOk(1))).toBe(true);
      expect(isZTResult(ztErr('ERR', 'fail'))).toBe(true);
      expect(isZTResult(ZT.ok(1))).toBe(true);
      expect(isZTResult(ZT.err(new Error()))).toBe(true);
      expect(isZTResult(null)).toBe(false);
      expect(isZTResult({})).toBe(false);
      expect(isZTResult({ ok: 'not boolean' })).toBe(false);
    });

    it('should narrow types correctly', () => {
      const value: unknown = ztOk('test');
      
      if (isZTResult(value)) {
        if (value.ok) {
          expect(value.value).toBe('test');
        }
      } else {
        throw new Error('Should be ZTResult');
      }
    });
  });
});