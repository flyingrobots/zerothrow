# Core Types

ZeroThrow provides a set of core types for robust error handling in TypeScript.

## Result<T, E>

The fundamental type representing either success or failure.

```typescript
type Result<T, E = unknown> = Ok<T> | Err<E>;
```

### Properties

- **Discriminated Union**: Uses `isOk` property for type narrowing
- **Type Safe**: TypeScript automatically narrows types in conditionals
- **Serializable**: Can be safely transmitted over network or stored

### Usage

```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

const result = divide(10, 2);
if (result.isOk) {
  console.log(`Result: ${result.value}`); // TypeScript knows value exists
} else {
  console.error(`Error: ${result.error}`); // TypeScript knows error exists
}
```

## Ok<T>

Represents a successful result containing a value of type T.

```typescript
interface Ok<T> {
  readonly isOk: true;
  readonly isErr: false;
  readonly value: T;
}
```

### Creating Ok Values

```typescript
import { ok } from '@zerothrow/zerothrow';

const success1 = ok(42);
const success2 = ok({ name: 'John', age: 30 });
const success3 = ok([1, 2, 3]);
```

## Err<E>

Represents a failed result containing an error of type E.

```typescript
interface Err<E> {
  readonly isOk: false;
  readonly isErr: true;
  readonly error: E;
}
```

### Creating Err Values

```typescript
import { err } from '@zerothrow/zerothrow';

const error1 = err('Something went wrong');
const error2 = err(new Error('Network failure'));
const error3 = err({ code: 'AUTH_FAILED', message: 'Invalid credentials' });
```

## ZeroError<C>

Enhanced error type with structured information.

```typescript
class ZeroError<C extends ErrorContext = ErrorContext> extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: unknown,
    public readonly context?: C
  );
}
```

### Properties

- **code**: Unique identifier for the error type (string, number, or symbol)
- **message**: Human-readable error description
- **cause**: Original error that caused this error (for error chaining)
- **context**: Additional structured data about the error

### Creating ZeroErrors

```typescript
import { ZeroError, wrap } from '@zerothrow/zerothrow';

// Direct construction
const error = new ZeroError(
  'VALIDATION_ERROR',
  'Invalid email format',
  undefined,
  { field: 'email', value: 'not-an-email' }
);

// Using wrap helper
const wrapped = wrap(
  originalError,
  'DATABASE_ERROR',
  'Failed to save user',
  { userId: 123, operation: 'insert' }
);
```

## ErrorCode

Type for error codes.

```typescript
type ErrorCode = string | number | symbol;
```

### Best Practices

- Use descriptive string constants: `'NETWORK_ERROR'`, `'VALIDATION_FAILED'`
- Consider enums for grouped errors
- Use symbols for internal errors

```typescript
// String codes (recommended)
const ERRORS = {
  NETWORK: 'NETWORK_ERROR',
  AUTH: 'AUTH_FAILED',
  VALIDATION: 'VALIDATION_ERROR'
} as const;

// Enum codes
enum ErrorCodes {
  NetworkError = 1001,
  AuthError = 1002,
  ValidationError = 1003
}

// Symbol codes (for internal use)
const INTERNAL_ERROR = Symbol('INTERNAL_ERROR');
```

## ErrorContext

Type for additional error information.

```typescript
type ErrorContext = {
  [key: string]: unknown;
};
```

### Usage Examples

```typescript
// API error context
const apiError = wrap(error, 'API_ERROR', 'API request failed', {
  endpoint: '/users',
  method: 'POST',
  statusCode: 500,
  timestamp: Date.now()
});

// Validation error context
const validationError = wrap(error, 'VALIDATION_ERROR', 'Validation failed', {
  fields: {
    email: ['Invalid format', 'Domain not allowed'],
    password: ['Too short']
  }
});

// Business logic error context
const businessError = wrap(error, 'INSUFFICIENT_FUNDS', 'Cannot process payment', {
  required: 100.00,
  available: 75.50,
  currency: 'USD',
  accountId: 'acc_123'
});
```

## Type Guards

Built-in type guard functions for runtime type checking.

```typescript
// Check if value is a Result
function isResult<T, E>(value: unknown): value is Result<T, E> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isOk' in value &&
    'isErr' in value &&
    typeof (value as any).isOk === 'boolean' &&
    typeof (value as any).isErr === 'boolean'
  );
}

// Check if error is a ZeroError
function isZeroError(error: unknown): error is ZeroError {
  return error instanceof ZeroError;
}
```

## Generic Constraints

Working with constrained Result types.

```typescript
// Constrain success type
type NumericResult<E = unknown> = Result<number, E>;

// Constrain error type
type SafeResult<T> = Result<T, ZeroError>;

// Both constraints
type ApiResult<T> = Result<T, ZeroError<ApiErrorContext>>;

interface ApiErrorContext extends ErrorContext {
  endpoint: string;
  statusCode: number;
  method: string;
}
```

## Next Steps

- [Learn about core functions](./core-functions.md)
- [Explore combinators](./combinators.md)
- [See practical examples](../examples/)