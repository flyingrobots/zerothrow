import { describe, it, expect } from 'vitest';
import { ZT, ZeroThrow } from '../src/index.js';

describe('Modern ZT Patterns', () => {
  describe('ZT pocket knife', () => {
    it('should provide try, ok, and err functions', () => {
      expect(ZT.try).toBeDefined();
      expect(ZT.ok).toBeDefined();
      expect(ZT.err).toBeDefined();
    });

    it('ZT.try handles sync operations', () => {
      const result = ZT.try(() => 42);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(42);
    });

    it('ZT.try handles sync errors', () => {
      const result = ZT.try(() => {
        throw new Error('sync fail');
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toBe('sync fail');
    });

    it('ZT.try handles async operations', async () => {
      const result = await ZT.try(async () => 'async success');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('async success');
    });

    it('ZT.try handles async errors', async () => {
      const result = await ZT.try(async () => {
        throw new Error('async fail');
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toBe('async fail');
    });

    it('ZT.ok creates success results', () => {
      const result = ZT.ok('success');
      expect(result.ok).toBe(true);
      expect(result).toHaveProperty('value', 'success');
    });

    it('ZT.err creates error results', () => {
      const result = ZT.err(new Error('failure'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toBe('failure');
    });
  });

  describe('ZeroThrow namespace', () => {
    it('should provide full API with clean names', () => {
      // Core functions
      expect(ZeroThrow.attempt).toBeDefined();
      expect(ZeroThrow.try).toBeDefined(); // Grace period alias
      expect(ZeroThrow.ok).toBeDefined();
      expect(ZeroThrow.err).toBeDefined();
      expect(ZeroThrow.wrap).toBeDefined();
      
      // Enhancement functions
      expect(ZeroThrow.enhance).toBeDefined();
      expect(ZeroThrow.fromAsync).toBeDefined();
      
      // Combinators
      expect(ZeroThrow.pipe).toBeDefined();
      expect(ZeroThrow.collect).toBeDefined();
      expect(ZeroThrow.collectAsync).toBeDefined();
      expect(ZeroThrow.firstSuccess).toBeDefined();
      
      // Type guards
      expect(ZeroThrow.isResult).toBeDefined();
      expect(ZeroThrow.isOk).toBeDefined();
      expect(ZeroThrow.isErr).toBeDefined();
    });

    it('ZeroThrow.attempt handles all cases with single function', () => {
      // Sync
      const syncResult = ZeroThrow.attempt(() => 42);
      expect(syncResult.ok).toBe(true);
      if (syncResult.ok) expect(syncResult.value).toBe(42);
      
      // Sync with error mapping
      const errorResult = ZeroThrow.attempt(
        () => { throw new Error('fail'); },
        (e) => new ZeroThrow.ZeroError('MAPPED', e instanceof Error ? e.message : 'Unknown')
      );
      expect(errorResult.ok).toBe(false);
      if (!errorResult.ok) expect(errorResult.error.code).toBe('MAPPED');
    });

    it('ZeroThrow.attempt handles async operations', async () => {
      const asyncResult = await ZeroThrow.attempt(async () => 'async value');
      expect(asyncResult.ok).toBe(true);
      if (asyncResult.ok) expect(asyncResult.value).toBe('async value');
    });

    it('ZeroThrow.attempt handles batch operations', async () => {
      const batchResult = await ZeroThrow.attempt([
        () => 1,
        async () => 2,
        () => 3
      ]);
      expect(batchResult.ok).toBe(true);
      if (batchResult.ok) expect(batchResult.value).toEqual([1, 2, 3]);
    });

    it('ZeroThrow.enhance creates Async with combinators', async () => {
      const enhanced = ZeroThrow.enhance(Promise.resolve(ZT.ok(10)));
      
      const result = await enhanced
        .map(x => x * 2)
        .andThen(x => ZT.ok(x + 5))
        .map(x => x.toString());
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('25');
    });

    it('ZeroThrow.fromAsync wraps async functions', async () => {
      const result = await ZeroThrow.fromAsync(async () => ZT.ok('wrapped'))
        .map(s => s.toUpperCase());
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('WRAPPED');
    });
  });

  describe('Result combinators', () => {
    it('all Results have combinator methods by default', () => {
      const result = ZT.ok(42);
      expect(result.andThen).toBeDefined();
      expect(result.map).toBeDefined();
      expect(result.mapErr).toBeDefined();
      expect(result.orElse).toBeDefined();
      expect(result.unwrapOr).toBeDefined();
      expect(result.unwrapOrThrow).toBeDefined();
    });

    it('can chain combinators fluently', () => {
      const result = ZT.ok(10)
        .map(x => x * 2)
        .andThen(x => x > 15 ? ZT.ok(x) : ZT.err(new Error('too small')))
        .map(x => x + 5);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(25);
    });

    it('error handling with mapErr and orElse', () => {
      const result = ZT.err(new Error('original'))
        .mapErr(e => new ZeroThrow.ZeroError('MAPPED', e.message))
        .orElse(() => ZT.ok('fallback'));
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('fallback');
    });
  });

  describe('Type guards', () => {
    it('ZeroThrow.isResult identifies Result types', () => {
      expect(ZeroThrow.isResult(ZT.ok(1))).toBe(true);
      expect(ZeroThrow.isResult(ZT.err(new Error()))).toBe(true);
      expect(ZeroThrow.isResult({ ok: true, value: 1 })).toBe(true);
      expect(ZeroThrow.isResult({ ok: false, error: new Error() })).toBe(true);
      expect(ZeroThrow.isResult(null)).toBe(false);
      expect(ZeroThrow.isResult({ ok: 'not boolean' })).toBe(false);
    });

    it('ZeroThrow.isOk and isErr narrow types correctly', () => {
      const value: unknown = ZT.ok('test');
      
      if (ZeroThrow.isResult(value)) {
        if (ZeroThrow.isOk(value)) {
          expect(value.value).toBe('test');
        } else {
          throw new Error('Should be Ok');
        }
      }
    });
  });

  describe('Async type (replaces Promise interface)', () => {
    it('ZeroThrow.Async provides enhanced promises', async () => {
      const asyncOp: ZeroThrow.Async<number> = ZeroThrow.enhance(
        Promise.resolve(ZT.ok(42))
      );
      
      const result = await asyncOp
        .map(x => x / 2)
        .andThen(x => x > 20 ? ZT.ok(x) : ZT.err(new ZeroThrow.ZeroError('TOO_SMALL', 'Value too small')))
        .map(x => Math.round(x));
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(21);
    });

    it('Async type supports custom error types', async () => {
      class CustomError extends Error {
        constructor(public code: string, message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      
      const asyncOp: ZeroThrow.Async<string, CustomError> = ZeroThrow.enhance(
        Promise.resolve(ZT.err(new CustomError('CUSTOM', 'Custom error')))
      );
      
      const value = await asyncOp.unwrapOr('default');
      expect(value).toBe('default');
    });
  });

  describe('Real-world patterns', () => {
    it('API call with retry logic', async () => {
      let attempts = 0;
      
      const apiCall = () => ZeroThrow.attempt(async () => {
        attempts++;
        if (attempts < 3) throw new Error('Network error');
        return { id: 1, name: 'Success' };
      });
      
      const result = await ZeroThrow.firstSuccess([
        apiCall,
        apiCall,
        apiCall
      ]);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Success');
      expect(attempts).toBe(3);
    });

    it('Form validation pipeline', () => {
      const validateEmail = (email: string) =>
        email.includes('@') 
          ? ZT.ok(email)
          : ZT.err(new ZeroThrow.ZeroError('INVALID_EMAIL', 'Email must contain @'));
      
      const validateLength = (email: string) =>
        email.length > 5
          ? ZT.ok(email)
          : ZT.err(new ZeroThrow.ZeroError('TOO_SHORT', 'Email too short'));
      
      const result = ZT.ok('test@example.com')
        .andThen(validateEmail)
        .andThen(validateLength)
        .map(email => ({ email, normalized: email.toLowerCase() }));
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.normalized).toBe('test@example.com');
    });

    it('Database transaction with rollback', async () => {
      const mockDb = {
        begin: () => ZT.ok('tx'),
        query: (tx: string, sql: string) => 
          sql.includes('ERROR') 
            ? ZT.err(new Error('Query failed'))
            : ZT.ok({ rows: 1 }),
        commit: (tx: string) => ZT.ok(undefined),
        rollback: (tx: string) => ZT.ok(undefined)
      };
      
      const transaction = await ZeroThrow.attempt(async () => {
        const tx = mockDb.begin();
        if (!tx.ok) return tx;
        
        const result1 = mockDb.query(tx.value, 'INSERT INTO users');
        if (!result1.ok) {
          mockDb.rollback(tx.value);
          return result1;
        }
        
        const result2 = mockDb.query(tx.value, 'INSERT ERROR');
        if (!result2.ok) {
          mockDb.rollback(tx.value);
          return result2;
        }
        
        return mockDb.commit(tx.value);
      });
      
      expect(transaction.ok).toBe(false);
      if (!transaction.ok) expect(transaction.error.message).toBe('Query failed');
    });
  });
});