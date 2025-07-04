import { describe, it, expect } from 'vitest';
import { ZT, ZeroThrow } from '../src/index.js';

describe('DX Improvements from Alpha Feedback', () => {
  describe('ZT.tryAsync', () => {
    it('should return Promise<Result<T,E>> for cleaner async handling', async () => {
      const result = await ZT.tryAsync(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { data: 'success' };
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ data: 'success' });
      }
    });

    it('should catch async errors', async () => {
      const result = await ZT.tryAsync(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        throw new Error('Async operation failed');
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Async operation failed');
      }
    });

    it('should catch synchronous errors in async function', async () => {
      const result = await ZT.tryAsync(async () => {
        throw new Error('Sync error in async');
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Sync error in async');
      }
    });
  });

  describe('ZT.err string overloads', () => {
    it('should accept a single string as error code', () => {
      const result = ZT.err('PARSE_ERROR');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ZeroThrow.ZeroError);
        expect(result.error.code).toBe('PARSE_ERROR');
        expect(result.error.message).toBe('PARSE_ERROR'); // code used as message
      }
    });

    it('should accept code and message separately', () => {
      const result = ZT.err('VALIDATION_ERROR', 'Email is required');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ZeroThrow.ZeroError);
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toBe('Email is required');
      }
    });

    it('should still accept Error objects', () => {
      const customError = new Error('Custom error');
      const result = ZT.err(customError);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(customError);
        expect(result.error.message).toBe('Custom error');
      }
    });

    it('should work with ZeroError objects', () => {
      const zeroError = new ZeroThrow.ZeroError('API_ERROR', 'API call failed', { endpoint: '/users' });
      const result = ZT.err(zeroError);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe(zeroError);
        expect(result.error.code).toBe('API_ERROR');
        expect(result.error.context).toEqual({ endpoint: '/users' });
      }
    });
  });

  describe('Async handling comparison', () => {
    it('ZT.try with async function returns Promise<Result>', async () => {
      const promiseResult = ZT.try(() => Promise.resolve('hello'));
      
      // It's a Promise
      expect(promiseResult).toBeInstanceOf(Promise);
      
      // After awaiting, it's a Result
      const result = await promiseResult;
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('hello');
      }
    });

    it('ZT.tryAsync makes async intent clearer', async () => {
      // More explicit that we're dealing with async
      const result = await ZT.tryAsync(async () => {
        const response = await Promise.resolve({ status: 200 });
        return response;
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ status: 200 });
      }
    });
  });
});