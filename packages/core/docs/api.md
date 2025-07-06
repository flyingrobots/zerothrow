# @zerothrow/core API Reference

This document contains the complete API reference for @zerothrow/core.

## Table of Contents

- [Result Type](#result-type)
- [ZT Namespace](#zt-namespace)
- [Result Methods](#result-methods)
- [ZeroThrow Namespace](#zerothrow-namespace)
- [ZeroError Class](#zeroerror-class)
- [Type Guards](#type-guards)
- [Advanced Patterns](#advanced-patterns)

## Result Type

The core type that represents either success (`Ok`) or failure (`Err`):

```typescript
type Result<T, E = Error> = Ok<T> | Err<E>

interface Ok<T> {
  ok: true
  value: T
  // ... combinator methods
}

interface Err<E> {
  ok: false
  error: E
  // ... combinator methods
}
```

## ZT Namespace

Your primary interface for creating and handling Results.

### Creating Results

```typescript
import { ZT } from '@zerothrow/core';

// Wrap throwing functions
ZT.try(() => risky())              // Result<T, ZeroError>
ZT.tryAsync(async () => fetch())   // Promise<Result<T, ZeroError>>

// Create Results directly
ZT.ok(value)                       // Result<T, never>
ZT.err(error)                      // Result<never, Error>
ZT.err('CODE')                     // Result<never, ZeroError>
ZT.err('CODE', 'message')          // Result<never, ZeroError>
```

## Result Methods

All Results come with built-in combinator methods:

### Transformation Methods

```typescript
interface Result<T, E> {
  // Transform success value
  map<U>(fn: (value: T) => U): Result<U, E>
  
  // Transform error
  mapErr<F>(fn: (error: E) => F): Result<T, F>
  
  // Chain operations (flatMap)
  andThen<U, F>(fn: (value: T) => Result<U, F>): Result<U, E | F>
  
  // Provide fallback Result
  orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>
}
```

### Side Effect Methods

```typescript
interface Result<T, E> {
  // Side effects for success
  tap(fn: (value: T) => void): Result<T, E>
  
  // Side effects for errors
  tapErr(fn: (error: E) => void): Result<T, E>
  
  // Side effects for any result
  finally(fn: (result: Result<T, E>) => void): Result<T, E>
  
  // Discard value
  void(): Result<void, E>
}
```

### Extraction Methods

```typescript
interface Result<T, E> {
  // Extract with default
  unwrapOr(defaultValue: T): T
  
  // Extract value (throws if error)
  unwrapOrThrow(): T
}
```

## ZeroThrow Namespace

Advanced utilities and combinators.

### Batch Operations

```typescript
import { ZeroThrow } from '@zerothrow/core';

// Collect multiple Results (fail fast)
const results = ZeroThrow.collect([
  validateName('John'),
  validateEmail('john@example.com'),
  validateAge(30)
]); // Result<[string, string, number], Error>

// Async version
const asyncResults = await ZeroThrow.collectAsync([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
]); // Result<User[], Error>
```

### Alternative Operations

```typescript
// Try alternatives until one succeeds
const config = ZeroThrow.firstSuccess([
  () => loadFromEnv(),
  () => loadFromFile(), 
  () => useDefaults()
]); // Result<Config, Error>
```

### Function Composition

```typescript
// Pipe operations together
const pipeline = ZeroThrow.pipe(
  parseInput,
  validate,
  transform,
  save
);

const result = pipeline(rawInput); // Result<SavedData, Error>
```

### Promise Enhancement

```typescript
// Wrap existing promises
const enhanced = ZeroThrow.enhance(fetch('/api/data'));
// Promise<Result<Response, Error>>

// Convert async functions
const safeReadFile = ZeroThrow.fromAsync(fs.readFile);
// (...args) => Promise<Result<Buffer, Error>>
```

### Type-Safe Wrappers

```typescript
// Wrap a function to return Results
const safeParse = ZeroThrow.wrap(JSON.parse);
// (text: string) => Result<any, Error>

// Multiple signatures supported
const divide = ZeroThrow.attempt((a: number, b: number) => {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}); // (a: number, b: number) => Result<number, Error>
```

## ZeroError Class

Enhanced error with code and context:

```typescript
import { ZeroError } from '@zerothrow/core';

// Basic usage
const error = new ZeroError('VALIDATION_ERROR', 'Invalid input');

// With context
const error = new ZeroError('API_ERROR', 'Request failed', {
  context: {
    endpoint: '/api/users',
    status: 404,
    userId: 123
  }
});

// Error properties
error.code      // 'API_ERROR'
error.message   // 'Request failed'
error.context   // { endpoint: '/api/users', ... }
```

## Type Guards

Runtime type checking utilities:

```typescript
import { isResult, isOk, isErr } from '@zerothrow/core';

// Check if value is a Result
if (isResult(value)) {
  // value is Result<unknown, Error>
}

// Check if Result is Ok
if (isOk(result)) {
  // result.value is accessible
}

// Check if Result is Err
if (isErr(result)) {
  // result.error is accessible
}
```

## Advanced Patterns

### Custom Error Types

```typescript
class ValidationError extends ZeroError {
  constructor(field: string, message: string) {
    super('VALIDATION_ERROR', message, { field });
  }
}

class ApiError extends ZeroError {
  constructor(
    public status: number,
    message: string,
    public endpoint: string
  ) {
    super(`HTTP_${status}`, message, { endpoint, status });
  }
}
```

### Result-First Functions

```typescript
// Always return Results from your functions
function parseUser(input: unknown): Result<User, ValidationError> {
  if (!input || typeof input !== 'object') {
    return ZT.err(new ValidationError('input', 'Expected object'));
  }
  
  const data = input as Record<string, unknown>;
  
  if (!data.email || typeof data.email !== 'string') {
    return ZT.err(new ValidationError('email', 'Email required'));
  }
  
  return ZT.ok({
    id: data.id as string,
    email: data.email.toLowerCase(),
    name: (data.name as string) || 'Anonymous'
  });
}
```

### Async Composition

```typescript
async function processUser(id: string): Promise<Result<ProcessedUser, Error>> {
  return ZT.tryAsync(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(result => result
    .andThen(data => validateUser(data))
    .andThen(user => enrichUserData(user))
    .tap(user => console.log('Processed:', user))
  );
}
```

### Railway-Oriented Programming

```typescript
const processOrder = (orderId: string) =>
  fetchOrder(orderId)
    .andThen(validateOrder)
    .andThen(calculateTotals)
    .andThen(applyDiscounts)
    .andThen(chargePayment)
    .andThen(sendConfirmation)
    .tapErr(error => logError(error))
    .mapErr(error => new OrderError(error));
```