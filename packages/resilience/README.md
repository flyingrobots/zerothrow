# @zerothrow/resilience 🛡️

> Battle-tested resilience patterns for ZeroThrow - because failure is not an option, it's a Result.

## Overview

`@zerothrow/resilience` brings production-grade resilience patterns to the ZeroThrow ecosystem. Inspired by Polly (.NET) and resilience4j (Java), but designed from the ground up for TypeScript and the Result pattern.

## Key Features

- 🚀 **Zero Exceptions** - All policies return `Result<T,E>`, never throw
- 🎯 **Type-Safe** - Full TypeScript support with preserved error types  
- 🔧 **Composable** - Combine policies for defense in depth
- 📊 **Observable** - Rich telemetry and monitoring built-in
- ⚡ **Zero-Cost** - No overhead when policies aren't triggered
- 🧪 **Testable** - Deterministic behavior with time control

## Installation

```bash
npm install @zerothrow/resilience
```

## Quick Start

```typescript
import { Policy } from '@zerothrow/resilience'
import { ZT } from '@zerothrow/core'

// Simple retry with exponential backoff
const result = await Policy
  .retry(3, { backoff: 'exponential' })
  .execute(() => fetch('/api/data'))

// Result is always Result<T,E> - never throws!
if (result.ok) {
  console.log('Success:', result.value)
} else {
  console.log('Failed after retries:', result.error)
}
```

## Core Policies

### Retry

Automatically retry failed operations with configurable backoff strategies.

```typescript
// Basic retry
const retryPolicy = Policy.retry(3)

// Advanced retry with exponential backoff
const advancedRetry = Policy
  .handle<NetworkError>() // Only retry network errors
  .retry(5, {
    backoff: 'exponential',
    initialDelay: 100,
    maxDelay: 30000,
    jitter: true // Adds randomization to prevent thundering herd
  })
  .onRetry((attempt, error) => {
    logger.warn(`Retry attempt ${attempt}`, { error })
  })
  .build()
```

### Circuit Breaker

Fail fast when a resource is unavailable, preventing cascade failures.

```typescript
const circuitBreaker = Policy.circuitBreaker({
  threshold: 5,        // Open after 5 failures
  duration: 60000,     // Stay open for 60 seconds
  successThreshold: 2  // Need 2 successes to close
})

// Monitor circuit state
circuitBreaker.onBreak((error) => {
  alerting.send('Circuit opened!', { error })
})

circuitBreaker.onReset(() => {
  logger.info('Circuit closed, resuming normal operation')
})
```

### Timeout

Prevent operations from hanging indefinitely.

```typescript
const timeoutPolicy = Policy.timeout(5000) // 5 second timeout

// Per-attempt timeout (useful with retry)
const perAttemptTimeout = Policy
  .timeout(5000, { perAttempt: true })
  .retry(3) // Each retry gets full 5 seconds
```

### Bulkhead

Isolate resources to prevent exhaustion.

```typescript
const dbBulkhead = Policy.bulkhead({
  maxConcurrent: 10,  // Max 10 concurrent DB operations
  maxQueue: 50        // Queue up to 50 additional requests
})

// Prevents DB connection pool exhaustion
const result = await dbBulkhead.execute(() => 
  db.query('SELECT * FROM users')
)
```

### Fallback

Graceful degradation when all else fails.

```typescript
const withFallback = Policy
  .retry(3)
  .fallback(async () => {
    // Return cached or default data
    return getCachedData() ?? defaultData
  })
```

### Hedge

Race parallel requests for faster responses.

```typescript
const hedgePolicy = Policy.hedge({
  delay: 1000,   // Start parallel request after 1s
  maxHedges: 2   // Max 2 parallel attempts
})

// If first request is slow, races with parallel request
const result = await hedgePolicy.execute(() => slowApi.getData())
```

## Policy Composition

Combine policies for defense in depth:

```typescript
// Method 1: Policy.wrap (explicit order)
const resilientPolicy = Policy.wrap(
  Policy.timeout(10000),         // Outer: Overall timeout
  Policy.retry(3),              // Middle: Retry logic
  Policy.circuitBreaker({       // Inner: Circuit breaker
    threshold: 5,
    duration: 60000
  })
)

// Method 2: Fluent chaining
const resilientApi = Policy
  .handle<ApiError>((err) => err.statusCode >= 500)
  .retry(3, { backoff: 'exponential' })
  .withCircuitBreaker({ threshold: 5 })
  .withTimeout(30000)
  .withBulkhead({ maxConcurrent: 20 })
  .fallback(() => getCachedResponse())
  .build()

// Method 3: Policy algebra (coming soon)
const policy = Policy.retry(3) >> Policy.timeout(5000) >> Policy.fallback(cached)
```

