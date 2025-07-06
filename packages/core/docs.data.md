### badge
![npm](https://img.shields.io/npm/v/@zerothrow/core)

### description
Core ZeroThrow functionality - Rust-style Result<T,E> for TypeScript

### version
0.1.0

### quickstart
```typescript
import { ZT } from '@zerothrow/core';

// Wrap throwing functions
const result = ZT.try(() => JSON.parse(input));

// Create results explicitly
const ok = ZT.ok(42);
const err = ZT.err('INVALID_INPUT');

// Chain operations
const final = result
  .map(data => data.value)
  .andThen(value => value > 0 ? ZT.ok(value) : ZT.err('NEGATIVE'))
  .match({
    ok: v => `Success: ${v}`,
    err: e => `Error: ${e.message}`
  });
```

### api
- `ZT.try(fn)` - Wrap a throwing function
- `ZT.tryAsync(asyncFn)` - Wrap an async function
- `ZT.ok(value)` - Create a success result
- `ZT.err(error)` - Create an error result
- `Result.map(fn)` - Transform success value
- `Result.mapErr(fn)` - Transform error value
- `Result.andThen(fn)` - Chain operations
- `Result.match(handlers)` - Pattern match on result

### examples
See the [examples directory](https://github.com/zerothrow/zerothrow/tree/main/examples) for full examples.
