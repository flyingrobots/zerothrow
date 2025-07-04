// Type imports from core are used in declarations below
import { 
  toBeOkMatcher,
  toBeOkWithMatcher,
  toBeErrMatcher,
  toBeErrWithMatcher,
  toHaveErrorCodeMatcher,
  toHaveErrorMessageMatcher
} from '@zerothrow/expect';

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

// Jest matcher wrappers
export function toBeOk(this: jest.MatcherContext, received: unknown): jest.CustomMatcherResult {
  return toBeOkMatcher(received, this);
}

export function toBeOkWith<T>(this: jest.MatcherContext, received: unknown, expected: T): jest.CustomMatcherResult {
  return toBeOkWithMatcher(received, expected, this);
}

export function toBeErr(this: jest.MatcherContext, received: unknown): jest.CustomMatcherResult {
  return toBeErrMatcher(received, this);
}

export function toBeErrWith<E extends Error>(
  this: jest.MatcherContext, 
  received: unknown, 
  expected: E | { code?: string; message?: string }
): jest.CustomMatcherResult {
  return toBeErrWithMatcher(received, expected, this);
}

export function toHaveErrorCode(this: jest.MatcherContext, received: unknown, code: string): jest.CustomMatcherResult {
  return toHaveErrorCodeMatcher(received, code);
}

export function toHaveErrorMessage(this: jest.MatcherContext, received: unknown, message: string | RegExp): jest.CustomMatcherResult {
  return toHaveErrorMessageMatcher(received, message);
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

// Export for manual setup
export const jestMatchers = {
  toBeOk,
  toBeOkWith,
  toBeErr,
  toBeErrWith,
  toHaveErrorCode,
  toHaveErrorMessage,
};

// Convenience setup function
export function setup() {
  if (typeof expect !== 'undefined' && typeof expect.extend === 'function') {
    registerMatchers(expect);
  }
}