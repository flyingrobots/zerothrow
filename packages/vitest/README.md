# @zerothrow/vitest

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/vitest)
![types](https://img.shields.io/npm/types/@zerothrow/vitest)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-vitest.webp" height="300" />
</div>

Vitest matchers for ZeroThrow Result types - write expressive tests for Result-based error handling with zero-cost abstractions.

## Installation

```bash
npm install @zerothrow/vitest @zerothrow/core @zerothrow/expect
# or: pnpm add @zerothrow/vitest @zerothrow/core @zerothrow/expect
```

## Quick Start

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts']
  }
});

// test/setup.ts
import '@zerothrow/vitest';

// Or manually setup:
// import { setup } from '@zerothrow/vitest';
// setup();
```

Now use the matchers in your tests:

```typescript
import { expect, test } from 'vitest';
import { ZT } from '@zerothrow/core';

test('should handle successful operations', () => {
  const result = ZT.ok(42);
  
  expect(result).toBeOk();
  expect(result).toBeOkWith(42);
});

test('should handle errors', () => {
  const result = ZT.err(new Error('Something went wrong'));
  
  expect(result).toBeErr();
  expect(result).toBeErrWith({ message: 'Something went wrong' });
});
```

## API

### Matchers

#### `toBeOk()`
Asserts that a Result is Ok (success).

```typescript
const result = ZT.ok('success');
expect(result).toBeOk(); // ✅ passes
```

#### `toBeOkWith(expected)`
Asserts that a Result is Ok with a specific value.

```typescript
const result = ZT.ok({ id: 1, name: 'Alice' });
expect(result).toBeOkWith({ id: 1, name: 'Alice' }); // ✅ passes
```

#### `toBeErr()`
Asserts that a Result is Err (failure).

```typescript
const result = ZT.err(new Error('Failed'));
expect(result).toBeErr(); // ✅ passes
```

#### `toBeErrWith(error)`
Asserts that a Result is Err with specific error properties.

```typescript
const result = ZT.err(new Error('Network error'));

// Match by error instance
expect(result).toBeErrWith(new Error('Network error')); // ✅

// Match by properties
expect(result).toBeErrWith({ message: 'Network error' }); // ✅

// With error codes (ZeroError)
const codeError = ZT.err('NETWORK_ERROR', 'Connection failed');
expect(codeError).toBeErrWith({ 
  code: 'NETWORK_ERROR',
  message: 'Connection failed' 
}); // ✅
```

#### `toHaveErrorCode(code)`
Asserts that a Result contains an error with a specific code.

```typescript
const result = ZT.err('USER_NOT_FOUND', 'User does not exist');
expect(result).toHaveErrorCode('USER_NOT_FOUND'); // ✅ passes
```

#### `toHaveErrorMessage(message)`
Asserts that a Result contains an error with a specific message.

```typescript
const result = ZT.err(new Error('Connection timeout'));

// Exact match
expect(result).toHaveErrorMessage('Connection timeout'); // ✅

// RegExp match
expect(result).toHaveErrorMessage(/timeout/i); // ✅
```

### TypeScript Support

All matchers are fully typed and extend Vitest's `Assertion` interface:

```typescript
import { Result } from '@zerothrow/core';

declare module 'vitest' {
  interface Assertion {
    toBeOk(): void;
    toBeOkWith<T>(expected: T): void;
    toBeErr(): void;
    toBeErrWith<E extends Error>(error: E | { code?: string; message?: string }): void;
    toHaveErrorCode(code: string): void;
    toHaveErrorMessage(message: string | RegExp): void;
  }
}
```

## Examples

### Testing async operations with combinators

```typescript
import { expect, test } from 'vitest';
import { ZT } from '@zerothrow/core';

async function fetchUser(id: number) {
  return ZT.tryAsync(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  });
}

test('should transform user data', async () => {
  const result = await fetchUser(1)
    .then(r => r
      .map(user => user.name.toUpperCase())
      .tap(name => console.log('Processing:', name))
    );
  
  expect(result).toBeOk();
  expect(result).toBeOkWith('ALICE');
});

test('should handle errors gracefully', async () => {
  const result = await fetchUser(999)
    .then(r => r
      .mapErr(err => new Error(`User fetch failed: ${err.message}`))
      .orElse(() => ZT.ok({ id: 0, name: 'Guest' }))
    );
  
  expect(result).toBeOk();
  expect(result).toBeOkWith({ id: 0, name: 'Guest' });
});
```

### Testing with ZeroError codes

```typescript
import { expect, test } from 'vitest';
import { ZT } from '@zerothrow/core';

function validateEmail(email: string) {
  if (!email.includes('@')) {
    return ZT.err('INVALID_EMAIL', 'Email must contain @');
  }
  return ZT.ok(email.toLowerCase());
}

test('email validation', () => {
  const valid = validateEmail('user@example.com');
  expect(valid).toBeOk();
  expect(valid).toBeOkWith('user@example.com');
  
  const invalid = validateEmail('invalid');
  expect(invalid).toBeErr();
  expect(invalid).toHaveErrorCode('INVALID_EMAIL');
  expect(invalid).toHaveErrorMessage('Email must contain @');
});
```

### Testing Result chains and combinators

```typescript
import { expect, test } from 'vitest';
import { ZT, ZeroThrow } from '@zerothrow/core';

function parseAndDouble(input: string) {
  return ZT.try(() => JSON.parse(input))
    .andThen(val => {
      if (typeof val !== 'number') {
        return ZT.err('TYPE_ERROR', 'Expected number');
      }
      return ZT.ok(val * 2);
    });
}

test('should compose multiple transformations', () => {
  const result = parseAndDouble('42')
    .map(n => n / 2)  // Back to original
    .map(n => n + 10) // Add 10
    .tap(n => expect(n).toBe(52))
    .map(n => `Result: ${n}`);
    
  expect(result).toBeOk();
  expect(result).toBeOkWith('Result: 52');
});

test('should handle error mapping', () => {
  const result = parseAndDouble('invalid')
    .tapErr(err => console.error('Parse failed:', err))
    .mapErr(err => ({ 
      type: 'PARSE_ERROR', 
      original: err.message 
    }));
    
  expect(result).toBeErr();
  expect(result).toBeErrWith({ 
    type: 'PARSE_ERROR',
    original: expect.stringContaining('Unexpected token')
  });
});

test('should provide fallback values', () => {
  const result = parseAndDouble('"hello"')
    .orElse(() => parseAndDouble('100'));
    
  expect(result).toBeOk();
  expect(result).toBeOkWith(200);
});

test('should collect multiple results', async () => {
  const inputs = ['42', '100', 'invalid', '50'];
  const results = inputs.map(parseAndDouble);
  
  // Get all successes, ignoring errors
  const successes = results
    .filter(r => r.ok)
    .map(r => r.unwrapOr(0));
    
  expect(successes).toEqual([84, 200, 100]);
  
  // Or use ZeroThrow.collect to fail fast
  const collected = ZeroThrow.collect(results.slice(0, 2));
  expect(collected).toBeOk();
  expect(collected).toBeOkWith([84, 200]);
});
```

## Manual Setup

If you prefer not to use automatic setup, you can manually configure the matchers:

```typescript
// test/setup.ts
import { expect } from 'vitest';
import { vitestMatchers } from '@zerothrow/vitest';

expect.extend(vitestMatchers);
```

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT
