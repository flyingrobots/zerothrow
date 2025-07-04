import { describe, test, expect } from 'vitest';
import { ZT, ZeroThrow } from '@zerothrow/core';

describe('@zerothrow/jest matchers', () => {
  describe('toBeOk', () => {
    test('passes for Ok results', () => {
      const result = ZT.ok(42);
      expect(result).toBeOk();
    });

    test('fails for Err results', () => {
      const result = ZT.err(new Error('Oops'));
      expect(() => expect(result).toBeOk()).toThrow();
    });

    test('fails for non-Results', () => {
      expect(() => expect('not a result').toBeOk()).toThrow();
    });

    test('negation works', () => {
      const result = ZT.err(new Error('Oops'));
      expect(result).not.toBeOk();
    });
  });

  describe('toBeOkWith', () => {
    test('passes for Ok with matching value', () => {
      const result = ZT.ok({ id: 1, name: 'Alice' });
      expect(result).toBeOkWith({ id: 1, name: 'Alice' });
    });

    test('fails for Ok with different value', () => {
      const result = ZT.ok(42);
      expect(() => expect(result).toBeOkWith(43)).toThrow();
    });

    test('fails for Err results', () => {
      const result = ZT.err(new Error('Oops'));
      expect(() => expect(result).toBeOkWith(42)).toThrow();
    });

    test('works with deep equality', () => {
      const result = ZT.ok({ nested: { value: 42 } });
      expect(result).toBeOkWith({ nested: { value: 42 } });
    });
  });

  describe('toBeErr', () => {
    test('passes for Err results', () => {
      const result = ZT.err(new Error('Oops'));
      expect(result).toBeErr();
    });

    test('fails for Ok results', () => {
      const result = ZT.ok(42);
      expect(() => expect(result).toBeErr()).toThrow();
    });

    test('negation works', () => {
      const result = ZT.ok(42);
      expect(result).not.toBeErr();
    });
  });

  describe('toBeErrWith', () => {
    test('passes for exact error match', () => {
      const error = new Error('Oops');
      const result = ZT.err(error);
      expect(result).toBeErrWith(error);
    });

    test('passes for error with matching properties', () => {
      const result = ZT.err('USER_NOT_FOUND', 'User does not exist');
      expect(result).toBeErrWith({ 
        code: 'USER_NOT_FOUND', 
        message: 'User does not exist' 
      });
    });

    test('passes with partial match', () => {
      const result = ZT.err('USER_NOT_FOUND', 'User does not exist');
      expect(result).toBeErrWith({ code: 'USER_NOT_FOUND' });
      expect(result).toBeErrWith({ message: 'User does not exist' });
    });

    test('fails for non-matching error', () => {
      const result = ZT.err(new Error('Oops'));
      expect(() => expect(result).toBeErrWith(new Error('Different'))).toThrow();
    });

    test('fails for Ok results', () => {
      const result = ZT.ok(42);
      expect(() => expect(result).toBeErrWith(new Error('Oops'))).toThrow();
    });
  });

  describe('toHaveErrorCode', () => {
    test('passes for matching error code', () => {
      const result = ZT.err('USER_NOT_FOUND');
      expect(result).toHaveErrorCode('USER_NOT_FOUND');
    });

    test('works with ZeroError', () => {
      const result = ZT.err(new ZeroThrow.ZeroError('INVALID_INPUT', 'Bad input'));
      expect(result).toHaveErrorCode('INVALID_INPUT');
    });

    test('fails for non-matching code', () => {
      const result = ZT.err('USER_NOT_FOUND');
      expect(() => expect(result).toHaveErrorCode('DIFFERENT_CODE')).toThrow();
    });

    test('fails for Ok results', () => {
      const result = ZT.ok(42);
      expect(() => expect(result).toHaveErrorCode('ANY_CODE')).toThrow();
    });
  });

  describe('toHaveErrorMessage', () => {
    test('passes for exact message match', () => {
      const result = ZT.err(new Error('Something went wrong'));
      expect(result).toHaveErrorMessage('Something went wrong');
    });

    test('passes for regex match', () => {
      const result = ZT.err(new Error('User with ID 123 not found'));
      expect(result).toHaveErrorMessage(/User with ID \d+ not found/);
    });

    test('fails for non-matching message', () => {
      const result = ZT.err(new Error('Something went wrong'));
      expect(() => expect(result).toHaveErrorMessage('Different message')).toThrow();
    });

    test('fails for non-matching regex', () => {
      const result = ZT.err(new Error('Something went wrong'));
      expect(() => expect(result).toHaveErrorMessage(/different pattern/)).toThrow();
    });
  });

  describe('Usage examples', () => {
    test('typical test flow', () => {
      function divide(a: number, b: number): ZeroThrow.Result<number> {
        if (b === 0) {
          return ZT.err('DIV_BY_ZERO', 'Cannot divide by zero');
        }
        return ZT.ok(a / b);
      }

      // Test success case
      expect(divide(10, 2)).toBeOkWith(5);
      
      // Test error case
      expect(divide(10, 0)).toBeErr();
      expect(divide(10, 0)).toHaveErrorCode('DIV_BY_ZERO');
      expect(divide(10, 0)).toHaveErrorMessage('Cannot divide by zero');
      
      // Combined assertions
      const result = divide(10, 0);
      expect(result).toBeErrWith({ 
        code: 'DIV_BY_ZERO',
        message: 'Cannot divide by zero'
      });
    });

    test('async operations', async () => {
      async function fetchUser(id: number): Promise<ZeroThrow.Result<{ id: number; name: string }>> {
        if (id === 0) {
          return ZT.err('INVALID_ID', 'ID must be positive');
        }
        return ZT.ok({ id, name: 'Alice' });
      }

      await expect(fetchUser(1)).resolves.toBeOkWith({ id: 1, name: 'Alice' });
      await expect(fetchUser(0)).resolves.toBeErr();
      await expect(fetchUser(0)).resolves.toHaveErrorCode('INVALID_ID');
    });
  });
});