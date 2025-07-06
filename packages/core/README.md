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

### The Right Mental Model

1. **Write functions that return Results from the beginning** - Don't throw then wrap
2. **Only use `ZT.try` at absolute boundaries** - When interfacing with code you don't control  
3. **Results are your primary return type** - Not an afterthought or wrapper

### Basic Example

```typescript
import { ZT, Result } from '@zerothrow/core';

// ✅ Write Result-first functions
function parseConfig(input: string): Result<Config, Error> {
  if (!input) {
    return ZT.err('CONFIG_EMPTY', 'Configuration cannot be empty');
  }
  
  // Only use try for code you don't control (JSON.parse)
  return ZT.try(() => JSON.parse(input))
    .andThen(data => {
      if (!data.version) {
        return ZT.err('CONFIG_INVALID', 'Missing version field');
      }
      return ZT.ok(data as Config);
    });
}

// Chain operations cleanly
const config = parseConfig(rawInput)
  .map(cfg => ({ ...cfg, timestamp: Date.now() }))
  .tap(cfg => console.log('Loaded config:', cfg.version))
  .unwrapOr(defaultConfig);
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

### 1. Results Are Your Primary Return Type

Your functions should return Results from the start:

```typescript
// ❌ Bad: Throwing inside your own functions
function getUser(id: string): User {
  const user = db.find(id);
  if (!user) throw new Error('User not found');
  return user;
}

// ✅ Good: Return Results directly
function getUser(id: string): Result<User, Error> {
  const user = db.find(id);
  if (!user) {
    return ZT.err('USER_NOT_FOUND', `No user with id ${id}`);
  }
  return ZT.ok(user);
}

// Usage is explicit about error handling
const userName = getUser('123')
  .map(user => user.name)
  .unwrapOr('Guest');
```

### 2. Only Use ZT.try at Absolute Boundaries

`ZT.try` is ONLY for code you don't control that might throw:

```typescript
// ✅ Good: Only wrap third-party code that throws
function loadUserData(jsonString: string): Result<UserData, Error> {
  // JSON.parse can throw - we don't control it
  return ZT.try(() => JSON.parse(jsonString))
    .andThen(data => {
      // Our validation returns Results, no try needed!
      return validateUserData(data);
    });
}

// ❌ Bad: Wrapping your own code in try
function calculateTotal(items: Item[]): Result<number, Error> {
  return ZT.try(() => {
    // Why are you wrapping your own logic?
    return items.reduce((sum, item) => sum + item.price, 0);
  });
}

// ✅ Good: Return Results directly from your functions
function calculateTotal(items: Item[]): Result<number, Error> {
  if (items.length === 0) {
    return ZT.err('EMPTY_CART', 'Cannot calculate total for empty cart');
  }
  
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return ZT.ok(total);
}
```

### 3. Compose with Combinators

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

### 4. Design Error-First

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

### 5. Async Result-First

Write async functions that return Results:

```typescript
// ❌ Bad: Using tryAsync to wrap throwing code
async function fetchUser(id: string) {
  return ZT.tryAsync(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error('Failed');
    return response.json();
  });
}

// ✅ Good: Return Results directly
async function fetchUser(id: string): Promise<Result<User, Error>> {
  const response = await fetch(`/api/users/${id}`);
  
  if (!response.ok) {
    return ZT.err('FETCH_FAILED', `HTTP ${response.status}`);
  }
  
  // Only use try for the throwing json() method
  return ZT.try(() => response.json());
}

// Even better with resilience
import { Policy } from '@zerothrow/resilience';

const resilientFetch = Policy.retry(3).execute(
  () => fetchUser('123')
);
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
// ✅ Result-first API calls
async function apiCall<T>(endpoint: string): Promise<Result<T, Error>> {
  const response = await fetch(endpoint);
  
  if (!response.ok) {
    return ZT.err(
      'API_ERROR',
      `Request failed: ${response.status} ${response.statusText}`
    );
  }
  
  // Only wrap the part that actually throws
  return ZT.try(() => response.json() as Promise<T>);
}

// Use it with proper error handling
const activeUsers = await apiCall<User[]>('/api/users')
  .then(r => r
    .map(users => users.filter(u => u.active))
    .tapErr(err => console.error(`Failed to fetch users: ${err.message}`))
    .unwrapOr([])
  );
```

### Configuration Loading

```typescript
// ✅ Each loader returns a Result
function loadFromEnv(): Result<Config, Error> {
  const configStr = process.env.CONFIG;
  if (!configStr) {
    return ZT.err('NO_ENV_CONFIG', 'CONFIG environment variable not set');
  }
  
  return ZT.try(() => JSON.parse(configStr))
    .mapErr(e => new ZeroError('INVALID_ENV_CONFIG', e.message));
}

function loadFromFile(path: string): Result<Config, Error> {
  if (!fs.existsSync(path)) {
    return ZT.err('CONFIG_NOT_FOUND', `No config file at ${path}`);
  }
  
  return ZT.try(() => JSON.parse(fs.readFileSync(path, 'utf8')))
    .mapErr(e => new ZeroError('INVALID_FILE_CONFIG', e.message));
}

// Try multiple sources
const config = ZeroThrow.firstSuccess([
  () => loadFromEnv(),
  () => loadFromFile('./config.json'),
  () => ZT.ok(defaultConfig) // Final fallback
]);
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