## Advanced Usage

### Error Predicates

Fine-grained control over which errors trigger policies:

```typescript
const policy = Policy
  .handle<HttpError>((err) => err.status >= 500)
  .or<NetworkError>((err) => err.code === 'ECONNRESET')
  .orResult((result) => !result.ok && result.error.retryable)
  .retry(3)
```

### Context Propagation

Thread context through policy executions:

```typescript
interface RequestContext {
  correlationId: string
  userId: string
  attempt?: number
}

const result = await policy.execute(
  (context) => {
    // Context available throughout execution
    return api.call({ 
      headers: { 
        'X-Correlation-ID': context.correlationId 
      } 
    })
  },
  { correlationId: uuid(), userId: currentUser.id }
)
```

### Telemetry & Monitoring

Built-in observability:

```typescript
// Global telemetry
Policy.onEvent((event) => {
  metrics.record({
    policy: event.policyName,
    type: event.type,
    duration: event.duration,
    tags: event.context
  })
})

// Per-policy telemetry
const monitoredPolicy = Policy
  .retry(3)
  .withTelemetry({
    name: 'user-api-calls',
    tags: { service: 'user-service', env: 'prod' },
    onEvent: (event) => telemetry.track(event)
  })
  .build()
```

### Policy Registry

Centralize policy management:

```typescript
// Define policies once
PolicyRegistry.define('standard-api', Policy.wrap(
  Policy.timeout(30000),
  Policy.retry(3, { backoff: 'exponential' }),
  Policy.circuitBreaker({ threshold: 5 })
))

PolicyRegistry.define('critical-api', Policy.wrap(
  Policy.timeout(60000),
  Policy.retry(5, { backoff: 'exponential', maxDelay: 30000 }),
  Policy.circuitBreaker({ threshold: 10, duration: 30000 })
))

// Use anywhere
const result = await PolicyRegistry
  .get('standard-api')
  .execute(() => api.fetchData())
```

### Testing Support

Deterministic testing with time control:

```typescript
import { TestClock, PolicyTestKit } from '@zerothrow/resilience/testing'

test('retry with exponential backoff', async () => {
  const clock = new TestClock()
  const policy = Policy.retry(3, { 
    backoff: 'exponential',
    initialDelay: 1000,
    clock 
  })

  let attempts = 0
  const operation = jest.fn(async () => {
    attempts++
    if (attempts < 3) throw new Error('Failed')
    return 'Success'
  })

  // Start execution
  const promise = policy.execute(operation)
  
  // Verify first attempt
  expect(operation).toHaveBeenCalledTimes(1)
  
  // Advance time to trigger retry
  await clock.advance(1000)
  expect(operation).toHaveBeenCalledTimes(2)
  
  // Advance time for final retry
  await clock.advance(2000)
  expect(operation).toHaveBeenCalledTimes(3)
  
  const result = await promise
  expect(result.ok).toBe(true)
  expect(result.value).toBe('Success')
})

// Test circuit breaker states
test('circuit breaker opens after threshold', async () => {
  const kit = new PolicyTestKit()
  const breaker = kit.createCircuitBreaker({ threshold: 3 })
  
  // Force failures
  await kit.failTimes(breaker, 3)
  
  expect(breaker.state).toBe('open')
  
  // Verify fast failure
  const result = await breaker.execute(() => api.call())
  expect(result.ok).toBe(false)
  expect(result.error.type).toBe('circuit-open')
})
```

## Real-World Examples

### Resilient HTTP Client

