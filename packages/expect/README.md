# @zerothrow/expect

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/expect)
![types](https://img.shields.io/npm/types/@zerothrow/expect)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-expect.webp" height="300" />
</div>

Shared test matcher logic for ZeroThrow Result types. This package provides the core implementation for test matchers that work with `Result<T, E>` types, used by both Jest and Vitest test frameworks.

## Installation

```bash
npm install @zerothrow/expect @zerothrow/core
# or: pnpm add @zerothrow/expect @zerothrow/core
```

> **Note**: This package is primarily used as a dependency by `@zerothrow/jest` and `@zerothrow/vitest`. Most users should install those packages instead.

## Overview

The `@zerothrow/expect` package provides framework-agnostic matcher implementations for testing `Result<T, E>` types. It includes:

- Type guards for identifying Result types
- Error formatting utilities
- Core matcher logic that can be wrapped by different test frameworks
- TypeScript types for matcher results and contexts

## API

### Type Guards

#### `isResult(value: unknown): value is Result<unknown, Error>`
Checks if a value is a valid Result type with either `{ ok: true, value: T }` or `{ ok: false, error: E }` structure.

```typescript
import { isResult } from '@zerothrow/expect';

const result = ZT.try(() => JSON.parse('{"valid": true}'));
console.log(isResult(result)); // true
console.log(isResult({ ok: true })); // false (missing value property)
```

### Error Formatting

#### `formatError(error: unknown): string`
Formats various error types into readable strings for test output.

```typescript
import { formatError } from '@zerothrow/expect';

formatError(new Error('Failed')); // "Error: Failed"
formatError({ code: 'E001', message: 'Not found' }); // "{ code: E001, message: Not found }"
formatError('string error'); // '"string error"'
```

### Matcher Functions

All matcher functions return a `MatcherResult` with:
- `pass: boolean` - Whether the assertion passed
- `message: () => string` - Function returning the failure message

#### `toBeOkMatcher(received: unknown, context?: MatcherContext)`
Asserts that a Result is Ok (successful).

#### `toBeOkWithMatcher<T>(received: unknown, expected: T, context: MatcherContext)`
Asserts that a Result is Ok with a specific value.

#### `toBeErrMatcher(received: unknown, context?: MatcherContext)`
Asserts that a Result is Err (failed).

#### `toBeErrWithMatcher<E extends Error>(received: unknown, expected: E | { code?: string; message?: string }, context: MatcherContext)`
Asserts that a Result is Err with specific error properties.

#### `toHaveErrorCodeMatcher(received: unknown, code: string)`
Asserts that a Result has an error with a specific code property.

#### `toHaveErrorMessageMatcher(received: unknown, message: string | RegExp)`
Asserts that a Result has an error with a specific message.

## Usage by Test Frameworks

This package is designed to be wrapped by framework-specific packages:

### Jest Integration (@zerothrow/jest)
```typescript
import { toBeOkMatcher } from '@zerothrow/expect';

export function toBeOk(this: jest.MatcherContext, received: unknown) {
  return toBeOkMatcher(received, this);
}
```

### Vitest Integration (@zerothrow/vitest)
```typescript
import { toBeOkMatcher } from '@zerothrow/expect';

export function toBeOk(received: unknown) {
  return toBeOkMatcher(received, { equals: vi.fn().mockImplementation((a, b) => a === b) });
}
```

## Examples

### Direct Usage (Advanced)
```typescript
import { ZT } from '@zerothrow/core';
import { toBeOkMatcher, toBeErrWithMatcher } from '@zerothrow/expect';

// Test a successful result
const result = ZT.ok(42);
const okMatch = toBeOkMatcher(result);
console.log(okMatch.pass); // true

// Test an error result
const errResult = ZT.err(new Error('Failed'));
const errMatch = toBeErrWithMatcher(
  errResult, 
  { message: 'Failed' },
  { equals: (a, b) => a === b }
);
console.log(errMatch.pass); // true
```

### Error Code Testing
```typescript
import { toHaveErrorCodeMatcher } from '@zerothrow/expect';

const error = Object.assign(new Error('Not found'), { code: 'E404' });
const result = ZT.err(error);

const codeMatch = toHaveErrorCodeMatcher(result, 'E404');
console.log(codeMatch.pass); // true
console.log(codeMatch.message()); // Would show error details if it failed
```

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT