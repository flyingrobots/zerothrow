# @zerothrow/core

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `orElse`)  
> • **ZeroThrow** – utilities (`collect`, `firstSuccess`, `pipe`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

![npm](https://img.shields.io/npm/v/@zerothrow/core)
![types](https://img.shields.io/npm/types/@zerothrow/core)
![size](https://packagephobia.com/badge?p=@zerothrow/core)
[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

Core ZeroThrow functionality - Rust-style `Result<T, E>` for TypeScript. Type-safe error handling with zero runtime dependencies (ZeroThrow itself has none).

<p align="center">
  <img alt="ZeroThrow Core mascot" height="300" src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-core.webp"/>
</p>

<!-- toc -->
## Table of Contents

- [Installation](#installation)
- [Why Results, not Throws?](#why-results-not-throws)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Performance](#performance)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Full Documentation](#full-documentation)

<!-- tocstop -->

## Installation

```bash
npm install @zerothrow/core
# or: pnpm add @zerothrow/core
```

### 🎯 Recommended: Complete Zero-Throw Experience

For production applications, we strongly recommend installing these companion packages:

```bash
# Add resilience patterns (retry, circuit breaker, timeout)
npm install @zerothrow/resilience

# Add test matchers for your test framework
npm install --save-dev @zerothrow/jest    # For Jest
npm install --save-dev @zerothrow/vitest  # For Vitest
```

**Note:** The packages marked `--save-dev` assume `@zerothrow/core` is already installed.

**Why these packages?**

- **[@zerothrow/resilience](https://www.npmjs.com/package/@zerothrow/resilience)** - Production-grade error handling with retry policies, circuit breakers, and timeouts. Essential for robust applications.
- **[@zerothrow/jest](https://www.npmjs.com/package/@zerothrow/jest) or [@zerothrow/vitest](https://www.npmjs.com/package/@zerothrow/vitest)** - Test your Result-based code elegantly without throwing in tests. Makes assertions cleaner and more intuitive.

## Why Results, not Throws?

Exceptions break the flow of your program and hide error paths. Results make errors explicit:

```typescript
// ❌ Throws: Hidden error paths, unclear what can fail
function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

// ✅ Results: Explicit error handling, clear contract
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return ZT.err('DIV_BY_ZERO', 'Cannot divide by zero');
  return ZT.ok(a / b);
}
```

**Performance:** Returning objects is ~93× faster than throwing/catching on error paths. Creating Results on the happy path is allocation-free in modern JS engines.

## Quick Start

```typescript
import { ZT } from '@zerothrow/core';

// Wrap any function that might throw
const result = ZT.try(() => JSON.parse(userInput));

// Handle both success and failure cases
if (result.ok) {
  console.log('Parsed:', result.value);
} else {
  console.log('Error:', result.error.message);
}

// Or use functional combinators
result
  .map(data => data.userId)
  .andThen(id => fetchUser(id))
  .tap(id => console.log('Processing user:', id))
  .unwrapOr(null);
```

## API Reference

For the complete API documentation, see [Full API Reference →](./docs/api.md)

### Quick Reference

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



## Performance

Results are optimized for real-world use:

- **Creation**: ~80 ns to wrap a value in a Result on Node 20 (see benchmarks in `/bench`)
- **Error paths**: ~93× faster than throw/catch
- **Zero allocations**: Combinators reuse Result objects where possible
- **Monomorphic**: JIT-friendly single Result shape

Run benchmarks yourself: `npm run bench` in the project root.

## Best Practices

### 1. No More Try/Catch

ZeroThrow eliminates the need for try/catch blocks in your application code:

```typescript
// ❌ Traditional approach
try {
  const data = JSON.parse(input);
  const user = await fetchUser(data.userId);
  return user;
} catch (error) {
  console.error('Operation failed:', error);
  return null;
}

// ✅ ZeroThrow approach
ZT.try(() => JSON.parse(input))
  .andThen(data => fetchUser(data.userId))
  .tapErr(error => console.error('Operation failed:', error))
  .unwrapOr(null);
```

### 2. ZT.try is for Third-Party Code

Only use `ZT.try()` when wrapping code that might throw (usually third-party libraries):

```typescript
// ✅ Good - wrapping throwing functions
const parsed = ZT.try(() => JSON.parse(input));
const file = await ZT.tryAsync(async () => fs.promises.readFile(path));

// ❌ Bad - your functions should return Results
function calculateTotal(items) {
  return ZT.try(() => {
    // Your logic here
    return items.reduce((sum, item) => sum + item.price, 0);
  });
}

// ✅ Good - return Results directly
function calculateTotal(items): Result<number, ZeroError> {
  if (items.length === 0) {
    return ZT.err('EMPTY_CART', 'Cannot calculate total for empty cart');
  }
  return ZT.ok(items.reduce((sum, item) => sum + item.price, 0));
}
```

### 3. Leverage Combinators

Chain operations without nested if statements:

```typescript
// ❌ Imperative style
const userResult = await fetchUser(id);
if (!userResult.ok) {
  return userResult;
}

const validationResult = validateUser(userResult.value);
if (!validationResult.ok) {
  return validationResult;
}

return ZT.ok(validationResult.value);

// ✅ Functional style
return fetchUser(id)
  .andThen(user => validateUser(user));
```

### 4. Type-Safe Error Handling

Use ZeroError for rich, type-safe errors:

```typescript
import { ZT, ZeroError, type Result } from '@zerothrow/core';

// Define your error codes
type AppErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED';

// Create typed errors with context
function createError<T extends Record<string, unknown>>(
  code: AppErrorCode, 
  message: string,
  context?: T
) {
  return new ZeroError(code, message, { context });
}

// Use in your functions
function findUser(id: string): Result<User, ZeroError> {
  const user = db.users.get(id);
  if (!user) {
    return ZT.err(createError(
      'NOT_FOUND', 
      `User ${id} not found`,
      { userId: id, timestamp: Date.now() }
    ));
  }
  return ZT.ok(user);
}
```

### 5. Async Operations

Use `tryAsync` for cleaner async error handling:

```typescript
// ✅ Clear async intent
const result = await ZT.tryAsync(async () => {
  const response = await fetch('/api/users');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
});

// Chain async operations
const userData = await ZT.tryAsync(() => fetch('/api/user'))
  .then(r => r.andThen(res => ZT.tryAsync(() => res.json())))
  .then(r => r.map(data => data.profile));
```

## Common Patterns

### Validation

```typescript
import { ZT, ZeroThrow, type Result, ZeroError } from '@zerothrow/core';

function validateEmail(email: string): Result<string, ZeroError> {
  if (!email.includes('@')) {
    return ZT.err('INVALID_EMAIL', 'Email must contain @');
  }
  return ZT.ok(email.toLowerCase());
}

function validateAge(age: number): Result<number, ZeroError> {
  if (age < 0 || age > 150) {
    return ZT.err('INVALID_AGE', 'Age must be between 0 and 150');
  }
  return ZT.ok(age);
}

// Combine validations (use type assertion for mixed types)
const validatedData = ZeroThrow.collect([
  validateEmail(input.email),
  validateAge(input.age)
] as const);

// Validation with error accumulation
function validateUser(data: unknown): Result<ValidUser, ZeroError> {
  const errors: string[] = [];
  
  if (!data.name) errors.push('Name is required');
  if (!data.email?.includes('@')) errors.push('Invalid email');
  if (data.age < 18) errors.push('Must be 18 or older');
  
  if (errors.length > 0) {
    return ZT.err(
      'VALIDATION_FAILED', 
      errors.join(', ')
    );
  }
  
  return ZT.ok(data as ValidUser);
}
```

### API Calls

```typescript
async function apiCall<T>(endpoint: string): Promise<Result<T, Error>> {
  return ZT.tryAsync(async () => {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json() as T;
  });
}

// Use it
const users = await apiCall<User[]>('/api/users')
  .then(r => r.map(users => users.filter(u => u.active)));
```

### Configuration Loading

```typescript
import { ZT, ZeroThrow } from '@zerothrow/core';

const config = ZeroThrow.firstSuccess([
  () => ZT.try(() => JSON.parse(process.env.CONFIG || 'invalid')),
  () => ZT.try(() => require('./config.json')),
  () => ZT.ok({ defaultSetting: true })
]);

// With error context
function loadConfig(): Result<Config, ZeroError> {
  return ZeroThrow.firstSuccess([
    () => loadFromEnv().mapErr(e => 
      ZeroThrow.wrap(e, 'ENV_CONFIG_FAILED')
    ),
    () => loadFromFile().mapErr(e => 
      ZeroThrow.wrap(e, 'FILE_CONFIG_FAILED')
    ),
    () => ZT.ok(defaultConfig)
  ]);
}
```

## Full Documentation

For comprehensive documentation including:
- Complete API reference
- Advanced patterns  
- Type definitions
- More examples

See the [Full API Documentation →](./docs/api.md)

## Philosophy

ZeroThrow follows these core principles:

1. **Zero Exceptions** - Replace `throw` with `Result<T, E>`
2. **Zero Dependencies** - No runtime dependencies
3. **Zero Overhead** - Minimal performance impact
4. **Type Safety** - Full TypeScript support with inference
5. **Composability** - Chain operations without nesting
6. **Explicit Errors** - Errors are values, not side effects

## Migration Guide

### From Try/Catch

```typescript
// Before
try {
  const data = JSON.parse(input);
  const user = await fetchUser(data.id);
  return process(user);
} catch (error) {
  logger.error('Failed', error);
  return null;
}

// After
ZT.try(() => JSON.parse(input))
  .andThen(data => fetchUser(data.id))
  .andThen(user => process(user))
  .tapErr(error => logger.error('Failed', error))
  .unwrapOr(null);
```

### From Promises

```typescript
// Before
fetchData()
  .then(data => transform(data))
  .then(result => save(result))
  .catch(error => {
    console.error(error);
    return fallback;
  });

// After
ZT.tryAsync(() => fetchData())
  .then(r => r
    .andThen(data => transform(data))
    .andThen(result => save(result))
    .tapErr(error => console.error(error))
    .unwrapOr(fallback)
  );
```

(Full codemod coming in `zt tryify` 🚧)

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT