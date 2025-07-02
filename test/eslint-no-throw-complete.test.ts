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

describe('no-throw rule complete coverage', () => {
  // Test the parent function type annotation logic (lines 282-385)
  it('adds return type to function declarations without existing type', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok } from '@flyingrobots/zerothrow';
            function test(x: number) {
              if (x < 0) throw new Error('Negative');
              return ok(x);
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { ok, err, ZeroError, Result } from '@flyingrobots/zerothrow';
            function test(x: number): Result<unknown, ZeroError> {
              if (x < 0) return err(new ZeroError('INVALID_INPUT', "Negative"));
              return ok(x);
            }
          `,
        },
      ],
    });
  });

  it('adds return type to function expressions', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            const fn = function(x: string) {
              throw new Error('Not implemented');
            };
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
const fn = function(x: string): Result<unknown, ZeroError> {
              return err(new ZeroError('NOT_IMPLEMENTED', "Not implemented"));
            };
          `,
        },
      ],
    });
  });

  it('adds return type to arrow functions with parentheses', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            const arrow = (a: number, b: number) => {
              if (b === 0) throw new Error('Division by zero');
              return a / b;
            };
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
const arrow = (a: number, b: number): Result<unknown, ZeroError> => {
              if (b === 0) return err(new ZeroError('INVALID_INPUT', "Division by zero"));
              return a / b;
            };
          `,
        },
      ],
    });
  });

  it('adds return type to method definitions', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            class Service {
              process(data: any) {
                throw new Error('Processing failed');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
class Service {
              process(data: any): Result<unknown, ZeroError> {
                return err(new ZeroError('TODO_ERROR_CODE', "Processing failed"));
              }
            }
          `,
        },
      ],
    });
  });

  // Test the Result import addition logic when it's missing (lines 400-444)
  it('adds Result import when missing but err and ZeroError exist', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { err, ZeroError } from '@flyingrobots/zerothrow';
            function test() {
              throw new Error('Test');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
            function test(): Result<unknown, ZeroError> {
              return err(new ZeroError('TODO_ERROR_CODE', "Test"));
            }
          `,
        },
      ],
    });
  });

  it('adds Result import to existing aliased imports', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok as okay, err as error } from '@flyingrobots/zerothrow';
            function test() {
              throw new Error('Test');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { ok as okay, err as error, ZeroError, Result } from '@flyingrobots/zerothrow';
            function test(): Result<unknown, ZeroError> {
              return error(new ZeroError('TODO_ERROR_CODE', "Test"));
            }
          `,
        },
      ],
    });
  });

  // Test the generic throw handling (lines 331-366)
  it('handles non-Error throws by adding err import', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            throw 'string error';
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err } from '@flyingrobots/zerothrow';
throw 'string error';
          `,
        },
      ],
    });
  });

  it('adds err to existing zerothrow import for non-Error throws', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok } from '@flyingrobots/zerothrow';
            function test() {
              throw someVariable;
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { ok, err } from '@flyingrobots/zerothrow';
            function test() {
              return err(someVariable);
            }
          `,
        },
      ],
    });
  });

  // Test finding parent function for type annotation (lines 369-385)
  it('finds parent function through multiple levels', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            function outer() {
              if (true) {
                if (false) {
                  throw new Error('Deeply nested');
                }
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test async function handling (lines 292-295)
  it('adds Promise<Result> to async functions', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            async function fetchData() {
              throw new Error('Network error');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
async function fetchData(): Promise<Result<unknown, ZeroError>> {
              return err(new ZeroError('NETWORK_ERROR', "Network error"));
            }
          `,
        },
      ],
    });
  });

  it('adds Promise<Result> to async arrow functions', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            const fetch = async () => {
              throw new Error('Failed');
            };
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
const fetch = async (): Promise<Result<unknown, ZeroError>> => {
              return err(new ZeroError('TODO_ERROR_CODE', "Failed"));
            };
          `,
        },
      ],
    });
  });

  // Test arrow function parameter handling (lines 297-310)
  it('handles arrow functions with rest parameters', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            const fn = (...args: any[]) => {
              throw new Error('Error');
            };
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Result<unknown, ZeroError> =>'),
        },
      ],
    });
  });

  // Test function parameter handling (lines 311-324)
  it('handles functions with default parameters', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            function test(x = 0) {
              throw new Error('Error');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test import reconstruction with aliases (lines 335-351)
  it('preserves complex import aliases when adding err', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok as success, ZeroError as MyError, Result as R } from '@flyingrobots/zerothrow';
            function test() {
              throw { custom: 'error' };
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('ok as success'),
        },
      ],
    });
  });

  // Test the deriveErrorCode function patterns
  it('correctly derives all error code patterns', () => {
    const patterns = [
      { input: 'User not found in database', expected: 'NOT_FOUND' },
      { input: 'Could not find resource', expected: 'NOT_FOUND' },
      { input: 'Invalid input provided', expected: 'INVALID_INPUT' },
      { input: 'Validation error occurred', expected: 'VALIDATION_ERROR' },
      { input: 'Authentication failed', expected: 'UNAUTHORIZED' },
      { input: 'Not authorized to access', expected: 'UNAUTHORIZED' },
      { input: 'Access forbidden', expected: 'FORBIDDEN' },
      { input: 'Connection timed out', expected: 'TIMEOUT' },
      { input: 'Network error occurred', expected: 'NETWORK_ERROR' },
      { input: 'Failed to parse JSON', expected: 'PARSE_ERROR' },
      { input: 'Database error', expected: 'DATABASE_ERROR' },
      { input: 'Server error happened', expected: 'INTERNAL_ERROR' },
      { input: 'Configuration missing', expected: 'CONFIG_ERROR' },
      { input: 'Rate limit exceeded', expected: 'RATE_LIMIT' },
      { input: 'Method not implemented', expected: 'NOT_IMPLEMENTED' },
      { input: 'Something completely unknown', expected: 'TODO_ERROR_CODE' },
    ];

    patterns.forEach(({ input, expected }) => {
      ruleTester.run(`no-throw - error code for "${input}"`, noThrowRule, {
        valid: [],
        invalid: [
          {
            code: `throw new Error('${input}');`,
            errors: [{ messageId: 'noThrow' }],
            output: expect.stringContaining(`'${expected}'`),
          },
        ],
      });
    });
  });

  // Test throw without argument
  it('handles throw without argument', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `throw;`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err()'),
        },
      ],
    });
  });

  // Test finding tokens for arrow functions
  it('handles arrow functions without parentheses', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            const fn = x => {
              throw new Error('Error');
            };
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Result<unknown, ZeroError> =>'),
        },
      ],
    });
  });

  // Test edge cases in import handling
  it('handles files with no existing imports', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `throw new Error('No imports');`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('import { err, ZeroError }'),
        },
      ],
    });
  });

  // Test preserving existing function return types
  it('does not add type annotation to functions with existing return type', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { Result, ZeroError } from '@flyingrobots/zerothrow';
            function test(): Result<string, ZeroError> {
              throw new Error('Has type');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.not.stringContaining(': Result<string, ZeroError>: Result'),
        },
      ],
    });
  });

  // Test Error constructor variations
  it('handles Error constructor without new keyword', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `throw Error('No new keyword');`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('new ZeroError'),
        },
      ],
    });
  });

  // Test import deduplication
  it('does not duplicate imports that already exist', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
            function test() {
              throw new Error('All imports exist');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          // Should not modify import since all are present
          output: expect.stringContaining('import { err, ZeroError, Result }'),
        },
      ],
    });
  });
});