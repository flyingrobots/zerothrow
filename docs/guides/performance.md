# Performance Optimization Guide

Optimize your ZeroThrow applications for maximum performance.

## Table of Contents

- [Performance Characteristics](#performance-characteristics)
- [Bundle Size Optimization](#bundle-size-optimization)
- [Runtime Performance](#runtime-performance)
- [Memory Management](#memory-management)
- [Async Patterns](#async-patterns)
- [Benchmarks](#benchmarks)

## Performance Characteristics

### Zero-Cost Abstractions

ZeroThrow is designed to have minimal runtime overhead:

```typescript
// Native try/catch
try {
  const result = riskyOperation();
  return result;
} catch (e) {
  return null;
}

// ZeroThrow - similar performance
const result = tryOperation();
return result.isOk ? result.value : null;
```

### Object Allocation

Results are simple objects with minimal memory footprint:

```typescript
// Ok result - 3 properties
{ isOk: true, isErr: false, value: T }

// Err result - 3 properties  
{ isOk: false, isErr: true, error: E }
```

## Bundle Size Optimization

### Tree Shaking

Import only what you need:

```typescript
// ❌ Imports everything
import * as ZeroThrow from '@flyingrobots/zerothrow';

// ✅ Imports only used functions
import { ok, err, tryR } from '@flyingrobots/zerothrow';
```

### Modular Imports

```typescript
// Core functions only (~1KB)
import { ok, err } from '@flyingrobots/zerothrow';

// Add combinators as needed (~2KB)
import { andThen, map } from '@flyingrobots/zerothrow';

// React hook separately (~1KB)
import { useResult } from '@flyingrobots/zerothrow/react';
```

### Production Build

Ensure your bundler eliminates dead code:

```javascript
// webpack.config.js
module.exports = {
  mode: 'production',
  optimization: {
    usedExports: true,
    sideEffects: false
  }
};

// vite.config.js
export default {
  build: {
    minify: 'terser',
    treeshake: true
  }
};
```

## Runtime Performance

### Avoid Unnecessary Allocations

```typescript
// ❌ Creates intermediate Results
function process(data: Data): Result<ProcessedData, Error> {
  return andThen(
    andThen(
      andThen(ok(data), validate),
      transform
    ),
    finalize
  );
}

// ✅ Early returns avoid allocations
function process(data: Data): Result<ProcessedData, Error> {
  const validated = validate(data);
  if (validated.isErr) return validated;
  
  const transformed = transform(validated.value);
  if (transformed.isErr) return transformed;
  
  return finalize(transformed.value);
}
```

### Optimize Hot Paths

```typescript
// ❌ Type checking on every call
function processResult<T>(result: unknown): T | null {
  if (isResult(result) && result.isOk) {
    return result.value;
  }
  return null;
}

// ✅ Type known at compile time
function processResult<T>(result: Result<T, any>): T | null {
  return result.isOk ? result.value : null;
}
```

### Batch Operations

```typescript
// ❌ Individual async operations
const results = [];
for (const id of ids) {
  const result = await fetchData(id);
  results.push(result);
}

// ✅ Parallel execution
const results = await Promise.all(
  ids.map(id => fetchData(id))
);
```

## Memory Management

### Avoid Memory Leaks

```typescript
// ❌ Retaining large objects in closures
function createProcessor(largeData: LargeData) {
  return (input: string): Result<Output, Error> => {
    // largeData retained even if not used
    return process(input);
  };
}

// ✅ Only retain what's needed
function createProcessor(largeData: LargeData) {
  const necessaryData = extractNecessary(largeData);
  return (input: string): Result<Output, Error> => {
    return process(input, necessaryData);
  };
}
```

### Error Context Size

```typescript
// ❌ Large context objects
return err(new ZeroError(
  'PROCESSING_FAILED',
  'Failed to process',
  error,
  { 
    entireRequest: request, // Could be huge
    fullResponse: response,
    completeState: state
  }
));

// ✅ Minimal context
return err(new ZeroError(
  'PROCESSING_FAILED',
  'Failed to process',
  error,
  {
    requestId: request.id,
    responseStatus: response.status,
    stateVersion: state.version
  }
));
```

### Cleanup Patterns

```typescript
class ResourceManager {
  private resources = new Map<string, Result<Resource, Error>>();
  
  async getResource(id: string): Promise<Result<Resource, Error>> {
    const cached = this.resources.get(id);
    if (cached) return cached;
    
    const result = await tryR(() => loadResource(id));
    
    // Set up cleanup
    if (result.isOk) {
      this.resources.set(id, result);
      
      // Auto-cleanup after timeout
      setTimeout(() => {
        this.resources.delete(id);
        result.value.cleanup?.();
      }, 60000);
    }
    
    return result;
  }
  
  cleanup() {
    for (const [id, result] of this.resources) {
      if (result.isOk) {
        result.value.cleanup?.();
      }
    }
    this.resources.clear();
  }
}
```

## Async Patterns

### Optimize Promise Creation

```typescript
// ❌ Unnecessary Promise wrapping
async function getData(): Promise<Result<Data, Error>> {
  return Promise.resolve(ok(cachedData));
}

// ✅ Direct return when possible
function getData(): Result<Data, Error> | Promise<Result<Data, Error>> {
  if (cached) {
    return ok(cachedData);
  }
  return fetchData();
}
```

### Streaming Results

```typescript
// ❌ Load everything into memory
async function processLargeFile(path: string): Promise<Result<string[], Error>> {
  const content = await readFile(path);
  const lines = content.split('\n');
  return ok(lines);
}

// ✅ Stream processing
async function* processLargeFile(
  path: string
): AsyncGenerator<Result<string, Error>> {
  const stream = createReadStream(path);
  const rl = readline.createInterface({ input: stream });
  
  try {
    for await (const line of rl) {
      yield ok(line);
    }
  } catch (error) {
    yield err(wrap(error, 'STREAM_ERROR', 'Stream processing failed'));
  }
}
```

### Debouncing and Throttling

```typescript
// useResult with debouncing
function useSearchResults(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query]);
  
  return useResult(
    () => query ? searchAPI(debouncedQuery) : Promise.resolve(ok([])),
    [debouncedQuery]
  );
}
```

## Benchmarks

### Micro-benchmarks

```typescript
// Benchmark setup
import { bench, describe } from 'vitest';

describe('Result creation', () => {
  bench('native object', () => {
    const result = { success: true, value: 42 };
  });
  
  bench('Result ok', () => {
    const result = ok(42);
  });
  
  bench('try/catch', () => {
    try {
      const value = 42;
      return value;
    } catch (e) {
      return null;
    }
  });
  
  bench('Result with check', () => {
    const result = ok(42);
    return result.isOk ? result.value : null;
  });
});
```

### Real-world Performance

```typescript
// Measure actual impact
class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  
  async measure<T, E>(
    name: string,
    operation: () => Promise<Result<T, E>>
  ): Promise<Result<T, E>> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      this.record(name, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(name, duration);
      
      return err(error as E);
    }
  }
  
  private record(name: string, duration: number) {
    const metrics = this.metrics.get(name) || [];
    metrics.push(duration);
    
    // Keep last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    this.metrics.set(name, metrics);
  }
  
  getStats(name: string) {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return null;
    
    const sorted = [...metrics].sort((a, b) => a - b);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: metrics.reduce((a, b) => a + b, 0) / metrics.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
}
```

## Best Practices

### 1. Profile Before Optimizing

```typescript
// Use Chrome DevTools or Node.js profiler
console.profile('operation');
const result = await complexOperation();
console.profileEnd('operation');
```

### 2. Cache Expensive Operations

```typescript
const cache = new Map<string, Result<Data, Error>>();

function getCachedData(key: string): Result<Data, Error> {
  const cached = cache.get(key);
  if (cached) return cached;
  
  const result = computeExpensive(key);
  cache.set(key, result);
  return result;
}
```

### 3. Use Lazy Evaluation

```typescript
class LazyResult<T, E> {
  private cached?: Result<T, E>;
  
  constructor(private compute: () => Result<T, E>) {}
  
  get(): Result<T, E> {
    if (!this.cached) {
      this.cached = this.compute();
    }
    return this.cached;
  }
}
```

### 4. Optimize Error Paths

```typescript
// ❌ Creating errors eagerly
function validate(input: unknown): Result<Valid, Error> {
  const errors = [];
  
  if (!input) errors.push(new Error('Input required'));
  if (typeof input !== 'string') errors.push(new Error('Must be string'));
  // ... more validations
  
  return errors.length > 0 ? err(errors[0]) : ok(input as Valid);
}

// ✅ Create errors only when needed
function validate(input: unknown): Result<Valid, Error> {
  if (!input) return err(new Error('Input required'));
  if (typeof input !== 'string') return err(new Error('Must be string'));
  // ... more validations
  
  return ok(input as Valid);
}
```

## Summary

- ZeroThrow adds minimal overhead (< 1% in most cases)
- Bundle size is ~4KB gzipped for full library
- Tree-shaking can reduce to ~1KB for basic usage
- Performance is comparable to native try/catch
- Memory usage is predictable and efficient

For specific performance concerns, profile your application and optimize the hot paths.