import { describe, it, expect } from 'vitest';
import { ZT } from '../src/index.js';

describe('ZT Namespace', () => {
  describe('Core types', () => {
    it('should export Result type', () => {
      const result: ZT.Result<number> = ZT.ok(42);
      expect(result.ok).toBe(true);
    });

    it('should export OK and ERR type aliases', () => {
      const ok: ZT.OK<string> = ZT.ok('test');
      const err: ZT.ERR<ZT.Error> = ZT.err(new ZT.Error('TEST', 'error'));
      expect(ok.ok).toBe(true);
      expect(err.ok).toBe(false);
    });

    it('should export Error class', () => {
      const error = new ZT.Error('TEST_CODE', 'Test message');
      expect(error).toBeInstanceOf(ZT.Error);
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
    });
  });

  describe('ZT.promise', () => {
    it('should enhance a promise with combinator methods', async () => {
      const enhanced = ZT.promise(Promise.resolve(ZT.ok(42)));
      expect(enhanced.andThen).toBeDefined();
      expect(enhanced.map).toBeDefined();
      expect(enhanced.mapErr).toBeDefined();
      expect(enhanced.orElse).toBeDefined();
      expect(enhanced.unwrapOr).toBeDefined();
      expect(enhanced.unwrapOrThrow).toBeDefined();
    });

    it('should chain andThen operations', async () => {
      const result = await ZT.promise(Promise.resolve(ZT.ok(10)))
        .andThen(x => ZT.ok(x * 2))
        .andThen(x => ZT.ok(x + 5));
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(25);
    });

    it('should map values', async () => {
      const result = await ZT.promise(Promise.resolve(ZT.ok('hello')))
        .map(s => s.toUpperCase());
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('HELLO');
    });

    it('should map errors', async () => {
      const result = await ZT.promise(Promise.resolve(ZT.err(new Error('test'))))
        .mapErr(e => new ZT.Error('MAPPED', e.message));
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ZT.Error);
        expect(result.error.code).toBe('MAPPED');
      }
    });

    it('should handle orElse fallback', async () => {
      const result = await ZT.promise(Promise.resolve(ZT.err(new Error('fail'))))
        .orElse(() => ZT.ok('fallback'));
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('fallback');
    });

    it('should unwrapOr with default', async () => {
      const value = await ZT.promise(Promise.resolve(ZT.err(new Error('fail'))))
        .unwrapOr('default');
      
      expect(value).toBe('default');
    });

    it('should unwrapOrThrow on success', async () => {
      const value = await ZT.promise(Promise.resolve(ZT.ok('success')))
        .unwrapOrThrow();
      
      expect(value).toBe('success');
    });

    it('should throw on unwrapOrThrow with error', async () => {
      await expect(
        ZT.promise(Promise.resolve(ZT.err(new Error('fail'))))
          .unwrapOrThrow()
      ).rejects.toThrow('fail');
    });
  });

  describe('ZT.async', () => {
    it('should create enhanced promise from async function', async () => {
      const result = await ZT.async(async () => ZT.ok(42))
        .map(x => x * 2);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(84);
    });
  });

  describe('Type guards', () => {
    it('ZT.isResult should identify Result types', () => {
      const okResult = ZT.ok(1);
      const errResult = ZT.err(new ZT.Error('TEST', 'test error'));
      
      expect(ZT.isResult(okResult)).toBe(true);
      expect(ZT.isResult(errResult)).toBe(true);
      expect(ZT.isResult(null)).toBe(false);
      expect(ZT.isResult({})).toBe(false);
      expect(ZT.isResult({ ok: 'true' })).toBe(false);
      expect(ZT.isResult({ ok: false, error: 'not an error' })).toBe(false);
      
      // Check plain objects that match Result shape
      const plainOk = { ok: true, value: 1 };
      const plainErr = { ok: false, error: new Error() };
      expect(ZT.isResult(plainOk)).toBe(true);
      expect(ZT.isResult(plainErr)).toBe(true);
    });

    it('ZT.isOk should identify Ok results', () => {
      const ok = ZT.ok(1);
      const err = ZT.err(new Error());
      
      expect(ZT.isOk(ok)).toBe(true);
      expect(ZT.isOk(err)).toBe(false);
    });

    it('ZT.isErr should identify Err results', () => {
      const ok = ZT.ok(1);
      const err = ZT.err(new Error());
      
      expect(ZT.isErr(ok)).toBe(false);
      expect(ZT.isErr(err)).toBe(true);
    });
  });

  describe('All functions exported', () => {
    it('should export all core functions', () => {
      expect(ZT.ok).toBeDefined();
      expect(ZT.err).toBeDefined();
      expect(ZT.tryR).toBeDefined();
      expect(ZT.tryRSync).toBeDefined();
      expect(ZT.tryRBatch).toBeDefined();
      expect(ZT.wrap).toBeDefined();
    });

    it('should export all combinator functions', () => {
      expect(ZT.pipe).toBeDefined();
      expect(ZT.collect).toBeDefined();
      expect(ZT.collectAsync).toBeDefined();
      expect(ZT.firstSuccess).toBeDefined();
      expect(ZT.makeCombinable).toBeDefined();
    });
  });
});