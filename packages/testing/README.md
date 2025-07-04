# @zerothrow/testing

Unified test matchers for ZeroThrow Result types - supports both Jest and Vitest.

## Installation

```bash
npm install --save-dev @zerothrow/testing
```

## Usage

This package automatically detects your test environment and loads the appropriate matchers.

### Jest

```typescript
import '@zerothrow/testing'
import { ZT } from '@zerothrow/core'

test('user validation', () => {
  const result = validateUser(input)
  
  expect(result).toBeOk()
  expect(result).toBeOkWith({ name: 'Alice' })
})
```

### Vitest

```typescript
import '@zerothrow/testing'
import { ZT } from '@zerothrow/core'
import { expect, test } from 'vitest'

test('user validation', () => {
  const result = validateUser(input)
  
  expect(result).toBeOk()
  expect(result).toBeOkWith({ name: 'Alice' })
})
```

## Available Matchers

- `toBeOk()` - Asserts the Result is Ok
- `toBeErr()` - Asserts the Result is Err
- `toBeOkWith(value)` - Asserts Ok with specific value
- `toBeErrWith(error)` - Asserts Err with specific error
- `toHaveErrorCode(code)` - Asserts error has specific code (for ZeroError)
- `toHaveErrorMessage(message)` - Asserts error has specific message

## License

MIT © ZeroThrow