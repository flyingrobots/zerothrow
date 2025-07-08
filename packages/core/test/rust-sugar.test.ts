import { describe, it, expect } from 'vitest';
import { ZT, ZeroThrow } from '../src/index.js';

// Helper to extract plain Result without combinator methods
function toPlainResult<T, E extends Error>(result: ZeroThrow.Result<T, E>): ZeroThrow.Result<T, E> {
  return result.ok
    ? { ok: true, value: result.value }
    : { ok: false, error: result.error };
}

describe('Rust-Style Sugar Methods', () => {
  describe('match()', () => {
    it('handles ok case with pattern matching', () => {
      const result = ZT.ok(42);
      const message = result.match({
        ok: (value) => `Success: ${value}`,
        err: (error) => `Error: ${error.message}`
      });

      expect(message).toBe('Success: 42');
    });

    it('handles err case with pattern matching', () => {
      const error = new ZeroThrow.ZeroError('TEST_ERR', 'Test failed');
      const result = ZT.err(error);
      const message = result.match({
        ok: (value) => `Success: ${value}`,
        err: (error) => `Error: ${error.message}`
      });

      expect(message).toBe('Error: Test failed');
    });

    it('supports different return types from pattern arms', () => {
      const result = ZT.ok('hello');
      const transformed = result.match({
        ok: (value) => value.length,
        err: (_error) => -1
      });

      expect(transformed).toBe(5);
    });

    it('works with complex transformations', () => {
      const parseUser = (input: string): ZeroThrow.Result<{ name: string }, Error> => {
        try {
          const data = JSON.parse(input);
          if (data.name) return ZT.ok({ name: data.name });
          return ZT.err(new Error('Missing name field'));
        } catch {
          return ZT.err(new Error('Invalid JSON'));
        }
      };

      const input = '{"name": "Alice"}';
      const message = parseUser(input).match({
        ok: user => `Welcome, ${user.name}!`,
        err: error => `Invalid user data: ${error.message}`
      });

      expect(message).toBe('Welcome, Alice!');
    });
  });

  describe('isOk() type guard', () => {
    it('narrows type to Ok when true', () => {
      const result: ZeroThrow.Result<number, Error> = ZT.ok(42);
      
      if (result.isOk()) {
        // TypeScript should know result.value exists here
        expect(result.value).toBe(42);
        expect(result.ok).toBe(true);
      } else {
        throw new Error('Should not reach this branch');
      }
    });

    it('returns true for ok results', () => {
      const result = ZT.ok('test');
      expect(result.isOk()).toBe(true);
    });

    it('returns false for err results', () => {
      const result = ZT.err(new Error('test'));
      expect(result.isOk()).toBe(false);
    });
  });

  describe('isErr() type guard', () => {
    it('narrows type to Err when true', () => {
      const result: ZeroThrow.Result<number, Error> = ZT.err(new Error('failed'));
      
      if (result.isErr()) {
        // TypeScript should know result.error exists here
        expect(result.error.message).toBe('failed');
        expect(result.ok).toBe(false);
      } else {
        throw new Error('Should not reach this branch');
      }
    });

    it('returns true for err results', () => {
      const result = ZT.err(new Error('test'));
      expect(result.isErr()).toBe(true);
    });

    it('returns false for ok results', () => {
      const result = ZT.ok('test');
      expect(result.isErr()).toBe(false);
    });

    it('enables proper type narrowing in conditional blocks', () => {
      const result: ZeroThrow.Result<string, Error> = ZT.ok('success');
      
      if (result.isOk()) {
        // This should compile without type errors
        const length = result.value.length;
        expect(length).toBe(7);
      } else {
        // This should also compile without type errors
        const errorMessage = result.error.message;
        throw new Error(`Unexpected error: ${errorMessage}`);
      }
    });
  });

  describe('expect()', () => {
    it('returns value for ok results', () => {
      const result = ZT.ok(42);
      const value = result.expect('This should work');
      expect(value).toBe(42);
    });

    it('throws with custom message for err results', () => {
      const error = new ZeroThrow.ZeroError('DB_ERR', 'Connection failed');
      const result = ZT.err(error);
      
      expect(() => result.expect('Database is required')).toThrow(
        'Database is required: Connection failed'
      );
    });

    it('includes original error message in panic', () => {
      const result = ZT.err(new Error('Original error'));
      
      expect(() => result.expect('Config loading failed')).toThrow(
        'Config loading failed: Original error'
      );
    });

    it('works in critical code paths', () => {
      const loadConfig = (): ZeroThrow.Result<{ apiKey: string }, Error> => {
        return ZT.ok({ apiKey: 'secret-key' });
      };

      // This pattern should feel natural for "this must not fail" scenarios
      const config = loadConfig().expect('Configuration file is required');
      expect(config.apiKey).toBe('secret-key');
    });
  });

  describe('flatten()', () => {
    it('flattens nested ok results', () => {
      const inner = ZT.ok(42);
      const outer = ZT.ok(inner);
      const flattened = outer.flatten();

      expect(toPlainResult(flattened)).toEqual({ ok: true, value: 42 });
    });

    it('propagates outer error', () => {
      const outerError = new ZeroThrow.ZeroError('OUTER_ERR', 'Outer failed');
      const outer: ZeroThrow.Result<ZeroThrow.Result<number, Error>, Error> = ZT.err(outerError);
      const flattened = outer.flatten();

      expect(toPlainResult(flattened)).toEqual({ ok: false, error: outerError });
    });

    it('propagates inner error', () => {
      const innerError = new ZeroThrow.ZeroError('INNER_ERR', 'Inner failed');
      const inner = ZT.err<number>(innerError);
      const outer = ZT.ok(inner);
      const flattened = outer.flatten();

      expect(toPlainResult(flattened)).toEqual({ ok: false, error: innerError });
    });

    it('works with realistic nested operation chains', () => {
      const fetchUser = (id: string): ZeroThrow.Result<{ profile: string }, Error> => {
        if (id === 'valid') return ZT.ok({ profile: '{"name": "Alice"}' });
        return ZT.err(new Error('User not found'));
      };

      const parseProfile = (profileJson: string): ZeroThrow.Result<{ name: string }, Error> => {
        try {
          const profile = JSON.parse(profileJson);
          return ZT.ok(profile);
        } catch {
          return ZT.err(new Error('Invalid profile JSON'));
        }
      };

      // This creates a nested Result<Result<Profile, Error>, Error>
      const nestedResult = fetchUser('valid').map(user => parseProfile(user.profile));
      const userData = nestedResult.flatten();

      expect(userData.ok).toBe(true);
      if (userData.ok) {
        expect(userData.value.name).toBe('Alice');
      }
    });
  });

  describe('zip()', () => {
    it('combines two ok results into tuple', () => {
      const resultA = ZT.ok('hello');
      const resultB = ZT.ok(42);
      const combined = resultA.zip(resultB);

      expect(toPlainResult(combined)).toEqual({
        ok: true,
        value: ['hello', 42]
      });
    });

    it('short-circuits on first error (left)', () => {
      const error = new ZeroThrow.ZeroError('LEFT_ERR', 'Left failed');
      const resultA = ZT.err(error);
      const resultB = ZT.ok(42);
      const combined = resultA.zip(resultB);

      expect(toPlainResult(combined)).toEqual({ ok: false, error });
    });

    it('short-circuits on second error (right)', () => {
      const error = new ZeroThrow.ZeroError('RIGHT_ERR', 'Right failed');
      const resultA = ZT.ok('hello');
      const resultB = ZT.err(error);
      const combined = resultA.zip(resultB);

      expect(toPlainResult(combined)).toEqual({ ok: false, error });
    });

    it('preserves first error when both fail', () => {
      const errorA = new ZeroThrow.ZeroError('ERR_A', 'A failed');
      const errorB = new ZeroThrow.ZeroError('ERR_B', 'B failed');
      const resultA = ZT.err(errorA);
      const resultB = ZT.err(errorB);
      const combined = resultA.zip(resultB);

      expect(toPlainResult(combined)).toEqual({ ok: false, error: errorA });
    });

    it('works with realistic form validation scenario', () => {
      const validateName = (name: string): ZeroThrow.Result<string, Error> => {
        if (name.trim().length === 0) return ZT.err(new Error('Name is required'));
        return ZT.ok(name.trim());
      };

      const validateEmail = (email: string): ZeroThrow.Result<string, Error> => {
        if (!email.includes('@')) return ZT.err(new Error('Invalid email'));
        return ZT.ok(email);
      };

      const nameResult = validateName('Alice');
      const emailResult = validateEmail('alice@example.com');
      const userForm = nameResult.zip(emailResult).map(([name, email]) => ({ name, email }));

      expect(userForm.ok).toBe(true);
      if (userForm.ok) {
        expect(userForm.value).toEqual({ name: 'Alice', email: 'alice@example.com' });
      }
    });
  });

  describe('okValue() method', () => {
    it('returns value for ok results', () => {
      const result = ZT.ok(42);
      expect(result.okValue()).toBe(42);
    });

    it('returns null for err results', () => {
      const result = ZT.err(new Error('failed'));
      expect(result.okValue()).toBe(null);
    });

    it('works with falsy values', () => {
      const result = ZT.ok(0);
      expect(result.okValue()).toBe(0);
    });
  });

  describe('errValue() method', () => {
    it('returns error for err results', () => {
      const error = new Error('test error');
      const result = ZT.err(error);
      expect(result.errValue()).toBe(error);
    });

    it('returns null for ok results', () => {
      const result = ZT.ok(42);
      expect(result.errValue()).toBe(null);
    });
  });

  describe('unwrap()', () => {
    it('returns value for ok results', () => {
      const result = ZT.ok(42);
      expect(result.unwrap()).toBe(42);
    });

    it('throws for err results', () => {
      const error = new Error('test error');
      const result = ZT.err(error);
      expect(() => result.unwrap()).toThrow(error);
    });

    it('is an alias for unwrapOrThrow', () => {
      const result = ZT.ok('test');
      expect(result.unwrap()).toBe(result.unwrapOrThrow());
    });
  });

  describe('contains()', () => {
    it('returns true when ok result contains exact value', () => {
      const result = ZT.ok(42);
      expect(result.contains(42)).toBe(true);
    });

    it('returns false when ok result contains different value', () => {
      const result = ZT.ok(42);
      expect(result.contains(43)).toBe(false);
    });

    it('returns false for err results', () => {
      const result = ZT.err(new Error('failed'));
      expect(result.contains(42)).toBe(false);
    });

    it('works with string values', () => {
      const result = ZT.ok('hello');
      expect(result.contains('hello')).toBe(true);
      expect(result.contains('world')).toBe(false);
    });

    it('uses strict equality', () => {
      const obj = { id: 1 };
      const result = ZT.ok(obj);
      expect(result.contains(obj)).toBe(true);
      expect(result.contains({ id: 1 })).toBe(false); // Different object reference
    });
  });

  describe('containsErr()', () => {
    it('returns true when err result contains exact error', () => {
      const error = new Error('test');
      const result = ZT.err(error);
      expect(result.containsErr(error)).toBe(true);
    });

    it('returns false when err result contains different error', () => {
      const error1 = new Error('test1');
      const error2 = new Error('test2');
      const result = ZT.err(error1);
      expect(result.containsErr(error2)).toBe(false);
    });

    it('returns false for ok results', () => {
      const result = ZT.ok(42);
      const error = new Error('test');
      expect(result.containsErr(error)).toBe(false);
    });

    it('uses strict equality for error comparison', () => {
      const error = new ZeroThrow.ZeroError('TEST_ERR', 'Test error');
      const result = ZT.err(error);
      expect(result.containsErr(error)).toBe(true);
      
      const similarError = new ZeroThrow.ZeroError('TEST_ERR', 'Test error');
      expect(result.containsErr(similarError)).toBe(false); // Different object reference
    });
  });

  describe('Rust ergonomics integration', () => {
    it('all methods feel natural together', () => {
      // Complex example showing how all methods work together
      const parseAndValidateUser = (input: string): ZeroThrow.Result<{ name: string, age: number }, Error> => {
        const parseResult = ZT.try(() => JSON.parse(input));
        
        return parseResult.andThen(data => {
          const nameResult = data.name 
            ? ZT.ok(data.name as string) 
            : ZT.err(new Error('Missing name'));
          
          const ageResult = typeof data.age === 'number' 
            ? ZT.ok(data.age as number)
            : ZT.err(new Error('Invalid age'));

          return nameResult.zip(ageResult).map(([name, age]) => ({ name, age }));
        });
      };

      const userInput = '{"name": "Alice", "age": 30}';
      const result = parseAndValidateUser(userInput);

      // Pattern matching feels natural
      const message = result.match({
        ok: user => `User ${user.name} is ${user.age} years old`,
        err: error => `Validation failed: ${error.message}`
      });

      expect(message).toBe('User Alice is 30 years old');

      // Type guards work seamlessly
      if (result.isOk()) {
        expect(result.value.name).toBe('Alice');
        expect(result.value.age).toBe(30);
      }

      // Contains method works for checking specific values
      if (result.isOk()) {
        expect(result.contains({ name: 'Alice', age: 30 })).toBe(false); // Different object reference
      }
    });

    it('supports chaining Rust-style methods', () => {
      const computation = ZT.ok(5)
        .map(x => x * 2)
        .zip(ZT.ok('hello'))
        .map(([num, str]) => `${str}: ${num}`)
        .match({
          ok: result => result.toUpperCase(),
          err: _error => 'FAILED'
        });

      expect(computation).toBe('HELLO: 10');
    });
  });
});