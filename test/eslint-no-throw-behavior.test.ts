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

describe('no-throw rule behavior', () => {
  it('transforms thrown errors into Result returns', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [
        // Should allow Result returns
        {
          code: `
            import { err, ZeroError } from '@flyingrobots/zerothrow';
            function getUser(id: string) {
              return err(new ZeroError('NOT_FOUND', 'User not found'));
            }
          `,
        },
      ],
      invalid: [
        // Should transform basic throw to Result
        {
          code: `
            function getUser(id: string) {
              throw new Error('User not found');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError } from '@flyingrobots/zerothrow';
function getUser(id: string): Result<unknown, ZeroError> {
              return err(new ZeroError('NOT_FOUND', "User not found"));
            }
          `,
        },
      ],
    });
  });

  it('preserves existing function logic while replacing throws', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            async function processData(data: any) {
              if (!data) {
                throw new Error('Invalid data');
              }
              return data.process();
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
async function processData(data: any): Promise<Result<unknown, ZeroError>> {
              if (!data) {
                return err(new ZeroError('INVALID_INPUT', "Invalid data"));
              }
              return data.process();
            }
          `,
        },
      ],
    });
  });

  it('handles different error patterns and assigns appropriate error codes', () => {
    const testCases = [
      { message: 'User not found', expectedCode: 'NOT_FOUND' },
      { message: 'Invalid input provided', expectedCode: 'INVALID_INPUT' },
      { message: 'Unauthorized access', expectedCode: 'UNAUTHORIZED' },
      { message: 'Rate limit exceeded', expectedCode: 'RATE_LIMIT' },
      { message: 'Something weird happened', expectedCode: 'TODO_ERROR_CODE' },
    ];

    testCases.forEach(({ message, expectedCode }) => {
      ruleTester.run('no-throw', noThrowRule, {
        valid: [],
        invalid: [
          {
            code: `throw new Error('${message}');`,
            errors: [{ messageId: 'noThrow' }],
            output: expect.stringContaining(`new ZeroError('${expectedCode}'`),
          },
        ],
      });
    });
  });

  it('integrates with existing zerothrow imports', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok } from '@flyingrobots/zerothrow';
            function divide(a: number, b: number) {
              if (b === 0) throw new Error('Division by zero');
              return ok(a / b);
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: `
            import { ok, err, ZeroError, Result } from '@flyingrobots/zerothrow';
            function divide(a: number, b: number): Result<unknown, ZeroError> {
              if (b === 0) return err(new ZeroError('INVALID_INPUT', "Division by zero"));
              return ok(a / b);
            }
          `,
        },
      ],
    });
  });

  it('works with arrow functions', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const validate = (input: string) => {
            if (!input) throw new Error('Input required');
            return input;
          };`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Result<unknown, ZeroError> =>'),
        },
      ],
    });
  });

  it('handles class methods', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            class UserService {
              getUser(id: string) {
                throw new Error('Not implemented');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('NOT_IMPLEMENTED'),
        },
      ],
    });
  });

  it('respects configuration to allow throws in test files', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [
        {
          code: `throw new Error('test error');`,
          filename: 'test.spec.ts',
          options: [{ allowInTests: true }],
        },
        {
          code: `throw new Error('test error');`,
          filename: 'foo.test.ts',
          options: [{ allowInTests: true }],
        },
      ],
      invalid: [
        {
          code: `throw new Error('not a test');`,
          filename: 'production.ts',
          options: [{ allowInTests: true }],
          errors: [{ messageId: 'noThrow' }],
        },
      ],
    });
  });

  it('handles re-thrown errors', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            try {
              doSomething();
            } catch (e) {
              throw e;
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err(e)'),
        },
      ],
    });
  });

  it('transforms generic thrown values', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `throw 'string error';`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining("return err('string error')"),
        },
        {
          code: `throw { code: 'CUSTOM', message: 'Custom error' };`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining("return err({ code: 'CUSTOM', message: 'Custom error' })"),
        },
      ],
    });
  });

  it('adds necessary imports when transforming throws', () => {
    // When a file already uses zerothrow but not all needed imports
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { Result } from '@flyingrobots/zerothrow';
            function getUserById(id: string): Result<User, ZeroError> {
              throw new Error('User not found');
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          // Should add missing err and ZeroError imports
          output: expect.stringContaining('err'),
        },
      ],
    });
  });

  it('maintains existing code aliases when adding imports', () => {
    // When code uses aliased imports, the fix should preserve them
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            import { ok as okay } from '@flyingrobots/zerothrow';
            function validate() {
              if (!condition) throw new Error('Invalid');
              return okay(data);
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          // Should preserve the 'okay' alias
          output: expect.stringContaining('okay'),
        },
      ],
    });
  });

  it('adds type annotations to functions that throw', () => {
    // Functions that throw should get Result return type
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            function divide(a: number, b: number) {
              if (b === 0) throw new Error('Division by zero');
              return a / b;
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          // Should add return type annotation
          output: expect.stringContaining('Result<'),
        },
      ],
    });
  });

  it('transforms throws in class methods', () => {
    // Class methods should be transformed like regular functions
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `
            class UserService {
              getUser(id: string) {
                throw new Error('Not implemented');
              }
            }
          `,
          errors: [{ messageId: 'noThrow' }],
          // Should transform to return err()
          output: expect.stringContaining('return err'),
        },
      ],
    });
  });

  it('handles async functions that throw', () => {
    // Async functions should get Promise<Result<...>> type
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const fetchData = async () => {
            throw new Error('Network error');
          };`,
          errors: [{ messageId: 'noThrow' }],
          // Should add Promise<Result<...>> return type
          output: expect.stringContaining('Promise<Result'),
        },
      ],
    });
  });

  it('transforms various throw patterns consistently', () => {
    // Different ways of throwing should all be transformed
    const throwPatterns = [
      {
        code: `throw new Error('message');`,
        description: 'new Error with message',
      },
      {
        code: `const e = new Error('msg'); throw e;`,
        description: 'throw variable',
      },
      {
        code: `throw 'string error';`,
        description: 'throw string literal',
      },
    ];

    throwPatterns.forEach(({ code, description }) => {
      ruleTester.run(`no-throw - ${description}`, noThrowRule, {
        valid: [],
        invalid: [
          {
            code,
            errors: [{ messageId: 'noThrow' }],
            // All should be transformed to return err(...)
            output: expect.stringContaining('return err'),
          },
        ],
      });
    });
  });

  it('respects configuration for test files', () => {
    // Test files can be allowed to throw
    ruleTester.run('no-throw', noThrowRule, {
      valid: [
        {
          code: `describe('test', () => {
            it('should throw', () => {
              throw new Error('test error');
            });
          });`,
          filename: 'user.test.ts',
          options: [{ allowInTests: true }],
        },
      ],
      invalid: [
        {
          code: `function production() {
            throw new Error('not allowed');
          }`,
          filename: 'user.service.ts',
          options: [{ allowInTests: true }],
          errors: [{ messageId: 'noThrow' }],
        },
      ],
    });
  });

  it('allows throws in configured file patterns', () => {
    // Certain files can be excluded from the rule
    ruleTester.run('no-throw', noThrowRule, {
      valid: [
        {
          code: `throw new Error('config error');`,
          filename: 'webpack.config.js',
          options: [{ allowedFiles: ['*.config.js'] }],
        },
      ],
      invalid: [],
    });
  });
});