```typescript
class ResilientHttpClient {
  private readonly policy: Policy

  constructor() {
    this.policy = Policy
      .handle<HttpError>((err) => err.status >= 500 || err.status === 429)
      .or<NetworkError>()
      .retry(3, {
        backoff: 'exponential',
        initialDelay: 1000,
        onRetry: (attempt, error) => {
          if (error instanceof HttpError && error.status === 429) {
            // Respect rate limit headers
            const retryAfter = error.headers['retry-after']
            return retryAfter ? parseInt(retryAfter) * 1000 : undefined
          }
        }
      })
      .withCircuitBreaker({
        threshold: 5,
        duration: 60000,
        handle: (err) => err instanceof HttpError && err.status === 503
      })
      .withTimeout(30000)
      .build()
  }

  async get<T>(url: string): Promise<Result<T, HttpError>> {
    return this.policy.execute(async () => {
      const response = await fetch(url)
      if (!response.ok) {
        return ZT.err(new HttpError(response.status, response.headers))
      }
      const data = await response.json()
      return ZT.ok(data as T)
    })
  }
}
```

### Database with Bulkhead Isolation

```typescript
class ResilientDatabase {
  private policies = {
    read: Policy.bulkhead({ maxConcurrent: 50 }),
    write: Policy.bulkhead({ maxConcurrent: 10 }),
    transaction: Policy.bulkhead({ maxConcurrent: 5 })
  }

  async query<T>(sql: string): Promise<Result<T[], DatabaseError>> {
    return this.policies.read.execute(() =>
      Policy
        .retry(3, { 
          handle: (err: DatabaseError) => err.code === 'DEADLOCK' 
        })
        .execute(() => this.db.query<T>(sql))
    )
  }

  async transaction<T>(
    fn: (trx: Transaction) => Promise<T>
  ): Promise<Result<T, DatabaseError>> {
    return this.policies.transaction.execute(() =>
      Policy
        .retry(3, {
          handle: (err: DatabaseError) => 
            err.code === 'DEADLOCK' || err.code === 'SERIALIZATION_FAILURE',
          backoff: 'exponential',
          initialDelay: 50
        })
        .execute(() => this.db.transaction(fn))
    )
  }
}
```

### Microservice Communication

```typescript
class ServiceClient {
  private policies = new Map<string, Policy>()

  constructor(private serviceName: string) {
    // Different policies for different criticality
    this.policies.set('critical', Policy.wrap(
      Policy.timeout(60000),
      Policy.retry(5, { backoff: 'exponential', maxDelay: 30000 }),
      Policy.circuitBreaker({ threshold: 10, duration: 30000 })
    ))

    this.policies.set('standard', Policy.wrap(
      Policy.timeout(30000),
      Policy.retry(3, { backoff: 'exponential' }),
      Policy.circuitBreaker({ threshold: 5, duration: 60000 })
    ))

    this.policies.set('optional', Policy.wrap(
      Policy.timeout(5000),
      Policy.retry(1),
      Policy.fallback(() => ZT.ok(null))
    ))
  }

  async call<T>(
    method: string, 
    params: any, 
    criticality: 'critical' | 'standard' | 'optional' = 'standard'
  ): Promise<Result<T, ServiceError>> {
    const policy = this.policies.get(criticality)!
    
    return policy.execute(
      async (context) => {
        const response = await rpc.call(this.serviceName, method, {
          ...params,
          headers: {
            'X-Correlation-ID': context.correlationId,
            'X-Attempt': context.attempt
          }
        })
        
        return response
      },
      { correlationId: uuid(), attempt: 0 }
    )
  }
}
```

## Performance

Zero-cost abstractions ensure policies add no overhead when not triggered:

```typescript
// Fast path - no policy overhead on success
const result = await policy.execute(fastOperation)
// If fastOperation succeeds, policy code is never executed

// Policies are lazily instantiated
const spec = Policy.retry(3) // Just configuration
const instance = spec.build() // Actual instantiation

// Identical policies are interned
const p1 = Policy.retry(3, { backoff: 'exponential' })
const p2 = Policy.retry(3, { backoff: 'exponential' })
// p1 === p2 (same instance)
```

## Integration with ZeroThrow

Deep integration with Result types:

```typescript
// Extension methods (coming soon)
const result = await ZT
  .tryAsync(() => fetchUser(id))
  .retry(Policy.retry(3))
  .timeout(5000)
  .fallback(() => getCachedUser(id))

// Policy-aware combinators
const results = await ZT.collectAsync(
  userIds.map(id => fetchUser(id)),
  { 
    policy: Policy.retry(2),
    concurrency: 5 
  }
)

// Result-aware policies
const policy = Policy
  .handleResult<User, ApiError>((result) => 
    !result.ok && result.error.retryable
  )
  .retry(3)
```

## License

MIT © ZeroThrow Contributors