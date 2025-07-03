import { describe, it, expect } from 'vitest';
import { deriveErrorCode } from '../../../src/eslint/no-throw/derive-error-code.js';

describe('deriveErrorCode', () => {
  it('derives NOT_FOUND from "not found" messages', () => {
    expect(deriveErrorCode('User not found')).toBe('NOT_FOUND');
    expect(deriveErrorCode('Resource not found in database')).toBe('NOT_FOUND');
    expect(deriveErrorCode('NOT FOUND')).toBe('NOT_FOUND');
  });

  it('derives UNAUTHORIZED from authorization messages', () => {
    expect(deriveErrorCode('User not authorized')).toBe('UNAUTHORIZED');
    expect(deriveErrorCode('Unauthorized access')).toBe('UNAUTHORIZED');
    expect(deriveErrorCode('You are unauthorized')).toBe('UNAUTHORIZED');
  });

  it('derives FORBIDDEN from access denied messages', () => {
    expect(deriveErrorCode('Access denied')).toBe('FORBIDDEN');
    expect(deriveErrorCode('Forbidden resource')).toBe('FORBIDDEN');
    expect(deriveErrorCode('ACCESS DENIED to admin panel')).toBe('FORBIDDEN');
  });

  it('derives VALIDATION_ERROR from validation messages', () => {
    expect(deriveErrorCode('Invalid input')).toBe('VALIDATION_ERROR');
    expect(deriveErrorCode('Validation failed')).toBe('VALIDATION_ERROR');
    expect(deriveErrorCode('Email is invalid')).toBe('VALIDATION_ERROR');
  });

  it('derives TIMEOUT from timeout messages', () => {
    expect(deriveErrorCode('Request timeout')).toBe('TIMEOUT');
    expect(deriveErrorCode('Operation timed out')).toBe('TIMEOUT');
    expect(deriveErrorCode('Connection TIMEOUT after 30s')).toBe('TIMEOUT');
  });

  it('derives NETWORK_ERROR from network messages', () => {
    expect(deriveErrorCode('Network error')).toBe('NETWORK_ERROR');
    expect(deriveErrorCode('Connection refused')).toBe('NETWORK_ERROR');
    expect(deriveErrorCode('Lost network connection')).toBe('NETWORK_ERROR');
  });

  it('derives DATABASE_ERROR from database messages', () => {
    expect(deriveErrorCode('Database error')).toBe('DATABASE_ERROR');
    expect(deriveErrorCode('DB query error')).toBe('DATABASE_ERROR');
    expect(deriveErrorCode('Cannot connect to database')).toBe('DATABASE_ERROR');
  });

  it('derives CONFLICT from conflict messages', () => {
    expect(deriveErrorCode('Resource conflict')).toBe('CONFLICT');
    expect(deriveErrorCode('Conflicting operation')).toBe('CONFLICT');
    expect(deriveErrorCode('Version CONFLICT detected')).toBe('CONFLICT');
  });

  it('derives RATE_LIMIT from rate limit messages', () => {
    expect(deriveErrorCode('Rate limit exceeded')).toBe('RATE_LIMIT');
    expect(deriveErrorCode('Too many requests, rate limit')).toBe('RATE_LIMIT');
    expect(deriveErrorCode('RATE LIMIT: slow down')).toBe('RATE_LIMIT');
  });

  it('derives NOT_IMPLEMENTED from not implemented messages', () => {
    expect(deriveErrorCode('Feature not implemented')).toBe('NOT_IMPLEMENTED');
    expect(deriveErrorCode('Not implemented yet')).toBe('NOT_IMPLEMENTED');
    expect(deriveErrorCode('This is NOT IMPLEMENTED')).toBe('NOT_IMPLEMENTED');
  });

  it('returns TODO_ERROR_CODE for unmatched messages', () => {
    expect(deriveErrorCode('Something went wrong')).toBe('TODO_ERROR_CODE');
    expect(deriveErrorCode('Generic error')).toBe('TODO_ERROR_CODE');
    expect(deriveErrorCode('Oops')).toBe('TODO_ERROR_CODE');
    expect(deriveErrorCode('')).toBe('TODO_ERROR_CODE');
  });

  it('matches case-insensitively', () => {
    expect(deriveErrorCode('user NOT FOUND')).toBe('NOT_FOUND');
    expect(deriveErrorCode('INVALID data')).toBe('VALIDATION_ERROR');
    expect(deriveErrorCode('Database Error')).toBe('DATABASE_ERROR');
  });

  it('matches partial words', () => {
    expect(deriveErrorCode('invalidate cache')).toBe('VALIDATION_ERROR');
    expect(deriveErrorCode('networking issue')).toBe('NETWORK_ERROR');
  });
});