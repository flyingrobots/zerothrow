# @zerothrow/resilience

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/resilience)
![types](https://img.shields.io/npm/types/@zerothrow/resilience)
![size](https://packagephobia.com/badge?p=@zerothrow/resilience)

Production-grade resilience patterns for TypeScript applications using ZeroThrow's Result type.

> ⚠️ **Status:** Alpha (v0.1.0) – API may change until v1.0. [See roadmap](#roadmap)

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/**** – ecosystem packages (resilience, jest, etc)

**[📚 Full Documentation](https://github.com/zerothrow/zerothrow/tree/main/docs) | [🗺️ Ecosystem Overview](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)**

## Features

- 🚀 **Zero Exceptions** - All policies return `Result<T,E>`, never throw
- 🎯 **Type-Safe** - Full TypeScript support with preserved error types  
- 🔧 **Composable** - Combine policies for defense in depth
- ⚡ **No runtime deps** - Peer dependency: @zerothrow/core
- 🧪 **Testable** - Includes TestClock for deterministic testing

## Which Package Do I Need?

> **Quick Guide:**
> - You only want explicit error handling → `@zerothrow/core`
> - You're calling flaky APIs or databases → add `@zerothrow/resilience` (this package)
> - You write tests → add `@zerothrow/jest` or `@zerothrow/vitest`
> - You use React → watch for `@zerothrow/react` (coming soon)

## Installation

```bash
npm install @zerothrow/resilience @zerothrow/core
# or: pnpm add @zerothrow/resilience @zerothrow/core
```

## Quick Start

```typescript
import { Policy } from '@zerothrow/resilience'

// Create a retry policy
const retryPolicy = Policy.retry(3, { 
  delay: 100, 
  backoff: 'exponential' 
})

// Execute an operation with retry
const result = await retryPolicy.execute(async () => {
  return await fetchDataFromAPI()
})

if (result.ok) {
  console.log('Success:', result.value)
} else {
  console.error('Failed after retries:', result.error)
}
```

## Core Policies

### Retry Policy

```typescript
const policy = Policy.retry(3, {
  delay: 100,              // Base delay in ms
  backoff: 'exponential',  // 'constant' | 'linear' | 'exponential'
  maxDelay: 5000,          // Cap for exponential backoff
  handle: (error) => error.code === 'NETWORK_ERROR' // Optional filter
})
```

### Circuit Breaker

```typescript
const policy = Policy.circuitBreaker({
  threshold: 5,       // Failures before opening
  duration: 30000,    // How long to stay open (ms)
  onOpen: () => console.log('Circuit opened'),
  onClose: () => console.log('Circuit closed')
})
```

### Timeout

```typescript
const policy = Policy.timeout(5000) // 5 second timeout
```

## Policy Composition

```typescript
// Compose multiple policies
const resilientPolicy = Policy.compose(
  Policy.retry(3, { delay: 100 }),
  Policy.circuitBreaker({ threshold: 5, duration: 30000 }),
  Policy.timeout(5000)
)

// Execute with combined policies
const result = await resilientPolicy.execute(async () => {
  return await riskyOperation()
})
```

## Error Types

```typescript
import { 
  RetryExhaustedError, 
  CircuitOpenError, 
  TimeoutError 
} from '@zerothrow/resilience'

if (!result.ok) {
  if (result.error instanceof RetryExhaustedError) {
    console.log(`Failed after ${result.error.attempts} attempts`)
  }
}
```

## Roadmap

### v0.2.0 (Next)
- **Bulkhead Policy** - Limit concurrent operations
- **Hedge Policy** - Race multiple attempts for speed
- **Fallback Policy** - Graceful degradation
- **Policy metrics** - Success/failure rates, latencies

### v0.3.0
- **Adaptive policies** - Self-tuning based on metrics
- **Policy persistence** - Save/restore circuit breaker state
- **Integration examples** - Stripe, OpenAI, database patterns

### v1.0.0
- **Stable API** - No more breaking changes
- **Performance benchmarks** - Prove zero overhead
- **Production guide** - Best practices and patterns

## License

MIT