import { describe, it, expect, afterAll } from 'vitest';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noThrowRule } from '../src/eslint/no-throw.js';

// Configure RuleTester for vitest
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

describe('no-throw rule ultra coverage', () => {
  // This should hit the lines where we find parent function and add type annotations
  it('adds type to arrow function assigned to const', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const myFunc = (a: number, b: string) => {
            if (a < 0) {
              throw new Error('Negative number');
            }
            return a + b.length;
          };`,
          errors: [{ messageId: 'noThrow' }],
          output: `import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
const myFunc = (a: number, b: string): Result<unknown, ZeroError> => {
            if (a < 0) {
              return err(new ZeroError('INVALID_INPUT', "Negative number"));
            }
            return a + b.length;
          };`,
        },
      ],
    });
  });

  // Test finding the arrow token after parameters
  it('handles arrow function with destructured params', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const handler = ({ id, name }: { id: number; name: string }) => {
            throw new Error('Handler error');
          };`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Result<unknown, ZeroError> =>'),
        },
      ],
    });
  });

  // Test async method in class
  it('adds Promise<Result> to async class methods', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            class Service {
              async fetchData(id: string) {
                throw new Error('Fetch failed');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Promise<Result<unknown, ZeroError>>'),
        },
      ],
    });
  });

  // Test finding close paren for function with no params
  it('handles function declaration with no parameters', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `function noParams() {
            throw new Error('No params');
          }`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('(): Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test complex import reconstruction
  it('handles imports with namespace and default imports', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok, ZeroError as ZE } from '@flyingrobots/zerothrow';
            function test() {
              throw new Error('test');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('ZeroError as ZE'),
        },
      ],
    });
  });

  // Test the import deduplication in array
  it('deduplicates imports when adding new ones', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok, ok } from '@flyingrobots/zerothrow'; // duplicate ok
            function test() {
              throw new Error('test');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          // Should deduplicate and add missing imports
          output: expect.stringContaining('@flyingrobots/zerothrow'),
        },
      ],
    });
  });

  // Test finding parent through try-catch-finally
  it('finds function parent through try-catch-finally blocks', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            function complex() {
              try {
                // something
              } catch (e) {
                console.log(e);
              } finally {
                throw new Error('In finally');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test setter methods
  it('handles setter methods that throw', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            class Store {
              set value(val: any) {
                throw new Error('Cannot set value');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err('),
        },
      ],
    });
  });

  // Test function expressions
  it('adds type to function expressions', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            const fn = function namedFunc() {
              throw new Error('Named function expression');
            };
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test when zerothrow import doesn't exist but we need to add multiple things
  it('creates new import with err, ZeroError, and Result when none exist', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `// No imports at all
          function needsAll() {
            throw new Error('Needs all imports');
          }`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('import { err, ZeroError, Result }'),
        },
      ],
    });
  });

  // Test method with existing return type should not get another
  it('preserves existing return types on methods', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { Result, ZeroError } from '@flyingrobots/zerothrow';
            class Api {
              getData(): Result<Data, ZeroError> {
                throw new Error('Not implemented');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.not.stringContaining(': Result<Data, ZeroError>: Result'),
        },
      ],
    });
  });
});