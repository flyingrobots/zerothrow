# ZeroThrow Performance Guide

## Overview

This document outlines the performance characteristics of the ZeroThrow library and the optimizations implemented to ensure minimal overhead while maintaining developer ergonomics.

## Installation Requirements

### Memory Profiling

The memory profiling tools require Node.js to be run with the `--expose-gc` flag to enable manual garbage collection:

```bash
node --expose-gc benchmark/run-memory-profile.ts
```

This flag is automatically included in the shebang of the memory profiling scripts, but if you run them directly or in CI, ensure this flag is set.

## Performance Improvements

### 1. Synchronous Operations - `tryRSync`

The original `tryR` function always returned a Promise, even for synchronous operations. This introduced unnecessary overhead for sync functions.

```typescript
// Before: Always async
const result = await tryR(() => 42); // Returns Promise<Result<number>>

// After: Sync option available
const result = tryRSync(() => 42); // Returns Result<number> directly
```

**Performance gain**: 5.28x faster for synchronous operations

### 2. Smart Async Detection in `tryR`

The optimized `tryR` now detects whether the function returns a Promise and handles it accordingly, reducing overhead for sync functions while maintaining backward compatibility.

```typescript
export function tryR<T>(
  fn: () => T | Promise<T>,
  map?: (e: ZeroError) => ZeroError
): Promise<Result<T, ZeroError>> {
  // Detects if result is a Promise and handles appropriately
}
```

### 3. Optimized Error Normalization

The error normalization function now checks if an error already has ZeroError-like properties before creating a new instance.

```typescript
// Avoids creating new errors when possible
if ('code' in e && typeof e.code === 'string' && 'context' in e) {
  return e as ZeroError;
}
```

### 4. Batch Operations - `tryRBatch`

For scenarios where multiple operations need to be executed, `tryRBatch` provides better performance than sequential `tryR` calls.

```typescript
const results = await tryRBatch([
  () => operation1(),
  () => operation2(),
  async () => operation3()
]);
```

**Performance gain**: 1.53x faster than sequential operations

## Benchmark Results

### Core Operations

| Operation | Performance | Notes |
|-----------|-------------|-------|
| `ok()` | 18.2M ops/sec | Minimal overhead |
| `err()` | 353K ops/sec | Error object creation cost |
| `tryRSync` | 21.6M ops/sec | Near-native performance |
| `tryR` (async) | 5.2M ops/sec | Promise overhead included |

### Memory Usage

| Operation | Memory per call |
|-----------|-----------------|
| `ok()` | ~0.03 bytes |
| `err()` | ~0.07 bytes |
| `ZeroError` creation | ~1.53 bytes |
| `tryR` success | ~0.72 bytes |
| `tryR` failure | ~1.30 bytes |

### Comparison with Other Libraries

When compared to other error handling libraries:

- **Pattern matching**: On par with fp-ts and neverthrow
- **Async error handling**: Competitive with neverthrow
- **Memory efficiency**: Room for improvement in batch operations
- **Developer ergonomics**: Superior with zero-throw discipline

## Best Practices for Performance

### 1. Use `tryRSync` for Synchronous Code

```typescript
// ❌ Don't use async tryR for sync operations
const result = await tryR(() => computeSync());

// ✅ Use tryRSync for better performance
const result = tryRSync(() => computeSync());
```

### 2. Batch Operations When Possible

```typescript
// ❌ Sequential operations
const results = [];
for (const item of items) {
  const result = await tryR(() => process(item));
  results.push(result);
}

// ✅ Batch operations
const results = await tryRBatch(items.map(item => () => process(item)));
```

### 3. Reuse Error Instances When Appropriate

```typescript
// ❌ Creating new errors in hot paths
for (const item of items) {
  if (!isValid(item)) {
    return err(new ZeroError('INVALID_ITEM', 'Item is invalid'));
  }
}

// ✅ Reuse error instances
const INVALID_ITEM_ERROR = new ZeroError('INVALID_ITEM', 'Item is invalid');
for (const item of items) {
  if (!isValid(item)) {
    return err(INVALID_ITEM_ERROR);
  }
}
```

### 4. Avoid Unnecessary Error Wrapping

```typescript
// ❌ Wrapping errors that are already ZeroErrors
const result = tryRSync(() => {
  throw new ZeroError('KNOWN_ERROR', 'This is expected');
});

// The error normalization will detect and reuse the ZeroError instance
```

## Running Benchmarks

To run the performance benchmarks:

```bash
# Run all benchmarks
npm run bench

# Run specific benchmark file
npx vitest bench benchmark/result.bench.ts --run

# Run memory profiling
npx tsx --expose-gc benchmark/run-memory-profile.ts
```

## Future Optimization Opportunities

1. **Error Pooling**: Implement object pooling for frequently created errors
2. **Lazy Error Messages**: Defer error message formatting until needed
3. **Compile-time Optimizations**: Leverage TypeScript transformers for zero-cost abstractions
4. **WASM Implementation**: Core operations in WebAssembly for critical paths

## Conclusion

ZeroThrow prioritizes developer experience and type safety while maintaining competitive performance. The optimizations implemented ensure that the zero-throw discipline doesn't come with significant runtime overhead. For most applications, the performance characteristics are more than adequate, and the benefits in error handling clarity and type safety outweigh any minor performance differences with native error handling.