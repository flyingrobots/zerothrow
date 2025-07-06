# @zerothrow/core

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/core)
![types](https://img.shields.io/npm/types/@zerothrow/core)
![size](https://packagephobia.com/badge?p=@zerothrow/core)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

Core ZeroThrow functionality - Rust-style Result<T,E> for TypeScript. Type-safe error handling with zero runtime dependencies.

## Installation

```bash
npm install @zerothrow/core
# or: pnpm add @zerothrow/core
```

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
  .match({
    Ok: user => console.log('User:', user),
    Err: error => console.log('Failed:', error)
  });
```

## API

### The ZT Pocket Knife (99% of use cases)

```typescript
import { ZT } from '@zerothrow/core';

// Wrap throwing functions
ZT.try(() => risky())              // Result<T, Error>
ZT.tryAsync(async () => fetch())   // Promise<Result<T, Error>>

// Create Results directly
ZT.ok(value)                       // Result<T, never>
ZT.err(error)                      // Result<never, Error>
ZT.err('CODE')                     // Result<never, ZeroError>
ZT.err('CODE', 'message')          // Result<never, ZeroError>
```

### Result Combinators

All Results come with built-in combinator methods:

```typescript
result
  .map(x => x * 2)                 // Transform success value
  .mapErr(e => new Error(e))       // Transform error
  .andThen(x => validate(x))       // Chain operations
  .orElse(() => getDefault())      // Provide fallback
  .tap(x => console.log(x))        // Side effects for success
  .tapErr(e => logError(e))        // Side effects for errors
  .unwrap()                        // Extract value (throws if error)
  .unwrapOr(defaultValue)          // Extract with default
  .match({                         // Pattern matching
    Ok: value => handleSuccess(value),
    Err: error => handleError(error)
  })
```

### Advanced Utilities

```typescript
import { ZeroThrow, collect, firstSuccess } from '@zerothrow/core';

// Batch operations - fail fast on any error
const results = await collect([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
]);

// Try alternatives until one succeeds
const config = firstSuccess([
  () => loadFromEnv(),
  () => loadFromFile(),
  () => useDefaults()
]);

// Compose operations
const pipeline = ZeroThrow.pipe(
  parseInput,
  validate,
  transform,
  save
);
```

## Examples

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
const file = await ZT.tryAsync(() => fs.readFile(path));

// ❌ Bad - your functions should return Results
function calculateTotal(items) {
  return ZT.try(() => {
    // Your logic here
  });
}

// ✅ Good - return Results directly
function calculateTotal(items): Result<number, Error> {
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
import { ZeroError } from '@zerothrow/core';

// Define your error codes
type AppErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED';

// Create typed errors
function createError(code: AppErrorCode, message: string) {
  return new ZeroError(code, message);
}

// Use in your functions
function findUser(id: string): Result<User, ZeroError> {
  const user = db.users.get(id);
  if (!user) {
    return ZT.err(createError('NOT_FOUND', `User ${id} not found`));
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

// Combine validations
const validatedData = collect([
  validateEmail(input.email),
  validateAge(input.age)
]);
```

### API Calls

```typescript
async function apiCall<T>(endpoint: string): Promise<Result<T, Error>> {
  return ZT.tryAsync(async () => {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  });
}

// Use it
const users = await apiCall<User[]>('/api/users')
  .then(r => r.map(users => users.filter(u => u.active)));
```

### Configuration Loading

```typescript
const config = firstSuccess([
  () => ZT.try(() => JSON.parse(process.env.CONFIG || 'invalid')),
  () => ZT.try(() => require('./config.json')),
  () => ZT.ok({ defaultSetting: true })
]);
```

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT