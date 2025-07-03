import { describe, it, expect } from 'vitest';
import { ZT, ZeroThrow } from '../src/index.js';

describe('ZT Namespace', () => {
  describe('Core types', () => {
    it('should export Result type', () => {
      const result: ZeroThrow.Result<number> = ZT.ok(42);
      expect(result.ok).toBe(true);
    });

    it('should export OK and ERR type aliases', () => {
      const ok: ZT.OK<string> = ZT.ok('test');
      const err: ZT.ERR<ZeroThrow.ZeroError> = ZT.err(new ZeroThrow.ZeroError('TEST', 'error'));
      expect(ok.ok).toBe(true);
      expect(err.ok).toBe(false);
    });

    it('should export Error class', () => {
      const error = new ZeroThrow.ZeroError('TEST_CODE', 'Test message');
      expect(error).toBeInstanceOf(ZeroThrow.ZeroError);
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
    });
  });

  describe('ZeroThrow.enhance', () => {
    it('should enhance a promise with combinator methods', async () => {
      const enhanced = ZeroThrow.enhance(Promise.resolve(ZT.ok(42)));
      expect(enhanced.andThen).toBeDefined();
      expect(enhanced.map).toBeDefined();
      expect(enhanced.mapErr).toBeDefined();
      expect(enhanced.orElse).toBeDefined();
      expect(enhanced.unwrapOr).toBeDefined();
      expect(enhanced.unwrapOrThrow).toBeDefined();
    });

    it('should chain andThen operations', async () => {
      const result = await ZeroThrow.enhance(Promise.resolve(ZT.ok(10)))
        .andThen(x => ZT.ok(x * 2))
        .andThen(x => ZT.ok(x + 5));
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(25);
    });

    it('should map values', async () => {
      const result = await ZeroThrow.enhance(Promise.resolve(ZT.ok('hello')))
        .map(s => s.toUpperCase());
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('HELLO');
    });

    it('should map errors', async () => {
      const result = await ZeroThrow.enhance(Promise.resolve(ZT.err(new Error('test'))))
        .mapErr(e => new ZeroThrow.ZeroError('MAPPED', e.message));
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ZeroThrow.ZeroError);
        expect(result.error.code).toBe('MAPPED');
      }
    });

    it('should handle orElse fallback', async () => {
      const result = await ZeroThrow.enhance(Promise.resolve(ZT.err(new Error('fail'))))
        .orElse(() => ZT.ok('fallback'));
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('fallback');
    });

    it('should unwrapOr with default', async () => {
      const value = await ZeroThrow.enhance(Promise.resolve(ZT.err(new Error('fail'))))
        .unwrapOr('default');
      
      expect(value).toBe('default');
    });

    it('should unwrapOrThrow on success', async () => {
      const value = await ZeroThrow.enhance(Promise.resolve(ZT.ok('success')))
        .unwrapOrThrow();
      
      expect(value).toBe('success');
    });

    it('should throw on unwrapOrThrow with error', async () => {
      await expect(
        ZeroThrow.enhance(Promise.resolve(ZT.err(new Error('fail'))))
          .unwrapOrThrow()
      ).rejects.toThrow('fail');
    });
  });

  describe('ZeroThrow.fromAsync', () => {
    it('should create enhanced promise from async function', async () => {
      const result = await ZeroThrow.fromAsync(async () => ZT.ok(42))
        .map(x => x * 2);
      
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(84);
    });
  });

  describe('Type guards', () => {
    it('ZeroThrow.isResult should identify Result types', () => {
      const okResult = ZT.ok(1);
      const errResult = ZT.err(new ZeroThrow.ZeroError('TEST', 'test error'));
      
      expect(ZeroThrow.isResult(okResult)).toBe(true);
      expect(ZeroThrow.isResult(errResult)).toBe(true);
      expect(ZeroThrow.isResult(null)).toBe(false);
      expect(ZeroThrow.isResult({})).toBe(false);
      expect(ZeroThrow.isResult({ ok: 'true' })).toBe(false);
      expect(ZeroThrow.isResult({ ok: false, error: 'not an error' })).toBe(false);
      
      // Check plain objects that match Result shape
      const plainOk = { ok: true, value: 1 };
      const plainErr = { ok: false, error: new Error() };
      expect(ZeroThrow.isResult(plainOk)).toBe(true);
      expect(ZeroThrow.isResult(plainErr)).toBe(true);
    });

    it('ZeroThrow.isOk should identify Ok results', () => {
      const ok = ZT.ok(1);
      const err = ZT.err(new Error());
      
      expect(ZeroThrow.isOk(ok)).toBe(true);
      expect(ZeroThrow.isOk(err)).toBe(false);
    });

    it('ZeroThrow.isErr should identify Err results', () => {
      const ok = ZT.ok(1);
      const err = ZT.err(new Error());
      
      expect(ZeroThrow.isErr(ok)).toBe(false);
      expect(ZeroThrow.isErr(err)).toBe(true);
    });
  });

  describe('All functions exported', () => {
    it('should export all core functions', () => {
      expect(ZT.ok).toBeDefined();
      expect(ZT.err).toBeDefined();
      expect(ZT.try).toBeDefined();
      expect(ZeroThrow.wrap).toBeDefined();
    });

    it('should export all combinator functions', () => {
      expect(ZeroThrow.pipe).toBeDefined();
      expect(ZeroThrow.collect).toBeDefined();
      expect(ZeroThrow.collectAsync).toBeDefined();
      expect(ZeroThrow.firstSuccess).toBeDefined();
      // makeCombinable is no longer needed - Results are combinable by default!
    });
  });
});