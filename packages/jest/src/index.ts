import type { Result } from '@zerothrow/core';

// Extend the expect types for Jest
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeOk(): R;
      toBeOkWith<T>(expected: T): R;
      toBeErr(): R;
      toBeErrWith<E extends Error>(error: E | { code?: string; message?: string }): R;
      toHaveErrorCode(code: string): R;
      toHaveErrorMessage(message: string | RegExp): R;
    }
  }
}

// Extend Vitest types
declare module 'vitest' {
  interface Assertion {
    toBeOk(): void;
    toBeOkWith<T>(expected: T): void;
    toBeErr(): void;
    toBeErrWith<E extends Error>(error: E | { code?: string; message?: string }): void;
    toHaveErrorCode(code: string): void;
    toHaveErrorMessage(message: string | RegExp): void;
  }
}

export function toBeOk(this: jest.MatcherContext, received: unknown) {
  const pass = isResult(received) && received.ok === true;
  
  if (pass) {
    return {
      message: () => `expected Result not to be Ok, but it was Ok with value: ${JSON.stringify((received as { value: unknown }).value)}`,
      pass: true,
    };
  } else {
    const error = isResult(received) && !received.ok ? (received as { error: unknown }).error : received;
    return {
      message: () => `expected Result to be Ok, but it was Err with error: ${formatError(error)}`,
      pass: false,
    };
  }
}

export function toBeOkWith<T>(this: jest.MatcherContext, received: unknown, expected: T) {
  if (!isResult(received)) {
    return {
      message: () => `expected Result type, but received ${typeof received}`,
      pass: false,
    };
  }
  
  if (!received.ok) {
    return {
      message: () => `expected Result to be Ok with value ${JSON.stringify(expected)}, but it was Err with error: ${formatError((received as { error: unknown }).error)}`,
      pass: false,
    };
  }
  
  const actual = (received as { value: unknown }).value;
  const pass = this.equals(actual, expected);
  
  return {
    message: () => pass
      ? `expected Result not to be Ok with value ${JSON.stringify(expected)}`
      : `expected Result to be Ok with value ${JSON.stringify(expected)}, but was Ok with value ${JSON.stringify(actual)}`,
    pass,
  };
}

export function toBeErr(this: jest.MatcherContext, received: unknown) {
  const pass = isResult(received) && received.ok === false;
  
  if (pass) {
    return {
      message: () => `expected Result not to be Err, but it was Err with error: ${formatError((received as { error: unknown }).error)}`,
      pass: true,
    };
  } else {
    const value = isResult(received) && received.ok ? (received as { value: unknown }).value : received;
    return {
      message: () => `expected Result to be Err, but it was Ok with value: ${JSON.stringify(value)}`,
      pass: false,
    };
  }
}

export function toBeErrWith<E extends Error>(
  this: jest.MatcherContext, 
  received: unknown, 
  expected: E | { code?: string; message?: string }
) {
  if (!isResult(received)) {
    return {
      message: () => `expected Result type, but received ${typeof received}`,
      pass: false,
    };
  }
  
  if (received.ok) {
    return {
      message: () => `expected Result to be Err, but it was Ok with value: ${JSON.stringify((received as { value: unknown }).value)}`,
      pass: false,
    };
  }
  
  const actualError = (received as { error: Error }).error;
  let pass = false;
  
  if (expected instanceof Error) {
    // Exact error instance match
    pass = this.equals(actualError, expected);
  } else {
    // Match by properties
    pass = true;
    if (expected.code !== undefined && (actualError as Error & { code?: string }).code !== expected.code) {
      pass = false;
    }
    if (expected.message !== undefined && actualError.message !== expected.message) {
      pass = false;
    }
  }
  
  return {
    message: () => pass
      ? `expected Result not to be Err with ${formatError(expected)}`
      : `expected Result to be Err with ${formatError(expected)}, but was Err with ${formatError(actualError)}`,
    pass,
  };
}

export function toHaveErrorCode(this: jest.MatcherContext, received: unknown, code: string) {
  if (!isResult(received) || received.ok) {
    return {
      message: () => `expected Result to be Err with code "${code}", but it was ${isResult(received) && received.ok ? 'Ok' : 'not a Result'}`,
      pass: false,
    };
  }
  
  const actualCode = ((received as { error: Error }).error as Error & { code?: string }).code;
  const pass = actualCode === code;
  
  return {
    message: () => pass
      ? `expected Result not to have error code "${code}"`
      : `expected Result to have error code "${code}", but had "${actualCode}"`,
    pass,
  };
}

export function toHaveErrorMessage(this: jest.MatcherContext, received: unknown, message: string | RegExp) {
  if (!isResult(received) || received.ok) {
    return {
      message: () => `expected Result to be Err with message ${message}, but it was ${isResult(received) && received.ok ? 'Ok' : 'not a Result'}`,
      pass: false,
    };
  }
  
  const actualMessage = (received as { error: Error }).error.message;
  const pass = typeof message === 'string' 
    ? actualMessage === message
    : message.test(actualMessage);
  
  return {
    message: () => pass
      ? `expected Result not to have error message ${message}`
      : `expected Result to have error message ${message}, but had "${actualMessage}"`,
    pass,
  };
}

// Helper functions
function isResult(value: unknown): value is Result<unknown, Error> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'ok' in value &&
    typeof (value as { ok: unknown }).ok === 'boolean' &&
    ((value as { ok: boolean }).ok === true ? 'value' in value : 'error' in value)
  );
}

function formatError(error: unknown): string {
  if (!error) return 'undefined';
  if (error instanceof Error) {
    const parts = [`${error.name}: ${error.message}`];
    if ('code' in error) parts.push(`(code: ${(error as Error & { code?: string }).code})`);
    return parts.join(' ');
  }
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if ('code' in obj || 'message' in obj) {
      const parts = [];
      if (obj['code']) parts.push(`code: ${obj['code']}`);
      if (obj['message']) parts.push(`message: ${obj['message']}`);
      return `{ ${parts.join(', ')} }`;
    }
  }
  return JSON.stringify(error);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Matcher = (this: jest.MatcherContext, received: unknown, ...args: any[]) => jest.CustomMatcherResult;

// Helper to register matchers
export function registerMatchers(expectLib: { extend: (matchers: Record<string, Matcher>) => void }) {
  if (expectLib && typeof expectLib.extend === 'function') {
    expectLib.extend({
      toBeOk: toBeOk as Matcher,
      toBeOkWith: toBeOkWith as Matcher,
      toBeErr: toBeErr as Matcher,
      toBeErrWith: toBeErrWith as Matcher,
      toHaveErrorCode: toHaveErrorCode as Matcher,
      toHaveErrorMessage: toHaveErrorMessage as Matcher,
    });
  }
}

// Auto-register for common environments
// Jest global
if (typeof globalThis !== 'undefined' && 'expect' in globalThis) {
  const g = globalThis as unknown as { expect?: { extend?: (matchers: Record<string, Matcher>) => void } };
  if (g.expect && typeof g.expect.extend === 'function') {
    registerMatchers(g.expect as { extend: (matchers: Record<string, Matcher>) => void });
  }
}

// Export for Vitest setup
export const vitestMatchers = {
  toBeOk,
  toBeOkWith,
  toBeErr,
  toBeErrWith,
  toHaveErrorCode,
  toHaveErrorMessage,
};