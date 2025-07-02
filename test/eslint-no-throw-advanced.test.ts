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

describe('no-throw rule advanced behavior', () => {
  it('adds Result type annotation to functions without return types', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok } from '@flyingrobots/zerothrow';
            function processPayment(amount: number) {
              if (amount <= 0) {
                throw new Error('Invalid amount');
              }
              return ok({ processed: true });
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { ok, err, ZeroError, Result } from '@flyingrobots/zerothrow';
            function processPayment(amount: number): Result<unknown, ZeroError> {
              if (amount <= 0) {
                return err(new ZeroError('INVALID_INPUT', "Invalid amount"));
              }
              return ok({ processed: true });
            }
          `,
        },
      ],
    });
  });

  it('adds Promise<Result> to async functions without return types', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            async function fetchUser(id: string) {
              throw new Error('User not found');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
async function fetchUser(id: string): Promise<Result<unknown, ZeroError>> {
              return err(new ZeroError('NOT_FOUND', "User not found"));
            }
          `,
        },
      ],
    });
  });

  it('handles complex import scenarios with aliased imports', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok as success, ZeroError as CustomError } from '@flyingrobots/zerothrow';
            function validate() {
              throw new Error('Validation failed');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { ok as success, ZeroError as CustomError, err, Result } from '@flyingrobots/zerothrow';
            function validate(): Result<unknown, CustomError> {
              return err(new CustomError('VALIDATION_FAILED', "Validation failed"));
            }
          `,
        },
      ],
    });
  });

  it('handles arrow functions with implicit returns', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const check = (value: string) => {
            if (!value) throw new Error('Empty value');
            return value.toUpperCase();
          };`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringMatching(/: Result<unknown, ZeroError> =>/),
        },
      ],
    });
  });

  it('handles nested functions and closures', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            function outer() {
              const inner = function() {
                throw new Error('Inner error');
              };
              return inner();
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err('),
        },
      ],
    });
  });

  it('preserves existing return type annotations', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { Result, ZeroError } from '@flyingrobots/zerothrow';
            function getConfig(): Result<Config, ZeroError> {
              throw new Error('Config not found');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          // Should NOT add another return type annotation
          output: expect.not.stringContaining(': Result<Config, ZeroError>: Result'),
        },
      ],
    });
  });

  it('handles throw statements in try-catch blocks', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            function processFile(path: string) {
              try {
                // some operation
              } catch (e) {
                throw new Error('Failed to process file');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err('),
        },
      ],
    });
  });

  it('handles method definitions in classes', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            class UserRepository {
              async findById(id: string) {
                throw new Error('Database connection failed');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Promise<Result<unknown, ZeroError>>'),
        },
      ],
    });
  });

  it('transforms different error instantiation patterns', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `throw Error('Direct Error call');`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err(new ZeroError'),
        },
        {
          code: `throw new TypeError('Type error');`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err(new ZeroError'),
        },
        {
          code: `throw new RangeError('Out of range');`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err(new ZeroError'),
        },
      ],
    });
  });

  it('handles functions with destructured parameters', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            function process({ id, name }: User) {
              if (!id) throw new Error('Missing ID');
              return { id, name };
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  it('handles arrow functions with no parameters', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const getData = () => {
            throw new Error('Not implemented');
          };`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('(): Result<unknown, ZeroError> =>'),
        },
      ],
    });
  });

  it('correctly identifies error patterns for common scenarios', () => {
    const errorPatterns = [
      { message: 'Connection timeout', expectedCode: 'TIMEOUT' },
      { message: 'Request timed out', expectedCode: 'TIMEOUT' },
      { message: 'Permission denied', expectedCode: 'PERMISSION_DENIED' },
      { message: 'Access forbidden', expectedCode: 'FORBIDDEN' },
      { message: 'Invalid JSON', expectedCode: 'INVALID_INPUT' },
      { message: 'Failed to parse', expectedCode: 'PARSE_ERROR' },
    ];

    errorPatterns.forEach(({ message, expectedCode }) => {
      ruleTester.run(`no-throw - ${message}`, noThrowRule, {
        valid: [],
        invalid: [
          {
            code: `throw new Error('${message}');`,
            errors: [{ messageId: 'noThrow' }],
            output: expect.stringContaining(`'${expectedCode}'`),
          },
        ],
      });
    });
  });
});