# @zerothrow/expect

Shared test matcher logic for ZeroThrow Result types. This package provides the core matcher implementations used by test framework adapters like `@zerothrow/jest` and `@zerothrow/vitest`.

## Installation

```bash
npm install --save-dev @zerothrow/expect @zerothrow/core
```

## Usage

This package is primarily used by test framework adapters. If you're writing tests, you should use:
- `@zerothrow/jest` for Jest
- `@zerothrow/vitest` for Vitest
- `@zerothrow/testing` for a unified interface

## API

### Matcher Functions

All matcher functions return a `MatcherResult`:

```typescript
interface MatcherResult {
  pass: boolean;
  message: () => string;
}
```

- `toBeOkMatcher(received, context?)` - Check if Result is Ok
- `toBeOkWithMatcher(received, expected, context)` - Check if Result is Ok with specific value
- `toBeErrMatcher(received, context?)` - Check if Result is Err
- `toBeErrWithMatcher(received, expected, context)` - Check if Result is Err with specific error
- `toHaveErrorCodeMatcher(received, code)` - Check error code
- `toHaveErrorMessageMatcher(received, message)` - Check error message

### Utilities

- `isResult(value)` - Type guard for Result types
- `formatError(error)` - Format errors for display

## License

MIT