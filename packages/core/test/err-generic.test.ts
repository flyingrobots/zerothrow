import { describe, it, expect } from 'vitest';
import { ZT, type Result, type ZeroError } from '../src/index.js';

// Test enums for typed error codes
enum ApiErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMITED = 'RATE_LIMITED'
}

enum DbErrorCode {
  CONNECTION_FAILED = 1001,
  QUERY_TIMEOUT = 1002,
  CONSTRAINT_VIOLATION = 1003
}

describe('ZT.err with generic error codes', () => {
  it('should accept string error codes (backward compatible)', () => {
    const result = ZT.err('SOMETHING_BROKE');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SOMETHING_BROKE');
      expect(result.error.message).toBe('SOMETHING_BROKE');
    }
  });

  it('should accept string error codes with custom message', () => {
    const result = ZT.err('VALIDATION_ERROR', 'Email is invalid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toBe('Email is invalid');
    }
  });

  it('should accept enum string error codes', () => {
    const result = ZT.err<ApiErrorCode>(ApiErrorCode.NETWORK_ERROR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ApiErrorCode.NETWORK_ERROR);
      expect(result.error.message).toBe('NETWORK_ERROR');
    }
  });

  it('should accept enum string error codes with message', () => {
    const result = ZT.err<ApiErrorCode>(ApiErrorCode.UNAUTHORIZED, 'Invalid token');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
      expect(result.error.message).toBe('Invalid token');
    }
  });

  it('should accept enum numeric error codes', () => {
    const result = ZT.err<DbErrorCode>(DbErrorCode.CONNECTION_FAILED);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(DbErrorCode.CONNECTION_FAILED);
      expect(result.error.message).toBe('1001'); // Numeric code converted to string
    }
  });

  it('should accept enum numeric error codes with message', () => {
    const result = ZT.err<DbErrorCode>(DbErrorCode.QUERY_TIMEOUT, 'Query took too long');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(DbErrorCode.QUERY_TIMEOUT);
      expect(result.error.message).toBe('Query took too long');
    }
  });

  it('should accept Error objects (backward compatible)', () => {
    const error = new Error('Something went wrong');
    const result = ZT.err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(error);
      expect(result.error.message).toBe('Something went wrong');
    }
  });

  it('should provide type safety with enum error codes', () => {
    // This test verifies TypeScript inference works correctly
    function processApiCall(): Result<string, ZeroError> {
      // Should infer the error code type from the enum
      return ZT.err<ApiErrorCode>(ApiErrorCode.RATE_LIMITED, 'Too many requests');
    }

    const result = processApiCall();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ApiErrorCode.RATE_LIMITED);
    }
  });

  it('should accept symbol error codes', () => {
    const sym = Symbol('FATAL');
    const result = ZT.err(sym);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(sym);
      expect(result.error.message).toBe('Symbol(FATAL)');
    }
  });

  it('should accept symbol error codes with custom message', () => {
    const sym = Symbol('CRITICAL_FAILURE');
    const result = ZT.err(sym, 'System has encountered a critical failure');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(sym);
      expect(result.error.message).toBe('System has encountered a critical failure');
    }
  });
});
