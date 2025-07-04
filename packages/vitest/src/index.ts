// Type imports from core are used in declarations below
import { 
  toBeOkMatcher,
  toBeOkWithMatcher,
  toBeErrMatcher,
  toBeErrWithMatcher,
  toHaveErrorCodeMatcher,
  toHaveErrorMessageMatcher,
  type MatcherContext
} from '@zerothrow/core/matchers';
import { expect } from 'vitest';

// Extend Vitest's expect types
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

// Vitest context adapter
function createVitestContext(utils: any): MatcherContext {
  return {
    equals: utils?.equals || ((a: unknown, b: unknown) => a === b)
  };
}

// Vitest matcher wrappers
export function toBeOk(this: any, received: unknown) {
  const result = toBeOkMatcher(received, createVitestContext(this.utils));
  return {
    pass: result.pass,
    message: result.message,
  };
}

export function toBeOkWith<T>(this: any, received: unknown, expected: T) {
  const result = toBeOkWithMatcher(received, expected, createVitestContext(this.utils));
  return {
    pass: result.pass,
    message: result.message,
  };
}

export function toBeErr(this: any, received: unknown) {
  const result = toBeErrMatcher(received, createVitestContext(this.utils));
  return {
    pass: result.pass,
    message: result.message,
  };
}

export function toBeErrWith<E extends Error>(
  this: any,
  received: unknown, 
  expected: E | { code?: string; message?: string }
) {
  const result = toBeErrWithMatcher(received, expected, createVitestContext(this.utils));
  return {
    pass: result.pass,
    message: result.message,
  };
}

export function toHaveErrorCode(this: any, received: unknown, code: string) {
  const result = toHaveErrorCodeMatcher(received, code);
  return {
    pass: result.pass,
    message: result.message,
  };
}

export function toHaveErrorMessage(this: any, received: unknown, message: string | RegExp) {
  const result = toHaveErrorMessageMatcher(received, message);
  return {
    pass: result.pass,
    message: result.message,
  };
}

// Export for manual setup
export const vitestMatchers = {
  toBeOk,
  toBeOkWith,
  toBeErr,
  toBeErrWith,
  toHaveErrorCode,
  toHaveErrorMessage,
};

// Setup function
export function setup() {
  expect.extend(vitestMatchers);
}

// Auto-setup when imported
if (typeof expect !== 'undefined' && typeof expect.extend === 'function') {
  setup();
}