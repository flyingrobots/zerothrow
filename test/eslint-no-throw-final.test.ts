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

describe('no-throw rule final coverage tests', () => {
  // This test covers lines 282-287: Adding Result import when no zerothrow import exists
  it('adds Result type import when transforming Error throws in file with no imports', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `function test() {
            throw new Error('No imports in file');
          }`,
          errors: [{ messageId: 'noThrow' }],
          output: `import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
function test(): Result<unknown, ZeroError> {
            return err(new ZeroError('TODO_ERROR_CODE', "No imports in file"));
          }`,
        },
      ],
    });
  });

  // More coverage for finding parent function through complex nesting
  it('finds parent function through complex control flow', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            function outer() {
              try {
                if (true) {
                  switch(x) {
                    case 1:
                      for (let i = 0; i < 10; i++) {
                        while (true) {
                          throw new Error('Deeply nested');
                        }
                      }
                  }
                }
              } catch (e) {}
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test for specific token finding in arrow functions
  it('handles arrow function with single parameter without parens', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const fn = x => { throw new Error('Single param'); };`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Result<unknown, ZeroError> =>'),
        },
      ],
    });
  });

  // Test for replacing existing import when adding Result
  it('replaces entire import statement when adding Result to complex aliases', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok as okay, err as error, ZeroError as ZError } from '@flyingrobots/zerothrow';
            function test() {
              throw new Error('Need Result type');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('ok as okay, err as error, ZeroError as ZError, Result'),
        },
      ],
    });
  });

  // Test throw without new Error in function needing type annotation  
  it('adds type annotation when throwing non-Error values', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok } from '@flyingrobots/zerothrow';
            function process() {
              const error = { code: 'CUSTOM', message: 'Custom error' };
              throw error;
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test async arrow function token finding
  it('handles async arrow function with rest parameters', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const fn = async (...args) => {
            throw new Error('Async with rest params');
          };`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Promise<Result<unknown, ZeroError>> =>'),
        },
      ],
    });
  });

  // Test finding close paren token for regular functions
  it('handles function with complex parameter list', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `function test(
            a: string,
            { b, c }: { b: number; c: boolean },
            ...rest: any[]
          ) {
            throw new Error('Complex params');
          }`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test method definition value extraction
  it('handles getter methods that throw', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            class Test {
              get value() {
                throw new Error('Getter error');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err('),
        },
      ],
    });
  });

  // Test finding insertFixIndex in fixes array
  it('handles multiple fixes with Result import insertion', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ZeroError } from '@flyingrobots/zerothrow';
            const arrow = () => {
              throw new Error('Need err and Result');
            };
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('ZeroError, err, Result'),
        },
      ],
    });
  });

  // Test edge case where parent is not a valid function type
  it('handles throw in module scope', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `throw new Error('Module level throw');`,
          errors: [{ messageId: 'noThrow' }],
          // Should not add return type since not in a function
          output: expect.not.stringContaining(': Result'),
        },
      ],
    });
  });

  // Test array manipulation for import fixes
  it('updates imports array correctly when Result already exists', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { err, Result } from '@flyingrobots/zerothrow';
            function test() {
              throw new Error('Already has Result');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          // Should add ZeroError but not duplicate Result
          output: expect.stringContaining('err, Result, ZeroError'),
        },
      ],
    });
  });
});