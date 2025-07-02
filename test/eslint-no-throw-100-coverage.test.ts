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

describe('no-throw rule 100% coverage', () => {
  // Test the specific branch where we need to add Result import to a file with no imports
  // This covers lines 282-287 where insertFixIndex >= 0
  it('adds all imports including Result when file has no existing imports and function needs type', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `// Just a comment, no imports
function processData() {
  throw new Error('No imports exist');
}`,
          errors: [{ messageId: 'noThrow' }],
          output: `import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
// Just a comment, no imports
function processData(): Result<unknown, ZeroError> {
  return err(new ZeroError('TODO_ERROR_CODE', "No imports exist"));
}`,
        },
      ],
    });
  });

  // Test finding tokens for arrow functions - covers the token search logic
  it('handles arrow function with multiple parameters and spaces', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const handler = ( a: string , b: number ) => {
  throw new Error('Spaced params');
};`,
          errors: [{ messageId: 'noThrow' }],
          output: `import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
const handler = ( a: string , b: number ): Result<unknown, ZeroError> => {
  return err(new ZeroError('TODO_ERROR_CODE', "Spaced params"));
};`,
        },
      ],
    });
  });

  // Test async function with existing imports but missing Result
  it('adds Result to existing imports for async function', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `import { err, ZeroError } from '@flyingrobots/zerothrow';
async function fetchUser(id: string) {
  throw new Error('User not found');
}`,
          errors: [{ messageId: 'noThrow' }],
          output: `import { err, ZeroError, Result } from '@flyingrobots/zerothrow';
async function fetchUser(id: string): Promise<Result<unknown, ZeroError>> {
  return err(new ZeroError('NOT_FOUND', "User not found"));
}`,
        },
      ],
    });
  });

  // Test method definition with existing return type
  it('does not add return type to method with existing type annotation', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `import { Result, ZeroError, err } from '@flyingrobots/zerothrow';
class Service {
  async process(): Promise<Result<void, ZeroError>> {
    throw new Error('Processing failed');
  }
}`,
          errors: [{ messageId: 'noThrow' }],
          output: `import { Result, ZeroError, err } from '@flyingrobots/zerothrow';
class Service {
  async process(): Promise<Result<void, ZeroError>> {
    return err(new ZeroError('TODO_ERROR_CODE', "Processing failed"));
  }
}`,
        },
      ],
    });
  });

  // Test the branch where we're looking for parent function through deep nesting
  it('finds parent function through deeply nested blocks', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `function outer() {
  if (true) {
    while (true) {
      for (let i = 0; i < 10; i++) {
        switch (i) {
          case 5:
            if (i > 0) {
              try {
                throw new Error('Deep');
              } catch (e) {}
            }
        }
      }
    }
  }
}`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining(': Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test non-Error throws that need err import
  it('adds err import for non-Error throws when no zerothrow import exists', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const customError = { type: 'CUSTOM' };
throw customError;`,
          errors: [{ messageId: 'noThrow' }],
          output: `import { err } from '@flyingrobots/zerothrow';
const customError = { type: 'CUSTOM' };
return err(customError);`,
        },
      ],
    });
  });

  // Test finding the close paren token for functions with comments
  it('handles function with comments in parameters', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `function test(
  a: string, // first param
  b: number  // second param
) {
  throw new Error('Comments in params');
}`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test the array deduplication logic with complex aliases
  it('handles complex import scenarios with duplicates and aliases', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `import { ok as okay, err as error, ok } from '@flyingrobots/zerothrow';
function test() {
  throw new Error('Duplicate imports');
}`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('@flyingrobots/zerothrow'),
        },
      ],
    });
  });

  // Test throw at module level (no parent function)
  it('handles throw at module level without parent function', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `import { ok } from '@flyingrobots/zerothrow';
if (typeof window === 'undefined') {
  throw new Error('Not in browser');
}`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err('),
        },
      ],
    });
  });

  // Test arrow function without braces (expression body)
  it('handles arrow function with expression body', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const fail = () => throw new Error('Expression');`,
          errors: [{ messageId: 'noThrow' }],
          // This is a syntax error but tests the parent finding logic
          output: expect.stringContaining('err'),
        },
      ],
    });
  });

  // Test finding Result in different import positions
  it('finds Result import in various positions', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `import { ZeroError, Result, err } from '@flyingrobots/zerothrow';
function test() {
  throw new Error('Result in middle');
}`,
          errors: [{ messageId: 'noThrow' }],
          // Should not add Result again
          output: expect.not.stringContaining('Result, Result'),
        },
      ],
    });
  });

  // Test the specific case where we update existing imports array
  it('updates import array when adding Result and err to existing import', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `import { ZeroError } from '@flyingrobots/zerothrow';
function validate(input: string) {
  if (!input) {
    throw new Error('Empty input');
  }
  return input;
}`,
          errors: [{ messageId: 'noThrow' }],
          output: `import { ZeroError, err, Result } from '@flyingrobots/zerothrow';
function validate(input: string): Result<unknown, ZeroError> {
  if (!input) {
    return err(new ZeroError('INVALID_INPUT', "Empty input"));
  }
  return input;
}`,
        },
      ],
    });
  });

  // Test all error code derivation patterns
  it('derives all possible error codes from messages', () => {
    const errorMessages = [
      { msg: 'Something went wrong', code: 'TODO_ERROR_CODE' },
      { msg: 'Invalid configuration file', code: 'CONFIG_ERROR' },
      { msg: 'Parse error in JSON', code: 'PARSE_ERROR' },
      { msg: 'Timed out waiting', code: 'TIMEOUT' },
      { msg: 'Network connection failed', code: 'NETWORK_ERROR' },
      { msg: 'Database query failed', code: 'DATABASE_ERROR' },
      { msg: 'Internal server error', code: 'INTERNAL_ERROR' },
      { msg: 'Access is forbidden', code: 'FORBIDDEN' },
      { msg: 'User unauthorized', code: 'UNAUTHORIZED' },
      { msg: 'Invalid user input', code: 'INVALID_INPUT' },
      { msg: 'Validation failed', code: 'VALIDATION_ERROR' },
      { msg: 'Resource not found', code: 'NOT_FOUND' },
      { msg: 'Method not implemented yet', code: 'NOT_IMPLEMENTED' },
      { msg: 'Rate limit hit', code: 'RATE_LIMIT' },
    ];

    errorMessages.forEach(({ msg, code }) => {
      ruleTester.run(`no-throw - ${msg}`, noThrowRule, {
        valid: [],
        invalid: [
          {
            code: `throw new Error('${msg}');`,
            errors: [{ messageId: 'noThrow' }],
            output: expect.stringContaining(`'${code}'`),
          },
        ],
      });
    });
  });

  // Test function expression assigned to variable
  it('adds type annotation to function expressions', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const myFunc = function(x: number) {
  throw new Error('Function expression');
};`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('): Result<unknown, ZeroError>'),
        },
      ],
    });
  });

  // Test getter/setter in object literal
  it('handles getter in object literal', () => {
    ruleTester.run('no-throw', noThrowRule, {
      valid: [],
      invalid: [
        {
          code: `const obj = {
  get value() {
    throw new Error('Getter in object');
  }
};`,
          errors: [{ messageId: 'noThrow' }],
          output: expect.stringContaining('return err('),
        },
      ],
    });
  });
});