import type { Result } from '@zerothrow/core';

// Core matcher logic - framework agnostic
export function isResult(value: unknown): value is Result<unknown, Error> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'ok' in value &&
    typeof (value as { ok: unknown }).ok === 'boolean' &&
    ((value as { ok: boolean }).ok === true ? 'value' in value : 'error' in value)
  );
}

export function formatError(error: unknown): string {
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

// Matcher result type used by both Jest and Vitest
export interface MatcherResult {
  pass: boolean;
  message: () => string;
}

// Matcher context interface (common between Jest and Vitest)
export interface MatcherContext {
  equals(a: unknown, b: unknown): boolean;
}

// Core matcher implementations
export function toBeOkMatcher(
  received: unknown,
  _context?: MatcherContext
): MatcherResult {
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

export function toBeOkWithMatcher<T>(
  received: unknown,
  expected: T,
  context: MatcherContext
): MatcherResult {
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
  const pass = context.equals(actual, expected);
  
  return {
    message: () => pass
      ? `expected Result not to be Ok with value ${JSON.stringify(expected)}`
      : `expected Result to be Ok with value ${JSON.stringify(expected)}, but was Ok with value ${JSON.stringify(actual)}`,
    pass,
  };
}

export function toBeErrMatcher(
  received: unknown,
  _context?: MatcherContext
): MatcherResult {
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

export function toBeErrWithMatcher<E extends Error>(
  received: unknown,
  expected: E | { code?: string; message?: string },
  context: MatcherContext
): MatcherResult {
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
    pass = context.equals(actualError, expected);
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

export function toHaveErrorCodeMatcher(
  received: unknown,
  code: string
): MatcherResult {
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

export function toHaveErrorMessageMatcher(
  received: unknown,
  message: string | RegExp
): MatcherResult {
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