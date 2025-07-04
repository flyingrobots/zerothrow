import { describe, it, expect, vi } from 'vitest';
import { ZT, ZeroThrow } from '../src/index.js';

describe('New Combinator Extensions', () => {
  describe('tap', () => {
    it('should execute side effect on success without changing result', () => {
      const sideEffect = vi.fn();
      
      const result = ZT.ok(42)
        .tap(value => {
          sideEffect(value);
          expect(value).toBe(42);
        });
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
      expect(sideEffect).toHaveBeenCalledWith(42);
    });
    
    it('should not execute on error', () => {
      const sideEffect = vi.fn();
      
      const result = ZT.err(new Error('fail'))
        .tap(sideEffect);
      
      expect(result.ok).toBe(false);
      expect(sideEffect).not.toHaveBeenCalled();
    });
    
    it('should chain with other combinators', () => {
      const log: string[] = [];
      
      const result = ZT.ok(10)
        .tap(v => log.push(`Got ${v}`))
        .map(v => v * 2)
        .tap(v => log.push(`Doubled to ${v}`))
        .andThen(v => ZT.ok(v + 5))
        .tap(v => log.push(`Final value ${v}`));
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(25);
      expect(log).toEqual(['Got 10', 'Doubled to 20', 'Final value 25']);
    });
  });
  
  describe('tapErr', () => {
    it('should execute side effect on error without changing result', () => {
      const errorLog = vi.fn();
      const err = new Error('Something went wrong');
      
      const result = ZT.err(err)
        .tapErr(error => {
          errorLog(error.message);
        });
      
      expect(result.ok).toBe(false);
      expect(result.error).toBe(err);
      expect(errorLog).toHaveBeenCalledWith('Something went wrong');
    });
    
    it('should not execute on success', () => {
      const errorLog = vi.fn();
      
      const result = ZT.ok('success')
        .tapErr(errorLog);
      
      expect(result.ok).toBe(true);
      expect(errorLog).not.toHaveBeenCalled();
    });
  });
  
  describe('finally', () => {
    it('should execute on success with value', () => {
      const cleanup = vi.fn();
      
      const result = ZT.ok('resource')
        .finally(value => {
          cleanup(value);
        });
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe('resource');
      expect(cleanup).toHaveBeenCalledWith('resource');
    });
    
    it('should execute on error with undefined', () => {
      const cleanup = vi.fn();
      
      const result = ZT.err(new Error('failed'))
        .finally(value => {
          cleanup(value);
        });
      
      expect(result.ok).toBe(false);
      expect(cleanup).toHaveBeenCalledWith(undefined);
    });
    
    it('should work in resource cleanup pattern', () => {
      const log: string[] = [];
      
      // Simulate resource allocation and cleanup
      const useResource = (shouldFail: boolean) =>
        ZT.ok('connection')
          .tap(() => log.push('Acquired resource'))
          .andThen(resource => 
            shouldFail 
              ? ZT.err(new Error('Operation failed'))
              : ZT.ok(`Used ${resource}`)
          )
          .finally(resource => {
            log.push(`Cleanup: ${resource || 'no resource'}`);
          });
      
      // Success case - finally gets the transformed value
      log.length = 0;
      const success = useResource(false);
      expect(success.ok).toBe(true);
      expect(log).toEqual(['Acquired resource', 'Cleanup: Used connection']);
      
      // Failure case - finally gets undefined on error
      log.length = 0;
      const failure = useResource(true);
      expect(failure.ok).toBe(false);
      expect(log).toEqual(['Acquired resource', 'Cleanup: no resource']);
    });
  });
  
  describe('Async combinators', () => {
    it('should support tap on enhanced promises', async () => {
      const log: string[] = [];
      
      const result = await ZeroThrow.enhance(
        Promise.resolve(ZT.ok(100))
      )
        .tap(v => log.push(`Async tap: ${v}`))
        .map(v => v * 2)
        .tap(v => log.push(`After map: ${v}`));
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe(200);
      expect(log).toEqual(['Async tap: 100', 'After map: 200']);
    });
    
    it('should support tapErr on enhanced promises', async () => {
      const errorLog: string[] = [];
      
      const result = await ZeroThrow.enhance(
        Promise.resolve(ZT.err(new Error('async fail')))
      )
        .tapErr(err => errorLog.push(`Error: ${err.message}`))
        .orElse(() => ZT.ok('fallback'))
        .tap(v => errorLog.push(`Recovered with: ${v}`));
      
      expect(result.ok).toBe(true);
      expect(result.value).toBe('fallback');
      expect(errorLog).toEqual(['Error: async fail', 'Recovered with: fallback']);
    });
    
    it('should support finally on enhanced promises', async () => {
      const cleanup = vi.fn();
      
      const doAsyncWork = (shouldFail: boolean) =>
        ZeroThrow.enhance(
          Promise.resolve(
            shouldFail 
              ? ZT.err(new Error('async error'))
              : ZT.ok('async result')
          )
        )
          .finally(value => {
            cleanup(value);
          });
      
      // Success case
      const success = await doAsyncWork(false);
      expect(success.ok).toBe(true);
      expect(cleanup).toHaveBeenCalledWith('async result');
      
      // Failure case  
      cleanup.mockClear();
      const failure = await doAsyncWork(true);
      expect(failure.ok).toBe(false);
      expect(cleanup).toHaveBeenCalledWith(undefined);
    });
  });
  
  describe('Real-world usage patterns', () => {
    it('should enable clean debugging flows', () => {
      const debugLog: any[] = [];
      
      const processUser = (id: number) =>
        ZT.ok(id)
          .tap(id => debugLog.push({ step: 'start', id }))
          .andThen(id => 
            id > 0 
              ? ZT.ok({ id, name: `User${id}` })
              : ZT.err(new Error('Invalid ID'))
          )
          .tap(user => debugLog.push({ step: 'fetched', user }))
          .map(user => ({ ...user, email: `${user.name.toLowerCase()}@example.com` }))
          .tap(user => debugLog.push({ step: 'enriched', user }))
          .tapErr(err => debugLog.push({ step: 'error', error: err.message }));
      
      // Success flow
      debugLog.length = 0;
      const success = processUser(123);
      expect(success.ok).toBe(true);
      expect(debugLog).toHaveLength(3);
      expect(debugLog[0].step).toBe('start');
      expect(debugLog[1].step).toBe('fetched');
      expect(debugLog[2].step).toBe('enriched');
      
      // Error flow
      debugLog.length = 0;
      const failure = processUser(-1);
      expect(failure.ok).toBe(false);
      expect(debugLog).toHaveLength(2);
      expect(debugLog[0].step).toBe('start');
      expect(debugLog[1].step).toBe('error');
    });
  });
});