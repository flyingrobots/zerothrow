# @zerothrow/testing

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/testing)
![types](https://img.shields.io/npm/types/@zerothrow/testing)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

Unified test matchers for ZeroThrow Result types - supports both Jest and Vitest with automatic test runner detection.

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-testing.webp" height="300" />
</div>


## Installation

```bash
npm install @zerothrow/testing @zerothrow/core
# or: pnpm add @zerothrow/testing @zerothrow/core
```

## Quick Start

The `@zerothrow/testing` package provides a unified interface for test matchers that work with both Jest and Vitest. It can automatically detect your test runner or be configured manually.

### Automatic Setup

```typescript
// In your test setup file (e.g., setupTests.ts)
import { setup } from '@zerothrow/testing';

// Auto-detects Jest or Vitest and configures matchers
setup();
```

### Manual Setup for Jest

```typescript
// jest.setup.ts
import { setupJest } from '@zerothrow/testing';

setupJest();
```

### Manual Setup for Vitest

```typescript
// vitest.setup.ts
import { setupVitest } from '@zerothrow/testing';

setupVitest();
```

## API

### Test Matchers

All matchers work identically in both Jest and Vitest:

#### `toBeOk()`
Asserts that a Result is Ok (successful).

```typescript
import { ZT } from '@zerothrow/core';

const result = ZT.ok(42);
expect(result).toBeOk();
```

#### `toBeOkWith(value)`
Asserts that a Result is Ok with a specific value.

```typescript
const result = ZT.ok({ id: 1, name: 'test' });
expect(result).toBeOkWith({ id: 1, name: 'test' });
```

#### `toBeErr()`
Asserts that a Result is Err (failed).

```typescript
const result = ZT.err(new Error('Failed'));
expect(result).toBeErr();
```

#### `toBeErrWith(error)`
Asserts that a Result is Err with specific error properties.

```typescript
const result = ZT.err(new Error('Network error'));
expect(result).toBeErrWith({ message: 'Network error' });

// With error code
const customError = Object.assign(new Error('Failed'), { code: 'E001' });
const result2 = ZT.err(customError);
expect(result2).toBeErrWith({ code: 'E001', message: 'Failed' });
```

#### `toHaveErrorCode(code)`
Asserts that a Result contains an error with a specific code.

```typescript
const error = Object.assign(new Error('Failed'), { code: 'NETWORK_ERROR' });
const result = ZT.err(error);
expect(result).toHaveErrorCode('NETWORK_ERROR');
```

#### `toHaveErrorMessage(message)`
Asserts that a Result contains an error with a specific message (supports string or RegExp).

```typescript
const result = ZT.err(new Error('Connection timeout'));
expect(result).toHaveErrorMessage('Connection timeout');
expect(result).toHaveErrorMessage(/timeout/i);
```

## Examples

### Testing Async Operations

```typescript
import { ZT } from '@zerothrow/core';

async function fetchUser(id: number) {
  return ZT.tryAsync(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) throw new Error('User not found');
    return response.json();
  });
}

test('fetches user successfully', async () => {
  const result = await fetchUser(1);
  expect(result).toBeOkWith({ id: 1, name: 'John' });
});

test('handles user not found', async () => {
  const result = await fetchUser(999);
  expect(result).toBeErr();
  expect(result).toHaveErrorMessage('User not found');
});
```

### Testing with Custom Error Types

```typescript
class ValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validateEmail(email: string) {
  return ZT.try(() => {
    if (!email.includes('@')) {
      throw new ValidationError('Invalid email format', 'INVALID_EMAIL');
    }
    return email.toLowerCase();
  });
}

test('validates email format', () => {
  const result = validateEmail('invalid');
  expect(result).toBeErr();
  expect(result).toHaveErrorCode('INVALID_EMAIL');
  expect(result).toHaveErrorMessage(/Invalid email/);
});
```

### Framework-Specific Configuration

#### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // ... other config
};
```

```typescript
// jest.setup.ts
import '@zerothrow/testing/setup'; // Auto-setup
// or
import { setupJest } from '@zerothrow/testing';
setupJest();
```

#### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // ... other config
  },
});
```

```typescript
// vitest.setup.ts
import '@zerothrow/testing/setup'; // Auto-setup
// or
import { setupVitest } from '@zerothrow/testing';
setupVitest();
```

## How It Works

The `@zerothrow/testing` package is a unified wrapper around:
- `@zerothrow/jest` - Jest-specific matcher implementations
- `@zerothrow/vitest` - Vitest-specific matcher implementations
- `@zerothrow/expect` - Shared matcher logic

It exports all matchers from both packages and provides:
1. **Auto-detection**: The `setup()` function detects whether Jest or Vitest is running
2. **Manual setup**: `setupJest()` and `setupVitest()` for explicit configuration
3. **Type safety**: Full TypeScript support with proper type extensions for both test runners

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT