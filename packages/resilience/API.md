# @zerothrow/resilience API Reference

## Table of Contents

- [Policy Factory](#policy-factory)
- [Retry Policy](#retry-policy)
- [Circuit Breaker Policy](#circuit-breaker-policy)
- [Timeout Policy](#timeout-policy)
- [Bulkhead Policy](#bulkhead-policy)
- [Fallback Policy](#fallback-policy)
- [Hedge Policy](#hedge-policy)
- [Policy Composition](#policy-composition)
- [Policy Registry](#policy-registry)
- [Telemetry](#telemetry)
- [Testing Utilities](#testing-utilities)

## Policy Factory

### `Policy.retry()`

Creates a retry policy that automatically retries failed operations.

```typescript
Policy.retry(count: number, options?: RetryOptions): RetryPolicy

interface RetryOptions<E = Error> {
  // Backoff strategy
  backoff?: 'constant' | 'linear' | 'exponential' | 'jittered'
  
  // Delay configuration
  delay?: number | ((attempt: number) => number)  // Default: 1000ms
  initialDelay?: number                           // For exponential backoff
  maxDelay?: number                               // Default: 30000ms
  
  // Error handling
  handle?: (error: E) => boolean                  // Which errors to retry
  
  // Callbacks
  onRetry?: (attempt: number, error: E, context?: any) => void
}
```

**Examples:**

```typescript
// Simple retry with default settings
const simple = Policy.retry(3)

// Exponential backoff with jitter
const exponential = Policy.retry(5, {
  backoff: 'jittered',
  initialDelay: 100,
  maxDelay: 30000,
  onRetry: (attempt, error) => logger.warn(`Retry ${attempt}:`, error)
})

// Custom delay function
const custom = Policy.retry(3, {
  delay: (attempt) => attempt * 1000 // 1s, 2s, 3s
})

// Selective retry
const selective = Policy.retry(3, {
  handle: (error) => error.code === 'NETWORK_ERROR'
})
```

### `Policy.retryForever()`

Creates a retry policy that retries indefinitely.

```typescript
Policy.retryForever(options?: Omit<RetryOptions, 'count'>): RetryPolicy
```

### `Policy.circuitBreaker()`

Creates a circuit breaker that fails fast when a threshold is exceeded.

```typescript
Policy.circuitBreaker(options: CircuitBreakerOptions): CircuitBreakerPolicy

interface CircuitBreakerOptions<E = Error> {
  // Failure threshold
  threshold: number              // Failures before opening
  duration: number              // How long to stay open (ms)
  
  // Recovery
  successThreshold?: number     // Successes to close (default: 1)
  
  // Time window
  bucketSize?: number          // Window for counting failures
  
  // Error handling  
  handle?: (error: E) => boolean
  
  // State change callbacks
  onBreak?: (error: E) => void
  onReset?: () => void
  onHalfOpen?: () => void
}
```

**Examples:**

```typescript
// Basic circuit breaker
const basic = Policy.circuitBreaker({
  threshold: 5,
  duration: 60000 // 1 minute
})

// Advanced configuration
const advanced = Policy.circuitBreaker({
  threshold: 10,
  duration: 30000,
  successThreshold: 3,  // Need 3 successes to close
  bucketSize: 60000,    // Count failures in 1-minute windows
  handle: (error) => error.status >= 500,
  onBreak: (error) => alerting.circuitOpen('api-service', error),
  onReset: () => logger.info('Circuit closed')
})
```

### `Policy.timeout()`

Creates a timeout policy that cancels operations exceeding a time limit.

```typescript
Policy.timeout(ms: number, options?: TimeoutOptions): TimeoutPolicy

interface TimeoutOptions {
  // Apply timeout per retry attempt
  perAttempt?: boolean
  
  // Custom timeout error
  timeoutError?: (elapsed: number) => Error
  
  // Cancellation
  cancelToken?: CancelToken
  
  // Callbacks
  onTimeout?: (elapsed: number) => void
}
```

**Examples:**

```typescript
// Simple timeout
const simple = Policy.timeout(5000) // 5 seconds

// Per-attempt timeout with retry
const perAttempt = Policy
  .timeout(5000, { perAttempt: true })
  .retry(3) // Each retry gets 5 seconds

// Custom timeout handling
const custom = Policy.timeout(10000, {
  timeoutError: (elapsed) => new Error(`Operation timed out after ${elapsed}ms`),
  onTimeout: (elapsed) => metrics.record('timeout', { elapsed })
})
```

### `Policy.bulkhead()`

Creates a bulkhead policy that limits concurrent executions.

```typescript
Policy.bulkhead(options: BulkheadOptions): BulkheadPolicy

interface BulkheadOptions {
  // Concurrency limits
  maxConcurrent: number
  maxQueue?: number      // Default: 0 (no queue)
  
  // Queue behavior
  queueTimeout?: number  // Max time in queue
  
  // Callbacks
  onRejected?: () => void
  onQueued?: () => void
}
```

**Examples:**

```typescript
// Basic bulkhead
const basic = Policy.bulkhead({ maxConcurrent: 10 })

// With queue
const withQueue = Policy.bulkhead({
  maxConcurrent: 10,
  maxQueue: 50,
  queueTimeout: 5000,
  onRejected: () => metrics.increment('bulkhead.rejected')
})

// Resource isolation
const policies = {
  database: Policy.bulkhead({ maxConcurrent: 20 }),
  api: Policy.bulkhead({ maxConcurrent: 50 }),
  cache: Policy.bulkhead({ maxConcurrent: 100 })
}
```

### `Policy.fallback()`

Creates a fallback policy that provides alternative values on failure.

```typescript
Policy.fallback<T>(fallback: T | (() => T | Promise<T>)): FallbackPolicy

interface FallbackOptions<T> {
  // Conditional fallback
  handle?: (error: Error) => boolean
  
  // Callbacks
  onFallback?: (error: Error) => void
}
```

**Examples:**

```typescript
// Static fallback
const static = Policy.fallback({ data: 'default' })

// Dynamic fallback
const dynamic = Policy.fallback(() => getCachedData())

// Async fallback
const async = Policy.fallback(async () => {
  const cached = await cache.get('key')
  return cached ?? defaultValue
})

// Conditional fallback
const conditional = Policy.fallback(
  () => getBackupData(),
  { 
    handle: (error) => error.code === 'NOT_FOUND',
    onFallback: (error) => logger.warn('Using fallback:', error)
  }
)
```

### `Policy.hedge()`

Creates a hedge policy that races multiple attempts.

```typescript
Policy.hedge(options: HedgeOptions): HedgePolicy

interface HedgeOptions {
  // Hedge timing
  delay: number | ((attempt: number) => number)
  maxHedges: number
  
  // Callbacks
  onHedge?: (attempt: number) => void
}
```

**Examples:**

```typescript
// Basic hedge
const basic = Policy.hedge({
  delay: 1000,    // Start parallel request after 1s
  maxHedges: 2    // Max 2 parallel attempts
})

// Progressive hedge
const progressive = Policy.hedge({
  delay: (attempt) => attempt * 500, // 500ms, 1000ms, 1500ms
  maxHedges: 3,
  onHedge: (attempt) => logger.info(`Starting hedge attempt ${attempt}`)
})
```

## Policy Composition

### `Policy.wrap()`

Combines multiple policies with explicit nesting order.

```typescript
Policy.wrap(...policies: Policy[]): Policy
```

**Example:**

```typescript
// Order matters! Outer policies wrap inner ones
const resilient = Policy.wrap(
  Policy.timeout(30000),           // Outermost: total timeout
  Policy.retry(3, {                // Middle: retry with backoff
    backoff: 'exponential'
  }),
  Policy.circuitBreaker({          // Innermost: circuit breaker
    threshold: 5,
    duration: 60000
  })
)

// Execution flow:
// 1. Start 30s timeout
// 2. Retry up to 3 times
// 3. Each retry checks circuit breaker
// 4. If circuit is closed, execute operation
```

### `Policy.handle()`

Creates a policy builder with error type constraints.

```typescript
Policy.handle<TError>(): PolicyBuilder<TError>

interface PolicyBuilder<TError> {
  // Add more error types
  or<TOther>(): PolicyBuilder<TError | TOther>
  
  // Add error predicate
  handle(predicate: (error: Error) => boolean): PolicyBuilder<TError>
  
  // Build policies
  retry(count: number, options?: RetryOptions): Policy
  circuitBreaker(options: CircuitBreakerOptions): Policy
  // ... other policies
}
```

**Example:**

```typescript
const policy = Policy
  .handle<NetworkError>()
  .or<TimeoutError>()
  .or((error) => error.code === 'ECONNRESET')
  .retry(3, { backoff: 'exponential' })
  .build()
```

### Conditional Policies

```typescript
Policy.when(
  condition: (context?: any) => boolean,
  whenTrue: Policy,
  whenFalse?: Policy
): Policy
```

**Example:**

```typescript
const policy = Policy.when(
  (ctx) => ctx.priority === 'high',
  Policy.retry(5, { backoff: 'exponential' }),
  Policy.retry(2, { backoff: 'constant' })
)
```

## Policy Execution

### `execute()`

Executes an operation with the policy.

```typescript
// Async execution
policy.execute<T>(
  operation: () => Promise<T> | T,
  context?: any
): Promise<Result<T, Error>>

// Sync execution
policy.executeSync<T>(
  operation: () => T,
  context?: any
): Result<T, Error>

// Result-aware execution
policy.executeResult<T, E>(
  operation: () => Promise<Result<T, E>> | Result<T, E>,
  context?: any
): Promise<Result<T, E | PolicyError>>
```

**Examples:**

```typescript
// Simple execution
const result = await policy.execute(() => fetchData())

// With context
const result = await policy.execute(
  (ctx) => api.call({ correlationId: ctx.correlationId }),
  { correlationId: uuid(), userId: currentUser.id }
)

// Result-aware
const result = await policy.executeResult(() => 
  ZT.tryAsync(async () => {
    const response = await fetch('/api/data')
    if (!response.ok) throw new Error('Failed')
    return response.json()
  })
)
```

## Policy Registry

### `PolicyRegistry.define()`

Registers a named policy for reuse.

```typescript
PolicyRegistry.define(name: string, policy: Policy): void
```

### `PolicyRegistry.get()`

Retrieves a registered policy.

```typescript
PolicyRegistry.get(name: string): Policy
```

### `PolicyRegistry.list()`

Lists all registered policies.

```typescript
PolicyRegistry.list(): string[]
```

**Example:**

```typescript
// Define policies once
PolicyRegistry.define('api-standard', Policy.wrap(
  Policy.timeout(30000),
  Policy.retry(3, { backoff: 'exponential' }),
  Policy.circuitBreaker({ threshold: 5, duration: 60000 })
))

PolicyRegistry.define('api-critical', Policy.wrap(
  Policy.timeout(60000),
  Policy.retry(5, { backoff: 'exponential', maxDelay: 30000 }),
  Policy.circuitBreaker({ threshold: 10, duration: 30000 })
))

// Use anywhere
const result = await PolicyRegistry
  .get('api-standard')
  .execute(() => api.fetchUser(id))
```

## Telemetry

### Global Events

```typescript
Policy.onEvent(handler: PolicyEventHandler): () => void

type PolicyEventHandler = (event: PolicyEvent) => void

interface PolicyEvent {
  id: string
  type: PolicyEventType
  timestamp: Date
  policyName: string
  duration?: number
  context?: any
  error?: Error
  metadata?: Record<string, any>
}
```

### Policy-Specific Telemetry

```typescript
policy.withTelemetry(options: TelemetryOptions): Policy

interface TelemetryOptions {
  name?: string
  tags?: Record<string, any>
  onEvent?: PolicyEventHandler
  includeContext?: boolean
}
```

**Example:**

```typescript
// Global telemetry
const unsubscribe = Policy.onEvent((event) => {
  telemetry.track(event.type, {
    policy: event.policyName,
    duration: event.duration,
    error: event.error?.message,
    ...event.metadata
  })
})

// Per-policy telemetry
const monitoredPolicy = policy.withTelemetry({
  name: 'user-api',
  tags: { service: 'user-service', env: 'production' },
  onEvent: (event) => {
    if (event.type === 'circuit-open') {
      pagerDuty.trigger('Circuit breaker opened', event)
    }
  }
})
```

## Testing Utilities

### `TestClock`

Controls time in tests.

```typescript
class TestClock implements Clock {
  now(): Date
  sleep(ms: number): Promise<void>
  advance(ms: number): void
  setTime(time: Date | number): void
}
```

### `PolicyTestKit`

Utilities for testing policies.

```typescript
class PolicyTestKit {
  constructor(clock?: TestClock)
  
  // Create policies with test clock
  createRetryPolicy(options?: Partial<RetryOptions>): RetryPolicy
  createCircuitBreaker(options?: Partial<CircuitBreakerOptions>): CircuitBreakerPolicy
  createTimeoutPolicy(ms: number, options?: TimeoutOptions): TimeoutPolicy
  
  // Test helpers
  failTimes(policy: Policy, times: number, error?: Error): Promise<void>
  succeedTimes(policy: Policy, times: number, value?: any): Promise<void>
  
  // Assertions
  assertPolicyState(policy: Policy, expected: PolicyState): void
}
```

**Example:**

```typescript
import { TestClock, PolicyTestKit } from '@zerothrow/resilience/testing'

test('retry with exponential backoff', async () => {
  const clock = new TestClock()
  const kit = new PolicyTestKit(clock)
  
  const policy = kit.createRetryPolicy({
    count: 3,
    backoff: 'exponential',
    initialDelay: 1000
  })
  
  let attempts = 0
  const operation = jest.fn(async () => {
    attempts++
    if (attempts < 3) throw new Error('Fail')
    return 'Success'
  })
  
  // Start execution
  const promise = policy.execute(operation)
  
  // First attempt fails immediately
  expect(operation).toHaveBeenCalledTimes(1)
  
  // Advance time for first retry (1000ms)
  await clock.advance(1000)
  expect(operation).toHaveBeenCalledTimes(2)
  
  // Advance time for second retry (2000ms)
  await clock.advance(2000)
  expect(operation).toHaveBeenCalledTimes(3)
  
  // Verify success
  const result = await promise
  expect(result.ok).toBe(true)
  expect(result.value).toBe('Success')
})

test('circuit breaker opens after threshold', async () => {
  const kit = new PolicyTestKit()
  const breaker = kit.createCircuitBreaker({
    threshold: 3,
    duration: 60000
  })
  
  // Fail 3 times to open circuit
  await kit.failTimes(breaker, 3)
  
  // Verify circuit is open
  kit.assertPolicyState(breaker, { state: 'open' })
  
  // Next call fails fast
  const result = await breaker.execute(() => 'should not execute')
  expect(result.ok).toBe(false)
  expect(result.error.type).toBe('circuit-open')
})
```

## Error Types

All policy errors extend the base `PolicyError`:

```typescript
interface PolicyError extends Error {
  type: PolicyErrorType
  policyName: string
  context?: any
}

// Specific error types
type PolicyErrorType =
  | 'retry-exhausted'
  | 'circuit-open'
  | 'timeout'
  | 'bulkhead-rejected'
  | 'hedge-failed'
```

### RetryExhaustedError

```typescript
interface RetryExhaustedError extends PolicyError {
  type: 'retry-exhausted'
  attempts: number
  errors: Error[]      // All attempt errors
  lastError: Error     // Final attempt error
}
```

### CircuitOpenError

```typescript
interface CircuitOpenError extends PolicyError {
  type: 'circuit-open'
  openedAt: Date
  failureCount: number
  lastError?: Error
}
```

### TimeoutError

```typescript
interface TimeoutError extends PolicyError {
  type: 'timeout'
  timeout: number      // Configured timeout
  elapsed: number      // Actual elapsed time
}
```

### BulkheadRejectedError

```typescript
interface BulkheadRejectedError extends PolicyError {
  type: 'bulkhead-rejected'
  activeCount: number
  queueLength: number
}
```

## Performance Considerations

### Policy Reuse

Policies are stateful and should be reused:

```typescript
// ❌ Bad - Creates new policy for each request
async function fetchUser(id: string) {
  const policy = Policy.retry(3) // New instance every time
  return policy.execute(() => api.getUser(id))
}

// ✅ Good - Reuses policy instance
const userPolicy = Policy.retry(3)
async function fetchUser(id: string) {
  return userPolicy.execute(() => api.getUser(id))
}
```

### Fast Path Optimization

Policies check success before engaging machinery:

```typescript
// No overhead when operation succeeds
const result = await policy.execute(successfulOperation)
// Policy machinery is never engaged
```

### Policy Interning

Identical policies share instances:

```typescript
const p1 = Policy.retry(3, { backoff: 'exponential' })
const p2 = Policy.retry(3, { backoff: 'exponential' })
// p1 === p2 (same instance)
```