# @zerothrow/jest

Jest matchers for ZeroThrow Result types. Write cleaner tests without defaulting to throw!

## Installation

```bash
npm install --save-dev @zerothrow/jest @zerothrow/core
```

## Setup

The matchers are automatically registered when you import the package. Add this to your test setup file or at the top of your test files:

```typescript
import '@zerothrow/jest';
```

Or in your Jest configuration:

```javascript
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['@zerothrow/jest']
};
```

## Available Matchers

### `toBeOk()`

Asserts that a Result is Ok (successful).

```typescript
const result = ZT.ok(42);
expect(result).toBeOk();
```

### `toBeOkWith(value)`

Asserts that a Result is Ok with a specific value.

```typescript
const result = ZT.ok({ id: 1, name: 'Alice' });
expect(result).toBeOkWith({ id: 1, name: 'Alice' });
```

### `toBeErr()`

Asserts that a Result is Err (failed).

```typescript
const result = ZT.err(new Error('Oops'));
expect(result).toBeErr();
```

### `toBeErrWith(error)`

Asserts that a Result is Err with specific error properties.

```typescript
// Match exact error instance
const error = new Error('Oops');
expect(ZT.err(error)).toBeErrWith(error);

// Match by properties
expect(ZT.err('USER_NOT_FOUND', 'User does not exist')).toBeErrWith({
  code: 'USER_NOT_FOUND',
  message: 'User does not exist'
});

// Partial matching
expect(ZT.err('USER_NOT_FOUND')).toBeErrWith({ code: 'USER_NOT_FOUND' });
```

### `toHaveErrorCode(code)`

Asserts that an Err Result has a specific error code.

```typescript
const result = ZT.err('VALIDATION_ERROR', 'Invalid input');
expect(result).toHaveErrorCode('VALIDATION_ERROR');
```

### `toHaveErrorMessage(message)`

Asserts that an Err Result has a specific error message. Supports both string and RegExp matching.

```typescript
// Exact match
expect(ZT.err(new Error('Something went wrong'))).toHaveErrorMessage('Something went wrong');

// Regex match
expect(ZT.err(new Error('User 123 not found'))).toHaveErrorMessage(/User \d+ not found/);
```

## Usage Examples

### Basic Usage

```typescript
import { expect, test } from '@jest/globals';
import { ZT, ZeroThrow } from '@zerothrow/core';
import '@zerothrow/jest';

function divide(a: number, b: number): ZeroThrow.Result<number> {
  if (b === 0) {
    return ZT.err('DIV_BY_ZERO', 'Cannot divide by zero');
  }
  return ZT.ok(a / b);
}

test('divide function', () => {
  // Test success
  expect(divide(10, 2)).toBeOkWith(5);
  
  // Test failure
  expect(divide(10, 0)).toBeErr();
  expect(divide(10, 0)).toHaveErrorCode('DIV_BY_ZERO');
  expect(divide(10, 0)).toHaveErrorMessage('Cannot divide by zero');
});
```

### Async Operations

```typescript
test('async operations', async () => {
  async function fetchUser(id: number): Promise<ZeroThrow.Result<User>> {
    if (id === 0) {
      return ZT.err('INVALID_ID', 'ID must be positive');
    }
    return ZT.ok({ id, name: 'Alice' });
  }

  await expect(fetchUser(1)).resolves.toBeOkWith({ id: 1, name: 'Alice' });
  await expect(fetchUser(0)).resolves.toBeErr();
  await expect(fetchUser(0)).resolves.toHaveErrorCode('INVALID_ID');
});
```

### Negation

All matchers support negation with `.not`:

```typescript
expect(ZT.ok(42)).not.toBeErr();
expect(ZT.err('ERROR')).not.toBeOk();
expect(ZT.err('ERROR')).not.toHaveErrorCode('DIFFERENT_ERROR');
```

## TypeScript Support

Full TypeScript support with type inference:

```typescript
const result: ZeroThrow.Result<number, CustomError> = getResult();

// TypeScript knows these are valid
expect(result).toBeOk();
expect(result).toBeOkWith(42);
expect(result).toBeErr();
```

## Why These Matchers?

Without these matchers, testing Result types requires verbose code:

```typescript
// ❌ Without @zerothrow/jest
const result = divide(10, 0);
expect(result.ok).toBe(false);
if (!result.ok) {
  expect(result.error.code).toBe('DIV_BY_ZERO');
  expect(result.error.message).toBe('Cannot divide by zero');
}

// ✅ With @zerothrow/jest
expect(divide(10, 0)).toBeErrWith({
  code: 'DIV_BY_ZERO',
  message: 'Cannot divide by zero'
});
```

## License

MIT