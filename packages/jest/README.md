# @zerothrow/jest

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `orElse`)  
> • **ZeroThrow** – utilities (`collect`, `firstSuccess`, `pipe`)  
> • **@zerothrow/\*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

![npm](https://img.shields.io/npm/v/@zerothrow/jest)
![types](https://img.shields.io/npm/types/@zerothrow/jest)
![size](https://packagephobia.com/badge?p=@zerothrow/jest)
[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-jest.webp" height="300" />
</div>

Jest matchers for ZeroThrow Result types - elegant error handling assertions for your tests.

## Installation

```bash
npm install @zerothrow/jest @zerothrow/core @zerothrow/expect
# or: pnpm add @zerothrow/jest @zerothrow/core @zerothrow/expect
```

> **Note:** `@zerothrow/core` and `@zerothrow/expect` are peer dependencies.

## Quick Start

The matchers are automatically registered when you import the package. Simply import it in your test setup file or at the top of your test files:

```typescript
import '@zerothrow/jest';
import { ZT } from '@zerothrow/core';

describe('My Service', () => {
  it('should handle success', () => {
    const result = ZT.ok(42);
    expect(result).toBeOk();
    expect(result).toBeOkWith(42);
  });

  it('should handle errors', () => {
    const result = ZT.err('VALIDATION_ERROR', 'Invalid input');
    expect(result).toBeErr();
    expect(result).toHaveErrorCode('VALIDATION_ERROR');
    expect(result).toHaveErrorMessage('Invalid input');
  });
});
```

## Setup Options

### Automatic Setup (Default)
The matchers are automatically registered when the module is imported:

```typescript
// In your test file or setup file
import '@zerothrow/jest';
```

### Manual Setup
If you need more control over when matchers are registered:

```typescript
import { setup, jestMatchers } from '@zerothrow/jest';

// Option 1: Use the setup function
setup();

// Option 2: Register matchers manually
expect.extend(jestMatchers);
```

### TypeScript Configuration
The TypeScript types are automatically included. If you're using a custom `tsconfig.json` for tests, ensure the types are included:

```json
{
  "compilerOptions": {
    "types": ["jest", "@zerothrow/jest"]
  }
}
```

## API

### `toBeOk()`
Asserts that a Result is Ok (successful).

```typescript
const result = ZT.ok('success');
expect(result).toBeOk(); // Passes

const error = ZT.err('FAILED');
expect(error).toBeOk(); // Fails
```

### `toBeOkWith(expected)`
Asserts that a Result is Ok with a specific value.

```typescript
const result = ZT.ok({ id: 1, name: 'test' });
expect(result).toBeOkWith({ id: 1, name: 'test' }); // Passes
expect(result).toBeOkWith({ id: 2, name: 'test' }); // Fails
```

### `toBeErr()`
Asserts that a Result is Err (failure).

```typescript
const result = ZT.err('ERROR_CODE');
expect(result).toBeErr(); // Passes

const success = ZT.ok('value');
expect(success).toBeErr(); // Fails
```

### `toBeErrWith(error)`
Asserts that a Result is Err with specific error properties.

```typescript
const result = ZT.err('VALIDATION_ERROR', 'Email is invalid');

// Match by error code and message
expect(result).toBeErrWith({ 
  code: 'VALIDATION_ERROR', 
  message: 'Email is invalid' 
});

// Match with Error instance
const error = new Error('Something went wrong');
const result2 = ZT.err(error);
expect(result2).toBeErrWith(error);
```

### `toHaveErrorCode(code)`
Asserts that a Result has a specific error code.

```typescript
const result = ZT.err('NOT_FOUND', 'User not found');
expect(result).toHaveErrorCode('NOT_FOUND'); // Passes
expect(result).toHaveErrorCode('SERVER_ERROR'); // Fails
```

### `toHaveErrorMessage(message)`
Asserts that a Result has a specific error message. Supports both string and RegExp matching.

```typescript
const result = ZT.err('ERROR', 'Connection timeout after 30 seconds');

// Exact string match
expect(result).toHaveErrorMessage('Connection timeout after 30 seconds');

// RegExp match
expect(result).toHaveErrorMessage(/timeout after \d+ seconds/);
```

## Examples

### Testing Async Operations with Combinators

```typescript
import '@zerothrow/jest';
import { ZT } from '@zerothrow/core';

async function fetchUser(id: string) {
  return ZT.tryAsync(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error('User not found');
    }
    return response.json();
  });
}

test('fetchUser transforms data correctly', async () => {
  const result = await fetchUser('123')
    .then(r => r
      .map(user => ({ ...user, fetched: true }))
      .tap(user => expect(user.fetched).toBe(true))
    );
    
  expect(result).toBeOk();
  expect(result).toBeOkWith(expect.objectContaining({ 
    id: '123',
    fetched: true 
  }));
});

test('fetchUser provides fallback for errors', async () => {
  const result = await fetchUser('invalid')
    .then(r => r
      .tapErr(err => console.error('Fetch failed:', err))
      .orElse(() => ZT.ok({ id: 'guest', name: 'Guest User' }))
    );
    
  expect(result).toBeOk();
  expect(result).toBeOkWith({ id: 'guest', name: 'Guest User' });
});
```

### Testing Error Codes

```typescript
import '@zerothrow/jest';
import { ZT } from '@zerothrow/core';

function validateEmail(email: string) {
  if (!email) {
    return ZT.err('REQUIRED', 'Email is required');
  }
  if (!email.includes('@')) {
    return ZT.err('INVALID_FORMAT', 'Email must contain @');
  }
  return ZT.ok(email);
}

describe('validateEmail', () => {
  test('validates required field', () => {
    const result = validateEmail('');
    expect(result).toBeErr();
    expect(result).toHaveErrorCode('REQUIRED');
    expect(result).toHaveErrorMessage('Email is required');
  });

  test('validates format', () => {
    const result = validateEmail('notanemail');
    expect(result).toBeErrWith({ 
      code: 'INVALID_FORMAT',
      message: 'Email must contain @'
    });
  });

  test('transforms valid emails', () => {
    const result = validateEmail('USER@EXAMPLE.COM')
      .map(email => email.toLowerCase())
      .map(email => ({ email, domain: email.split('@')[1] }))
      .tap(data => expect(data.domain).toBe('example.com'));
      
    expect(result).toBeOk();
    expect(result).toBeOkWith({ 
      email: 'user@example.com',
      domain: 'example.com' 
    });
  });
  
  test('chains multiple validations', () => {
    const validateAndNormalize = (email: string) => 
      validateEmail(email)
        .andThen(email => {
          if (email.endsWith('.test')) {
            return ZT.err('TEST_EMAIL', 'Test emails not allowed');
          }
          return ZT.ok(email);
        })
        .map(email => email.replace(/\+.*@/, '@')); // Remove plus addressing
        
    const result = validateAndNormalize('user+tag@example.com');
    expect(result).toBeOkWith('user@example.com');
    
    const testResult = validateAndNormalize('user@example.test');
    expect(testResult).toHaveErrorCode('TEST_EMAIL');
  });
});
```

### Testing with Custom Error Types and Combinators

```typescript
import '@zerothrow/jest';
import { ZT, ZeroThrow } from '@zerothrow/core';

class ValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function processData(data: unknown) {
  if (!data) {
    return ZT.err(new ValidationError('EMPTY_DATA', 'No data provided'));
  }
  return ZT.ok(data);
}

test('transforms and validates data', () => {
  const pipeline = (input: unknown) => processData(input)
    .andThen(data => {
      if (typeof data !== 'object') {
        return ZT.err(new ValidationError('INVALID_TYPE', 'Expected object'));
      }
      return ZT.ok(data);
    })
    .map(obj => ({ ...obj, processed: true }))
    .tap(result => console.log('Processed:', result));
    
  const result = pipeline({ value: 42 });
  expect(result).toBeOk();
  expect(result).toBeOkWith({ value: 42, processed: true });
});

test('chains error handling', () => {
  const result = processData(null)
    .mapErr(err => new ValidationError('WRAPPED', `Wrapped: ${err.message}`))
    .tapErr(err => expect(err.code).toBe('WRAPPED'));
    
  expect(result).toBeErr();
  expect(result).toHaveErrorMessage(/Wrapped: No data provided/);
});

test('collects multiple validations', () => {
  const results = ZeroThrow.collect([
    processData({ id: 1 }),
    processData({ id: 2 }),
    processData(null)
  ]);
  
  expect(results).toBeErr();
  expect(results).toHaveErrorCode('EMPTY_DATA');
});
```

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT