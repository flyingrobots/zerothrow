# ZeroThrow

<div align="center">

<img src="./zt-penguin.png" alt="ZeroThrow penguin mascot" width="200" />

![No-Throw Discipline](https://img.shields.io/badge/no--throw_discipline-✅-success?style=for-the-badge)
[![NPM Version](https://img.shields.io/npm/v/@zerothrow/core?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@zerothrow/core)
[![License](https://img.shields.io/github/license/zerothrow/zerothrow?style=for-the-badge)](LICENSE)
![Beta](https://img.shields.io/badge/status-beta-yellow?style=for-the-badge)

**Stop throwing, start returning.**

Write functions that return `Result<T,E>` from the start. No hidden control flow. No stack unwinding. Just plain data, fully typed.

[The Result Mindset](#the-result-mindset) • [Composability](#composability) • [Interop](#interop-for-legacy-code)<br/>
[Package Ecosystem](#package-ecosystem) • [Performance](#performance) • [Migration](#migration-guide)

> 🚀 **Now in beta!** Core functionality is stable with comprehensive test coverage. [See roadmap](#roadmap)

</div>

---

## Package Ecosystem

### Published Packages
| Package | Version | Description | Status |
|---------|---------|-------------|--------|
| [`@zerothrow/core`](packages/core) | [![npm](https://img.shields.io/npm/v/@zerothrow/core.svg?style=flat-square)](https://npm.im/@zerothrow/core) v0.2.0 | Core Result types and utilities | ✅ Stable |
| [`@zerothrow/jest`](packages/jest) | [![npm](https://img.shields.io/npm/v/@zerothrow/jest.svg?style=flat-square)](https://npm.im/@zerothrow/jest) v1.0.1 | Jest matchers for Result types | ✅ Stable |
| [`@zerothrow/vitest`](packages/vitest) | [![npm](https://img.shields.io/npm/v/@zerothrow/vitest.svg?style=flat-square)](https://npm.im/@zerothrow/vitest) v1.0.1 | Vitest matchers for Result types | ✅ Stable |
| [`@zerothrow/expect`](packages/expect) | [![npm](https://img.shields.io/npm/v/@zerothrow/expect.svg?style=flat-square)](https://npm.im/@zerothrow/expect) v0.1.0 | Shared test matcher logic | ✅ Stable |
| [`@zerothrow/testing`](packages/testing) | [![npm](https://img.shields.io/npm/v/@zerothrow/testing.svg?style=flat-square)](https://npm.im/@zerothrow/testing) v1.0.1 | Unified test matchers (Jest + Vitest) | ✅ Stable |
| [`@zerothrow/resilience`](packages/resilience) | [![npm](https://img.shields.io/npm/v/@zerothrow/resilience.svg?style=flat-square)](https://npm.im/@zerothrow/resilience) v0.1.1 | Production-grade resilience patterns | ✅ Stable |
| [`@zerothrow/docker`](packages/docker) | [![npm](https://img.shields.io/npm/v/@zerothrow/docker.svg?style=flat-square)](https://npm.im/@zerothrow/docker) v0.1.1 | Docker utilities for testing | ✅ Stable |
| [`@zerothrow/zt-cli`](packages/zt-cli) | v0.1.1 | CLI tool for repo workflows | 🚧 Internal |

### Unpublished Packages (In Development)
| Package | Description | Status |
|---------|-------------|--------|
| [`@zerothrow/eslint-plugin`](packages/eslint-plugin) | ESLint rules to enforce no-throw | 🚧 Development |
| [`@zerothrow/react`](packages/react) | React hooks for Result types | 🚧 Development |
| [`@zerothrow/logger-winston`](packages/logger-winston) | Winston logger integration | 🚧 Development |
| [`@zerothrow/logger-pino`](packages/logger-pino) | Pino logger integration | 🚧 Development |

See our [full ecosystem roadmap](https://github.com/zerothrow/zerothrow/discussions) for Phase 3 (Integration Layer) and Phase 4 (Ecosystem Domination) packages including framework adapters, database integrations, and more!

### Latest Features (v0.2.0)

- **✨ `ZT.tryAsync()`** - Cleaner async error handling that returns `Promise<Result<T,E>>`
- **✨ String error shortcuts** - `ZT.err('ERROR_CODE')` and `ZT.err('CODE', 'message')`
- **✨ Test matchers** - Result-friendly assertions for Jest (Vitest coming soon!)
- **✨ Exported types** - `Result`, `Ok`, `Err` types now available at package root

### What's Next

- **🔜 Vitest support** - Test matchers for Vitest users
- **🔜 ESLint plugin** - Enforce no-throw discipline automatically
- **🔜 React hooks** - `useResult` and other React integrations
- **🔜 Resilience utilities** - Retry, circuit breaker, timeout patterns

---

## The Result Mindset

With ZeroThrow, every function declares its success and failure types upfront:

```typescript
import { ZT, ZeroThrow } from '@zerothrow/core'

// Write functions that return Result from the start
function parseUser(input: unknown): ZeroThrow.Result<User, ParseError> {
  if (!input || typeof input !== 'object') {
    return ZT.err(new ParseError('INVALID_FORMAT', 'Expected object'))
  }
  
  const data = input as Record<string, unknown>
  
  if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
    return ZT.err(new ParseError('INVALID_EMAIL', 'Email required'))
  }
  
  return ZT.ok({
    id: data.id as string,
    email: data.email.toLowerCase(),
    name: (data.name as string) || 'Anonymous'
  })
}

// Errors flow through your program as values
const user = parseUser(input)
if (!user.ok) {
  console.log(`Parse failed: ${user.error.code}`)
  return
}

console.log(`Welcome, ${user.value.name}!`)
```

**Exceptions fly; Results flow.** 🚀

## Composability

Results are values you can transform, chain, and combine:

```typescript
// Start with a Result-returning function
const userResult = parseUser(userData)

// Transform success values
const uppercased = userResult
  .map(user => ({ ...user, name: user.name.toUpperCase() }))

// Chain operations that might fail
const saved = userResult
  .andThen(user => validateAge(user))
  .andThen(user => saveToDatabase(user))

// Transform errors
const result = parseUser(input)
  .mapErr(err => new AppError('USER_PARSE_FAILED', err))

// Provide fallbacks
const user = parseUser(input)
  .unwrapOr({ id: 0, email: 'guest@example.com', name: 'Guest' })
```

### Batch Operations

```typescript
import { ZeroThrow } from '@zerothrow/zerothrow'

// Collect multiple Results into one
const results = await ZeroThrow.collect([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
])

if (!results.ok) {
  // First error stops the collection
  console.error('Failed to fetch users:', results.error)
}

// Pipeline operations
const processed = ZeroThrow.pipe(
  rawData,
  parse,
  validate,
  transform,
  save
)
```

## Why ZeroThrow?

### 🎯 **No Hidden Control Flow**

Every error path is visible in the type system. No surprises.

```typescript
// You can see EXACTLY what can go wrong
function transfer(
  from: Account,
  to: Account,
  amount: number
): Result<Transaction, TransferError> {
  // Every error case is explicit and typed
  if (from.balance < amount) {
    return ZT.err(new TransferError('INSUFFICIENT_FUNDS'))
  }
  
  if (to.status !== 'ACTIVE') {
    return ZT.err(new TransferError('INACTIVE_ACCOUNT'))
  }
  
  // Success path is also explicit
  return ZT.ok(executeTransfer(from, to, amount))
}
```

### ⚡ **Predictable Performance**

No stack unwinding, no hidden control flow, just plain data:

```
Exception vs Result: error path cost (1M operations):
throw/catch:  ████████████████████████████████████████  2208.24ms
Result:       █                                         23.69ms
              
              Returning beats unwinding: 93× less error-path cost!
```

Why? Because returning an object is fundamentally faster than unwinding the call stack.

### 🛡️ **Type-Safe Error Handling**

TypeScript knows about every possible error:

```typescript
const result = parseUser(data)
  .andThen(user => enrichProfile(user))
  .andThen(profile => saveProfile(profile))

// TypeScript knows this could be ParseError | EnrichError | SaveError
if (!result.ok) {
  switch (result.error.code) {
    case 'INVALID_EMAIL': // ✅ TypeScript knows this exists
    case 'PROFILE_API_DOWN': // ✅ And this
    case 'DB_CONNECTION_LOST': // ✅ And this
  }
}
```

## Quick Start

### Installation

```bash
npm install @zerothrow/core

# For testing
npm install --save-dev @zerothrow/jest  # Jest users
npm install --save-dev @zerothrow/vitest # Vitest users (coming soon)
```

> ⚠️ **Beta Release**: API is stable with semantic versioning. Breaking changes in v0.2.0 - see [migration guide](#migration-guide)

### Basic Usage

Start by writing functions that return Results:

```typescript
import { ZT, ZeroThrow } from '@zerothrow/core'

// Define your domain errors
class ValidationError extends ZeroThrow.ZeroError {
  constructor(field: string, message: string) {
    super('VALIDATION_ERROR', message, { field })
  }
}

// Write Result-returning functions
function validateAge(age: number): ZeroThrow.Result<number, ValidationError> {
  if (age < 0 || age > 150) {
    return ZT.err(new ValidationError('age', 'Invalid age range'))
  }
  return ZT.ok(age)
}

// Compose them together
const result = validateAge(input)
  .map(age => ({ age, category: age >= 18 ? 'adult' : 'minor' }))
  .mapErr(err => console.error(`Validation failed: ${err.context.field}`))
```

### Creating Results

```typescript
// Success
const good = ZT.ok({ id: 1, name: 'Alice' })

// Failure  
const bad = ZT.err(new Error('Something went wrong'))

// Never throw - always return!
function divide(a: number, b: number): ZeroThrow.Result<number> {
  if (b === 0) {
    return ZT.err(new ZeroThrow.ZeroError('DIV_BY_ZERO', 'Cannot divide by zero'))
  }
  return ZT.ok(a / b)
}
```

## Interop for Legacy Code

When dealing with code you don't control (third-party libraries, Node.js APIs, legacy code), use `ZT.try` or `ZT.tryAsync`. Once you own the code, refactor to return Result directly.

### Synchronous code that throws

```typescript
// Wrapping code that might throw
const result = ZT.try(() => {
  return JSON.parse(userInput) // third-party code that throws
})
```

### Async code (New in v0.0.2!)

Use `ZT.tryAsync` for clearer async handling:

```typescript
// NEW: ZT.tryAsync for async operations
const result = await ZT.tryAsync(async () => {
  const response = await fetch(url)
  return response.json()
})
// result is Result<T, Error> after awaiting

// ZT.try also works with async, but returns Promise<Result>
const promiseResult = ZT.try(async () => {
  const response = await fetch(url)
  return response.json()
})
// Need to await to get the Result
const result = await promiseResult
```

### Error convenience (New in v0.0.2!)

Create errors with less boilerplate:

```typescript
// NEW: String overloads for ZT.err
ZT.err('NETWORK_ERROR')  // Creates ZeroError with code
ZT.err('VALIDATION_ERROR', 'Email required')  // With custom message

// Still supports Error objects
ZT.err(new Error('Something went wrong'))
ZT.err(new ZeroThrow.ZeroError('API_ERROR', 'Failed', { status: 500 }))
```

**Remember**: `ZT.try` is for code you don't control. For your own code, return Results directly!

## Testing

### Jest Matchers

```typescript
import '@zerothrow/jest'
import { ZT } from '@zerothrow/core'

test('user validation', () => {
  const result = validateUser(input)
  
  // Result state matchers
  expect(result).toBeOk()
  expect(result).not.toBeErr()
  
  // Value matchers
  expect(result).toBeOkWith({ name: 'Alice', age: 30 })
  
  // Error matchers
  const error = ZT.err('VALIDATION_ERROR', 'Invalid input')
  expect(error).toBeErr()
  expect(error).toHaveErrorCode('VALIDATION_ERROR')
  expect(error).toHaveErrorMessage('Invalid input')
})
```

### Vitest Matchers (Coming Soon!)

```typescript
import '@zerothrow/vitest'
// Same API as Jest matchers
```

## Tooling

### 🚨 **ESLint Enforcement** (Coming in Beta)

Never accidentally write a `throw` statement again:

```javascript
// .config/eslint.config.js
import zerothrow from '@zerothrow/eslint-plugin'

export default [
  {
    plugins: { zerothrow },
    rules: { 
      'zerothrow/no-throw': 'error' 
    }
  }
]
```

The linter will catch any `throw` statements and suggest Result-based alternatives.

### 📦 **Codemod** (Alpha)

Transform your entire codebase from throws to Results:

```bash
npx @zerothrow/codemod .
```

[Track progress →](https://github.com/zerothrow/zerothrow/issues/codemod)

## API Reference

### Core Types

```typescript
type Result<T, E = Error> = Ok<T> | Err<E>
type Ok<T> = { ok: true; value: T; /* methods */ }
type Err<E> = { ok: false; error: E; /* methods */ }
```

### Result Methods

All Results are chainable:

```typescript
interface Result<T, E> {
  // Transform success value
  map<U>(fn: (value: T) => U): Result<U, E>
  
  // Chain another Result operation
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E>
  
  // Transform error
  mapErr<F>(fn: (error: E) => F): Result<T, F>
  
  // Provide alternative Result for errors
  orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>
  
  // Extract value or use default
  unwrapOr(defaultValue: T): T
  
  // Extract value or compute default
  unwrapOrElse(fn: (error: E) => T): T
}
```

### ZT Namespace

```typescript
const ZT = {
  ok<T>(value: T): Result<T, never>              // Create success
  err<E = ZeroError>(error: E): Result<never, E> // Create failure  
  try<T>(fn: () => T): Result<T, ZeroError>      // Interop with throwing code
  tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, ZeroError>> // Async interop (NEW!)
}
```

### ZeroThrow Namespace

```typescript
const ZeroThrow = {
  // Combinators
  pipe<T>(...fns): Result<T>
  collect<T>(results: Result<T>[]): Result<T[]>
  collectAsync<T>(promises): Promise<Result<T[]>>
  firstSuccess<T>(results: Result<T>[]): Result<T>
  
  // Interop helpers
  fromAsync<T>(fn): (...args) => Promise<Result<T>>
  enhance<T>(promise): Promise<Result<T>>
  
  // Types
  Result<T, E>
  Ok<T>
  Err<E>
  ZeroError
}
```

## Performance

### Benchmarks

Result pattern performance vs exceptions:

| Operation | Result Pattern | throw/catch | Improvement |
|-----------|---------------|-------------|-------------|
| Success path | 2.1μs | 2.0μs | Similar |
| Error path | 23.7μs | 2.2ms | **93× faster** |
| Deep call stack (10 levels) | 24.1μs | 8.7ms | **360× faster** |
| With error context | 31.2μs | 2.4ms | **77× faster** |

### Why Results Are Faster

1. **No stack unwinding** - Returning an object is O(1)
2. **No hidden control flow** - CPU can predict branches
3. **Better memory locality** - Data stays in cache
4. **Enables inlining** - JIT can optimize better

## Migration Guide

### Step 1: Install and Configure

```bash
npm install @zerothrow/core
```

Add the ESLint rule to catch throws (coming in beta):

```javascript
// .config/eslint.config.js
import zerothrow from '@zerothrow/eslint-plugin' // Coming in beta

export default [
  {
    plugins: { zerothrow },
    rules: { 'zerothrow/no-throw': 'error' }
  }
]
```

### Step 2: Start With Leaf Functions

Transform deepest functions first:

```typescript
// ❌ Before - throws
function parseConfig(json: string): Config {
  const data = JSON.parse(json) // might throw!
  if (!data.version) {
    throw new Error('Missing version')
  }
  return data
}

// ✅ After - returns Result
function parseConfig(json: string): Result<Config> {
  // Step 0: Shield external throwers with ZT.try
  const parsed = ZT.try(() => JSON.parse(json))
  if (!parsed.ok) {
    return ZT.err(new ZeroThrow.ZeroError('PARSE_ERROR', 'Invalid JSON'))
  }
  
  const data = parsed.value
  if (!data || typeof data !== 'object') {
    return ZT.err(new ZeroThrow.ZeroError('INVALID_STRUCTURE', 'Expected object'))
  }
  
  if (!data.version) {
    return ZT.err(new ZeroThrow.ZeroError('MISSING_VERSION', 'Version required'))
  }
  
  return ZT.ok(data as Config)
}
```

### Step 3: Propagate Results Up

Update callers to handle Results:

```typescript
// ❌ Before
try {
  const config = parseConfig(input)
  console.log(config.version)
} catch (e) {
  console.error('Failed:', e.message)
}

// ✅ After  
const config = parseConfig(input)
if (!config.ok) {
  console.error('Failed:', config.error.message)
  return
}
console.log(config.value.version)
```

### Step 4: Use Combinators

Replace nested try/catch with chains:

```typescript
// ❌ Before - nested try/catch
try {
  const config = parseConfig(raw)
  try {
    const validated = validateConfig(config)
    try {
      await saveConfig(validated)
    } catch (e) {
      throw new Error(`Save failed: ${e.message}`)
    }
  } catch (e) {
    throw new Error(`Validation failed: ${e.message}`)
  }
} catch (e) {
  console.error(e)
}

// ✅ After - composable chain
const result = parseConfig(raw)
  .andThen(config => validateConfig(config))
  .andThen(config => saveConfig(config))

if (!result.ok) {
  console.error(result.error)
}
```

## Examples

### Form Validation

```typescript
import { ZT, ZeroThrow } from '@zerothrow/core'

// Domain-specific error
class ValidationError extends ZeroThrow.ZeroError {
  constructor(field: string, rule: string, message: string) {
    super(`VALIDATION_${rule}`, message, { field })
  }
}

// Result-returning validators
function validateEmail(email: string): Result<string, ValidationError> {
  if (!email) {
    return ZT.err(new ValidationError('email', 'REQUIRED', 'Email is required'))
  }
  
  if (!email.includes('@')) {
    return ZT.err(new ValidationError('email', 'FORMAT', 'Invalid email format'))
  }
  
  return ZT.ok(email.toLowerCase())
}

function validateAge(age: string): Result<number, ValidationError> {
  const parsed = parseInt(age, 10)
  
  if (isNaN(parsed)) {
    return ZT.err(new ValidationError('age', 'TYPE', 'Age must be a number'))
  }
  
  if (parsed < 18 || parsed > 100) {
    return ZT.err(new ValidationError('age', 'RANGE', 'Age must be 18-100'))
  }
  
  return ZT.ok(parsed)
}

// Compose validations
function validateForm(data: FormData): Result<User, ValidationError> {
  return validateEmail(data.email)
    .andThen(email => 
      validateAge(data.age).map(age => ({ email, age }))
    )
}
```

### API Client

```typescript
class ApiError extends ZeroThrow.ZeroError {
  constructor(
    public status: number,
    message: string,
    public endpoint: string
  ) {
    super(`HTTP_${status}`, message, { endpoint, status })
  }
}

class ApiClient {
  async getUser(id: string): Promise<Result<User, ApiError>> {
    const response = await fetch(`/api/users/${id}`)
    
    if (!response.ok) {
      return ZT.err(new ApiError(
        response.status,
        `Failed to fetch user ${id}`,
        `/api/users/${id}`
      ))
    }
    
    const data = await response.json()
    return ZT.ok(data as User)
  }
  
  async getUsers(ids: string[]): Promise<Result<User[], ApiError>> {
    const results = await ZeroThrow.collectAsync(
      ids.map(id => this.getUser(id))
    )
    
    return results.mapErr(err => 
      new ApiError(err.status, 'Batch fetch failed', '/api/users/*')
    )
  }
}
```

## React Integration

```typescript
import { useResult } from '@zerothrow/react' // Coming in beta

function UserProfile({ id }: { id: string }) {
  const userResult = useResult(() => api.getUser(id), [id])
  
  if (!userResult.ok) {
    return <ErrorDisplay error={userResult.error} />
  }
  
  if (userResult.loading) {
    return <Skeleton />
  }
  
  return <Profile user={userResult.value} />
}
```

## Best Practices

### DO ✅

- **Return Results from the start** - Don't throw in new code
- **Use specific error types** - Create domain errors with context
- **Compose with combinators** - Chain operations fluently
- **Reserve ZT.try for interop** - Only wrap what you don't control

### DON'T ❌

- **Don't throw** - Return Results instead
- **Don't overuse ZT.try** - Write Result-first code
- **Don't lose error context** - Include relevant debugging info
- **Handle every Err branch** - TypeScript ensures exhaustiveness

## Platform Support

- **Node.js**: 16.14+
- **Deno**: Full support via npm specifiers
- **Browsers**: All modern browsers
- **React Native**: Full support
- **Edge Workers**: Cloudflare Workers, Vercel Edge, etc.

## Roadmap

### 🎯 Current: Beta (v0.2.0)
- ✅ Core `Result<T,E>` type system
- ✅ ZT pocket knife API
- ✅ ZeroThrow advanced namespace
- ✅ Zero runtime dependencies
- ✅ Full TypeScript support
- ✅ Jest & Vitest test matchers
- ✅ `ZT.tryAsync()` for cleaner async handling
- ✅ String overloads for `ZT.err()`
- ✅ Unified Result API - all Results are combinable
- ✅ Resilience patterns (retry, circuit breaker, timeout)

### 🚀 Next: v1.0 Release
- [ ] ESLint plugin (`@zerothrow/eslint-plugin`)
- [ ] React hooks (`@zerothrow/react`)
- [ ] Logger integrations (`@zerothrow/logger-winston`, `@zerothrow/logger-pino`)
- [ ] Comprehensive migration tooling
- [ ] Performance benchmarks
- [ ] Production case studies

### 🏁 Future: v1.0
- [ ] Stable API guarantee
- [ ] Comprehensive documentation
- [ ] Ecosystem packages
- [ ] Migration tooling

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git clone https://github.com/zerothrow/zerothrow
cd zerothrow
npm install
npm test
```

## License

MIT © 2025 [ZeroThrow](https://github.com/zerothrow)

---

<div align="center">

**Exceptions fly; Results flow.**

[Get Started](#the-result-mindset) • [Documentation](docs/) • [GitHub](https://github.com/zerothrow/zerothrow)

</div>