# @zerothrow/core

The foundational library for type-safe error handling in TypeScript. Zero dependencies, zero throws.

## Installation

```bash
npm install @zerothrow/core
```

## Quick Start

```typescript
import { ZT } from '@zerothrow/core'

// Simple error handling
const result = ZT.try(() => {
  // Your potentially throwing code
  return JSON.parse(data)
})

if (result.isOk) {
  console.log('Success:', result.value)
} else {
  console.log('Error:', result.error)
}

// Create results manually
const success = ZT.ok(42)
const failure = ZT.err(new Error('Something went wrong'))
```

## Advanced Usage

```typescript
import { ZeroThrow } from '@zerothrow/core'

// Async operations
const asyncResult = await ZeroThrow.fromAsync(async () => {
  const response = await fetch('/api/data')
  return response.json()
})

// Chaining operations
const processed = asyncResult
  .map(data => data.items)
  .flatMap(items => 
    items.length > 0 
      ? ZT.ok(items[0]) 
      : ZT.err(new Error('No items'))
  )

// Batch operations
const results = await ZeroThrow.collect([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
])
```

## API Reference

### ZT (Pocket Knife API)

- `ZT.try(fn)` - Wrap a potentially throwing function
- `ZT.ok(value)` - Create a success result
- `ZT.err(error)` - Create a failure result

### ZeroThrow (Full API)

- `ZeroThrow.attempt()` - Advanced try with overloads
- `ZeroThrow.wrap()` - Wrap promises
- `ZeroThrow.fromAsync()` - Handle async functions
- `ZeroThrow.pipe()` - Compose operations
- `ZeroThrow.collect()` - Handle multiple results

## Platform Support

This package includes platform abstractions for both Node.js and Deno environments.

## License

MIT

## More Information

For detailed documentation and examples, visit the [ZeroThrow Documentation](https://github.com/zerothrow/zerothrow).