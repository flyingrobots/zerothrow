# @zerothrow/resilience

Production-grade resilience patterns for TypeScript applications using ZeroThrow's Result type.

## Features

- 🚀 **Zero Exceptions** - All policies return `Result<T,E>`, never throw
- 🎯 **Type-Safe** - Full TypeScript support with preserved error types  
- 🔧 **Composable** - Combine policies for defense in depth
- ⚡ **Zero Dependencies** - Only peer dependency is @zerothrow/core
- 🧪 **Testable** - Includes TestClock for deterministic testing

## Installation

```bash
npm install @zerothrow/resilience @zerothrow/core
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

## License

MIT