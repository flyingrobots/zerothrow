/**
 * Test file to validate all code examples compile and work correctly
 */

// Simulate ZeroThrow library for testing
interface Ok<T> {
  readonly isOk: true;
  readonly isErr: false;
  readonly value: T;
}

interface Err<E> {
  readonly isOk: false;
  readonly isErr: true;
  readonly error: E;
}

type Result<T, E = unknown> = Ok<T> | Err<E>;

class ZeroError<C extends Record<string, unknown> = Record<string, unknown>> extends Error {
  constructor(
    public readonly code: string | number | symbol,
    message: string,
    public readonly cause?: unknown,
    public readonly context?: C
  ) {
    super(message);
    this.name = 'ZeroError';
  }
}

const ok = <T>(value: T): Ok<T> => ({ isOk: true, isErr: false, value });
const err = <E>(error: E): Err<E> => ({ isOk: false, isErr: true, error });

const tryR = async <T>(
  fn: () => T | Promise<T>,
  mapError?: (error: unknown) => unknown
): Promise<Result<T>> => {
  try {
    const result = await fn();
    return ok(result);
  } catch (error) {
    return err(mapError ? mapError(error) : error);
  }
};

const wrap = <C extends Record<string, unknown> = Record<string, unknown>>(
  cause: unknown,
  code: string | number | symbol,
  message: string,
  context?: C
): ZeroError<C> => {
  return new ZeroError(code, message, cause, context);
};

const andThen = <T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  return result.isOk ? fn(result.value) : (result as any);
};

const map = <T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  return result.isOk ? ok(fn(result.value)) : (result as any);
};

const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  return result.isErr ? err(fn(result.error)) : (result as any);
};

const orElse = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> => {
  return result.isOk ? (result as any) : fn(result.error);
};

const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  return result.isOk ? result.value : defaultValue;
};

const collect = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (result.isErr) return result;
    values.push(result.value);
  }
  return ok(values);
};

// Test examples from Getting Started tutorial
console.log('Testing Getting Started examples...');

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Cannot divide by zero');
  }
  return ok(a / b);
}

const result1 = divide(10, 2);
console.assert(result1.isOk && result1.value === 5, 'Basic division should work');

const result2 = divide(10, 0);
console.assert(result2.isErr && result2.error === 'Cannot divide by zero', 'Division by zero should error');

// Test validation example
function validateEmail(email: string): Result<string, ZeroError> {
  if (!email) {
    return err(new ZeroError(
      'MISSING_EMAIL',
      'Email is required',
      undefined,
      { field: 'email' }
    ));
  }

  if (!email.includes('@')) {
    return err(new ZeroError(
      'INVALID_EMAIL',
      'Email must contain @',
      undefined,
      { field: 'email', value: email }
    ));
  }

  return ok(email);
}

const emailResult1 = validateEmail('test@example.com');
console.assert(emailResult1.isOk && emailResult1.value === 'test@example.com', 'Valid email should pass');

const emailResult2 = validateEmail('invalid-email');
console.assert(emailResult2.isErr && emailResult2.error.code === 'INVALID_EMAIL', 'Invalid email should fail');

// Test async operations
async function fetchData(shouldFail: boolean): Promise<Result<string, ZeroError>> {
  return tryR(
    async () => {
      if (shouldFail) {
        throw new Error('Network error');
      }
      return 'data';
    },
    (error) => wrap(error, 'FETCH_FAILED', 'Failed to fetch data')
  );
}

async function testAsync() {
  const successResult = await fetchData(false);
  console.assert(successResult.isOk && successResult.value === 'data', 'Async success should work');

  const errorResult = await fetchData(true);
  console.assert(errorResult.isErr && errorResult.error.code === 'FETCH_FAILED', 'Async error should work');
}

// Test chaining operations
function parseNumber(str: string): Result<number, string> {
  const num = Number(str);
  return isNaN(num) ? err('Not a number') : ok(num);
}

function checkPositive(num: number): Result<number, string> {
  return num > 0 ? ok(num) : err('Must be positive');
}

const parseResult = andThen(parseNumber('42'), checkPositive);
console.assert(parseResult.isOk && parseResult.value === 42, 'Chaining should work');

const parseError = andThen(parseNumber('-5'), checkPositive);
console.assert(parseError.isErr && parseError.error === 'Must be positive', 'Chaining error should propagate');

// Test map
const doubled = map(ok(21), (n) => n * 2);
console.assert(doubled.isOk && doubled.value === 42, 'Map should transform values');

const mappedError = map(err('error'), (n: number) => n * 2);
console.assert(mappedError.isErr && mappedError.error === 'error', 'Map should preserve errors');

// Test collect
const allGood = collect([ok(1), ok(2), ok(3)]);
console.assert(allGood.isOk && allGood.value.length === 3, 'Collect should work with all success');

const someErrors = collect([ok(1), err('failed'), ok(3)]);
console.assert(someErrors.isErr && someErrors.error === 'failed', 'Collect should fail on first error');

// Test error recovery
const primaryFail = err('primary failed');
const recovered = orElse(primaryFail, () => ok('fallback'));
console.assert(recovered.isOk && recovered.value === 'fallback', 'Error recovery should work');

// Test unwrapOr
const withDefault = unwrapOr(err('failed'), 'default');
console.assert(withDefault === 'default', 'unwrapOr should provide default');

// Run async tests
testAsync().then(() => {
  console.log('✅ All examples tested successfully!');
}).catch((error) => {
  console.error('❌ Test failed:', error);
});

export {
  ok,
  err,
  tryR,
  wrap,
  andThen,
  map,
  mapErr,
  orElse,
  unwrapOr,
  collect,
  ZeroError,
  Result
};