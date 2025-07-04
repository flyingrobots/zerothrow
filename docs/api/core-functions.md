# Core Functions

Essential functions for creating and working with Result types.

## ok

Creates a successful Result containing a value.

### Signature

```typescript
function ok<T>(value: T): Ok<T>
```

### Parameters

- `value: T` - The success value to wrap

### Returns

An `Ok<T>` result containing the value

### Examples

```typescript
import { ok } from '@zerothrow/zerothrow';

// Simple values
const num = ok(42);
const str = ok('hello');
const bool = ok(true);

// Complex values
const user = ok({ id: 1, name: 'Alice' });
const items = ok([1, 2, 3, 4, 5]);

// Void results
const done = ok(undefined);
```

### Usage in Functions

```typescript
function parseNumber(str: string): Result<number, string> {
  const num = Number(str);
  if (isNaN(num)) {
    return err(`Cannot parse "${str}" as number`);
  }
  return ok(num);
}
```

## err

Creates a failed Result containing an error.

### Signature

```typescript
function err<E>(error: E): Err<E>
```

### Parameters

- `error: E` - The error value to wrap

### Returns

An `Err<E>` result containing the error

### Examples

```typescript
import { err } from '@zerothrow/zerothrow';

// String errors
const error1 = err('Something went wrong');

// Error objects
const error2 = err(new Error('Network failure'));

// Custom error types
const error3 = err({
  code: 'VALIDATION_ERROR',
  field: 'email',
  message: 'Invalid email format'
});

// ZeroError
const error4 = err(new ZeroError('AUTH_FAILED', 'Invalid credentials'));
```

## tryR

Converts a potentially throwing function into a Result.

### Signature

```typescript
function tryR<T>(
  fn: () => T | Promise<T>,
  mapError?: (error: unknown) => unknown
): Promise<Result<T>>
```

### Parameters

- `fn` - Function to execute (sync or async)
- `mapError` - Optional function to transform caught errors

### Returns

A Promise resolving to a Result

### Examples

```typescript
import { tryR } from '@zerothrow/zerothrow';

// Async operations
const result = await tryR(async () => {
  const response = await fetch('/api/users');
  return response.json();
});

// With error mapping
const result = await tryR(
  async () => {
    const data = await riskyOperation();
    return data;
  },
  (error) => new ZeroError('OPERATION_FAILED', 'Risky operation failed', error)
);

// Sync operations (still returns Promise)
const result = await tryR(() => {
  return JSON.parse(jsonString);
});

// Complex example
async function fetchUser(id: string): Promise<Result<User, ZeroError>> {
  return tryR(
    async () => {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json() as Promise<User>;
    },
    (error) => wrap(error, 'FETCH_USER_FAILED', `Failed to fetch user ${id}`, {
      userId: id,
      timestamp: Date.now()
    })
  );
}
```

## wrap

Creates a ZeroError with enhanced error information.

### Signature

```typescript
function wrap<C extends ErrorContext = ErrorContext>(
  cause: unknown,
  code: ErrorCode,
  message: string,
  context?: C
): ZeroError<C>
```

### Parameters

- `cause` - The original error or cause
- `code` - Error code identifier
- `message` - Human-readable error message
- `context` - Optional additional context

### Returns

A new `ZeroError` instance

### Examples

```typescript
import { wrap } from '@zerothrow/zerothrow';

// Basic wrapping
try {
  dangerousOperation();
} catch (error) {
  throw wrap(error, 'OPERATION_FAILED', 'The operation could not complete');
}

// With context
const error = wrap(
  originalError,
  'DATABASE_ERROR',
  'Failed to save user',
  {
    operation: 'insert',
    table: 'users',
    userId: 123
  }
);

// Chaining errors
function processUser(data: unknown): Result<User, ZeroError> {
  const parsed = parseUser(data);
  if (parsed.isErr) {
    return err(wrap(
      parsed.error,
      'PROCESS_USER_FAILED',
      'Could not process user data',
      { input: data }
    ));
  }
  return ok(parsed.value);
}

// Error enhancement pattern
async function enhancedFetch(url: string): Promise<Result<any, ZeroError>> {
  const startTime = Date.now();
  
  const result = await tryR(
    () => fetch(url).then(r => r.json()),
    (error) => wrap(error, 'FETCH_ERROR', `Failed to fetch ${url}`, {
      url,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    })
  );
  
  return result;
}
```

## Error Helpers

### isZeroError

Type guard for ZeroError instances.

```typescript
function isZeroError(value: unknown): value is ZeroError {
  return value instanceof ZeroError;
}

// Usage
if (isZeroError(error)) {
  console.log('Error code:', error.code);
  console.log('Context:', error.context);
}
```

### normalizeError

Converts unknown errors to a consistent format.

```typescript
function normalizeError(error: unknown): Error | ZeroError {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error(String(error));
}
```

## Patterns and Best Practices

### Early Returns

```typescript
function processData(input: string): Result<ProcessedData, ZeroError> {
  const validation = validateInput(input);
  if (validation.isErr) {
    return validation;
  }

  const parsed = parseData(validation.value);
  if (parsed.isErr) {
    return err(wrap(parsed.error, 'PARSE_FAILED', 'Could not parse data'));
  }

  const transformed = transformData(parsed.value);
  if (transformed.isErr) {
    return err(wrap(transformed.error, 'TRANSFORM_FAILED', 'Could not transform data'));
  }

  return ok(transformed.value);
}
```

### Result Chaining

```typescript
async function createUser(data: UserInput): Promise<Result<User, ZeroError>> {
  return tryR(async () => {
    // Validate
    const validation = await validateUserInput(data);
    if (validation.isErr) throw validation.error;

    // Check uniqueness
    const exists = await checkUserExists(data.email);
    if (exists.isErr) throw exists.error;
    if (exists.value) throw new ZeroError('USER_EXISTS', 'Email already registered');

    // Create user
    const user = await db.createUser(validation.value);
    return user;
  }, (error) => {
    if (isZeroError(error)) return error;
    return wrap(error, 'CREATE_USER_FAILED', 'Failed to create user', { input: data });
  });
}
```

### Error Context Patterns

```typescript
// Layered context
function apiCall(endpoint: string): Result<Data, ZeroError> {
  const baseContext = { endpoint, timestamp: Date.now() };
  
  try {
    const data = performCall(endpoint);
    return ok(data);
  } catch (error) {
    return err(wrap(error, 'API_CALL_FAILED', 'API call failed', {
      ...baseContext,
      errorType: error.constructor.name,
      stack: error instanceof Error ? error.stack : undefined
    }));
  }
}

// Progressive enhancement
function enhanceError(error: unknown, operation: string): ZeroError {
  if (isZeroError(error)) {
    return wrap(error, error.code, error.message, {
      ...error.context,
      operation,
      enhancedAt: Date.now()
    });
  }
  return wrap(error, 'ENHANCED_ERROR', `Error in ${operation}`, { operation });
}
```

## Next Steps

- [Master combinators](./combinators.md)
- [Learn React integration](./react.md)
- [See real-world examples](../examples/)