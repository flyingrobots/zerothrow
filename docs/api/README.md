# ZeroThrow API Reference

Complete API documentation for the ZeroThrow error handling library.

## Table of Contents

- [Core Types](./core-types.md)
- [Core Functions](./core-functions.md)
- [Combinators](./combinators.md)
- [React Integration](./react.md)
- [ESLint Plugin](./eslint.md)
- [Type Utilities](./type-utilities.md)

## Quick Reference

### Creating Results

```typescript
import { ok, err } from '@zerothrow/zerothrow';

// Success
const success = ok(42);

// Error
const failure = err('Something went wrong');
```

### Working with Results

```typescript
import { tryR, wrap } from '@zerothrow/zerothrow';

// Convert async operations
const result = await tryR(async () => {
  const data = await fetchData();
  return data;
});

// Wrap errors with context
const error = wrap(originalError, 'FETCH_ERROR', 'Failed to fetch data', {
  url: 'https://api.example.com',
  timestamp: Date.now()
});
```

### Type Checking

```typescript
if (result.isOk) {
  console.log(result.value); // TypeScript knows this is safe
} else {
  console.error(result.error); // TypeScript knows this is the error
}
```

## Installation

```bash
npm install @zerothrow/zerothrow
```

## Next Steps

- [Learn the core types](./core-types.md)
- [Explore core functions](./core-functions.md)
- [Master combinators](./combinators.md)
- [Integrate with React](./react.md)