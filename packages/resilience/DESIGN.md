# @zerothrow/resilience - Design Document

## Philosophy

The ZeroThrow Resilience library brings production-grade fault tolerance to TypeScript applications while maintaining our core principle: **never throw exceptions**. Every operation returns a `Result<T,E>`, making error handling explicit and type-safe.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Code                           │
├─────────────────────────────────────────────────────────────┤
│                      Policy Registry                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Retry   │  │ Circuit  │  │ Timeout  │  │ Bulkhead │  │
│  │  Policy  │  │ Breaker  │  │  Policy  │  │  Policy  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Policy Composition                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Wrap │ Chain │ Conditional │ Algebra │ Registry     │  │
│  └─────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Execution Engine                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Context    │  │  Telemetry  │  │  State Machine  │  │
│  │ Propagation  │  │   Events    │  │   Management    │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Core Abstractions                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Policy    │  │   Clock     │  │     Result      │  │
│  │  Interface  │  │ Abstraction │  │   Integration   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Interfaces

### Policy Base

```typescript
interface Policy<TContext = any> {
  name: string
  execute<T, E = Error>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E | PolicyError>>
  
  executeSync<T, E = Error>(
    operation: SyncOperation<T, E, TContext>,
    context?: TContext
  ): Result<T, E | PolicyError>
  
  // Composition
  wrap<TOther>(other: Policy<TContext>): Policy<TContext>
  chain<TOther>(other: Policy<TContext>): Policy<TContext>
  
  // Telemetry
  onEvent(handler: PolicyEventHandler): void
}

type Operation<T, E, TContext> = 
  (context?: TContext) => Promise<T> | Promise<Result<T, E>>

type SyncOperation<T, E, TContext> = 
  (context?: TContext) => T | Result<T, E>
```

### Policy Errors

```typescript
// Base policy error
interface PolicyError extends Error {
  type: PolicyErrorType
  policyName: string
  context?: any
}

// Specific error types
interface RetryExhaustedError extends PolicyError {
  type: 'retry-exhausted'
  attempts: number
  errors: Error[]
  lastError: Error
}

interface CircuitOpenError extends PolicyError {
  type: 'circuit-open'
  openedAt: Date
  failureCount: number
  lastError?: Error
}

interface TimeoutError extends PolicyError {
  type: 'timeout'
  timeout: number
  elapsed: number
}

interface BulkheadRejectedError extends PolicyError {
  type: 'bulkhead-rejected'
  activeCount: number
  queueLength: number
}

interface HedgeFailedError extends PolicyError {
  type: 'hedge-failed'
  attempts: number
  errors: Error[]
}
```

## Policy Implementations

### Retry Policy

```typescript
interface RetryState {
  attempts: number
  errors: Error[]
  nextDelay?: number
}

class RetryPolicy<TContext> implements Policy<TContext> {
  constructor(
    private options: RetryOptions,
    private clock: Clock = new SystemClock()
  ) {}

  async execute<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E | RetryExhaustedError>> {
    const state: RetryState = { attempts: 0, errors: [] }
    
    while (this.shouldRetry(state)) {
      const result = await this.attempt(operation, context, state)
      
      if (result.ok || !this.shouldHandleError(result.error)) {
        return result
      }
      
      state.errors.push(result.error)
      state.attempts++
      
      if (this.shouldRetry(state)) {
        await this.delay(state)
        this.options.onRetry?.(state.attempts, result.error, context)
      }
    }
    
    return ZT.err(new RetryExhaustedError({
      policyName: this.name,
      attempts: state.attempts,
      errors: state.errors,
      lastError: state.errors[state.errors.length - 1],
      context
    }))
  }

  private shouldRetry(state: RetryState): boolean {
    if (this.options.forever) return true
    return state.attempts < (this.options.count ?? 3)
  }

  private async delay(state: RetryState): Promise<void> {
    const delay = this.calculateDelay(state)
    await this.clock.sleep(delay)
  }

  private calculateDelay(state: RetryState): number {
    const { backoff = 'constant', delay = 1000, maxDelay = 30000 } = this.options
    
    let calculatedDelay: number
    
    switch (backoff) {
      case 'constant':
        calculatedDelay = delay
        break
      case 'linear':
        calculatedDelay = delay * state.attempts
        break
      case 'exponential':
        calculatedDelay = delay * Math.pow(2, state.attempts - 1)
        break
      case 'jittered':
        const base = delay * Math.pow(2, state.attempts - 1)
        calculatedDelay = base * (0.5 + Math.random() * 0.5)
        break
      default:
        calculatedDelay = typeof delay === 'function' 
          ? delay(state.attempts) 
          : delay
    }
    
    return Math.min(calculatedDelay, maxDelay)
  }
}
```

### Circuit Breaker

```typescript
type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerState {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime?: Date
  openedAt?: Date
}

class CircuitBreakerPolicy<TContext> implements Policy<TContext> {
  private state: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    successCount: 0
  }

  constructor(
    private options: CircuitBreakerOptions,
    private clock: Clock = new SystemClock()
  ) {}

  async execute<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E | CircuitOpenError>> {
    // Fast fail if open
    if (this.isOpen()) {
      return ZT.err(new CircuitOpenError({
        policyName: this.name,
        openedAt: this.state.openedAt!,
        failureCount: this.state.failureCount
      }))
    }

    // Try operation
    const result = await ZT.tryAsync(() => operation(context))
    
    // Update state based on result
    if (result.ok) {
      this.onSuccess()
    } else if (this.shouldHandleError(result.error)) {
      this.onFailure(result.error)
    }
    
    return result
  }

  private isOpen(): boolean {
    if (this.state.state === 'closed') return false
    
    if (this.state.state === 'open') {
      const now = this.clock.now()
      const openDuration = now.getTime() - this.state.openedAt!.getTime()
      
      if (openDuration >= this.options.duration) {
        this.transitionToHalfOpen()
        return false
      }
      return true
    }
    
    return false // half-open allows one attempt
  }

  private onSuccess(): void {
    if (this.state.state === 'half-open') {
      this.state.successCount++
      if (this.state.successCount >= (this.options.successThreshold ?? 1)) {
        this.close()
      }
    } else {
      this.state.failureCount = 0
    }
  }

  private onFailure(error: Error): void {
    this.state.failureCount++
    this.state.lastFailureTime = this.clock.now()
    
    if (this.state.failureCount >= this.options.threshold) {
      this.open(error)
    } else if (this.state.state === 'half-open') {
      this.open(error)
    }
  }

  private open(error: Error): void {
    this.state.state = 'open'
    this.state.openedAt = this.clock.now()
    this.options.onBreak?.(error)
  }

  private close(): void {
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0
    }
    this.options.onReset?.()
  }

  private transitionToHalfOpen(): void {
    this.state.state = 'half-open'
    this.state.successCount = 0
    this.options.onHalfOpen?.()
  }
}
```

### Timeout Policy

```typescript
class TimeoutPolicy<TContext> implements Policy<TContext> {
  constructor(
    private options: TimeoutOptions,
    private clock: Clock = new SystemClock()
  ) {}

  async execute<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E | TimeoutError>> {
    const start = this.clock.now()
    const timeoutMs = this.options.timeout
    
    const timeoutPromise = this.clock.sleep(timeoutMs).then(() => 
      ZT.err<T, TimeoutError>(new TimeoutError({
        policyName: this.name,
        timeout: timeoutMs,
        elapsed: this.clock.now().getTime() - start.getTime()
      }))
    )
    
    const operationPromise = ZT.tryAsync(() => operation(context))
    
    const result = await Promise.race([operationPromise, timeoutPromise])
    
    if (!result.ok && result.error instanceof TimeoutError) {
      this.options.onTimeout?.(result.error.elapsed)
    }
    
    return result
  }
}
```

### Bulkhead Policy

```typescript
interface BulkheadState {
  active: Set<Promise<any>>
  queue: Array<{
    resolve: (value: any) => void
    reject: (error: any) => void
    operation: () => Promise<any>
  }>
}

class BulkheadPolicy<TContext> implements Policy<TContext> {
  private state: BulkheadState = {
    active: new Set(),
    queue: []
  }

  constructor(private options: BulkheadOptions) {}

  async execute<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E | BulkheadRejectedError>> {
    // Check if we can execute immediately
    if (this.state.active.size < this.options.maxConcurrent) {
      return this.executeOperation(operation, context)
    }
    
    // Check if we can queue
    const maxQueue = this.options.maxQueue ?? 0
    if (maxQueue > 0 && this.state.queue.length < maxQueue) {
      return this.queueOperation(operation, context)
    }
    
    // Reject
    return ZT.err(new BulkheadRejectedError({
      policyName: this.name,
      activeCount: this.state.active.size,
      queueLength: this.state.queue.length
    }))
  }

  private async executeOperation<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E>> {
    const promise = ZT.tryAsync(() => operation(context))
    this.state.active.add(promise)
    
    try {
      const result = await promise
      return result
    } finally {
      this.state.active.delete(promise)
      this.processQueue()
    }
  }

  private async queueOperation<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E>> {
    return new Promise((resolve, reject) => {
      this.state.queue.push({
        resolve,
        reject,
        operation: () => operation(context)
      })
    })
  }

  private processQueue(): void {
    if (this.state.queue.length === 0) return
    if (this.state.active.size >= this.options.maxConcurrent) return
    
    const item = this.state.queue.shift()!
    this.executeOperation(item.operation)
      .then(item.resolve)
      .catch(item.reject)
  }
}
```

## Policy Composition

### Wrap Composition

```typescript
class WrapPolicy<TContext> implements Policy<TContext> {
  constructor(
    private outer: Policy<TContext>,
    private inner: Policy<TContext>
  ) {}

  async execute<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E | PolicyError>> {
    // Outer policy executes inner policy's execution
    return this.outer.execute(
      (ctx) => this.inner.execute(operation, ctx),
      context
    )
  }
}

// Usage
const resilient = Policy.wrap(
  Policy.timeout(5000),        // Outer: timeout wraps everything
  Policy.retry(3),            // Middle: retry wraps circuit breaker
  Policy.circuitBreaker({...}) // Inner: circuit breaker wraps operation
)
```

### Conditional Policies

```typescript
class ConditionalPolicy<TContext> implements Policy<TContext> {
  constructor(
    private condition: (context?: TContext) => boolean,
    private whenTrue: Policy<TContext>,
    private whenFalse: Policy<TContext>
  ) {}

  async execute<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E | PolicyError>> {
    const policy = this.condition(context) ? this.whenTrue : this.whenFalse
    return policy.execute(operation, context)
  }
}
```

## Telemetry System

```typescript
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

type PolicyEventType = 
  | 'execution-start'
  | 'execution-success'
  | 'execution-failure'
  | 'retry-attempt'
  | 'circuit-open'
  | 'circuit-close'
  | 'circuit-half-open'
  | 'timeout'
  | 'bulkhead-rejected'
  | 'hedge-attempt'

class TelemetrySystem {
  private handlers: PolicyEventHandler[] = []

  emit(event: PolicyEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch (error) {
        // Telemetry errors should not affect execution
        console.error('Telemetry handler error:', error)
      }
    }
  }

  subscribe(handler: PolicyEventHandler): () => void {
    this.handlers.push(handler)
    return () => {
      const index = this.handlers.indexOf(handler)
      if (index > -1) this.handlers.splice(index, 1)
    }
  }
}
```

## Testing Support

### Test Clock

```typescript
class TestClock implements Clock {
  private currentTime = Date.now()
  private sleepers: Array<{
    wakeTime: number
    resolve: () => void
  }> = []

  now(): Date {
    return new Date(this.currentTime)
  }

  async sleep(ms: number): Promise<void> {
    const wakeTime = this.currentTime + ms
    return new Promise(resolve => {
      this.sleepers.push({ wakeTime, resolve })
      this.sleepers.sort((a, b) => a.wakeTime - b.wakeTime)
    })
  }

  advance(ms: number): void {
    this.currentTime += ms
    
    // Wake up sleepers
    while (this.sleepers.length > 0 && this.sleepers[0].wakeTime <= this.currentTime) {
      const sleeper = this.sleepers.shift()!
      sleeper.resolve()
    }
  }

  setTime(time: Date | number): void {
    this.currentTime = typeof time === 'number' ? time : time.getTime()
  }
}
```

### Policy Test Kit

```typescript
class PolicyTestKit {
  constructor(private clock: TestClock = new TestClock()) {}

  createRetryPolicy(options: Partial<RetryOptions> = {}): RetryPolicy {
    return new RetryPolicy({ count: 3, ...options }, this.clock)
  }

  createCircuitBreaker(options: Partial<CircuitBreakerOptions> = {}): CircuitBreakerPolicy {
    return new CircuitBreakerPolicy(
      { threshold: 5, duration: 60000, ...options },
      this.clock
    )
  }

  async failTimes<T>(
    policy: Policy,
    times: number,
    error: Error = new Error('Test failure')
  ): Promise<void> {
    for (let i = 0; i < times; i++) {
      await policy.execute(() => { throw error })
    }
  }

  async succeedTimes<T>(
    policy: Policy,
    times: number,
    value: T = null as any
  ): Promise<void> {
    for (let i = 0; i < times; i++) {
      await policy.execute(() => value)
    }
  }
}
```

## Performance Optimizations

### Fast Path

```typescript
abstract class OptimizedPolicy<TContext> implements Policy<TContext> {
  async execute<T, E>(
    operation: Operation<T, E, TContext>,
    context?: TContext
  ): Promise<Result<T, E | PolicyError>> {
    // Try operation without policy overhead
    const firstAttempt = await ZT.tryAsync(() => operation(context))
    
    if (firstAttempt.ok || !this.shouldHandle(firstAttempt.error)) {
      return firstAttempt
    }
    
    // Only engage policy machinery on failure
    return this.executeWithPolicy(operation, context, firstAttempt.error)
  }

  protected abstract executeWithPolicy<T, E>(
    operation: Operation<T, E, TContext>,
    context: TContext | undefined,
    firstError: E
  ): Promise<Result<T, E | PolicyError>>

  protected abstract shouldHandle(error: Error): boolean
}
```

### Policy Interning

```typescript
class PolicyFactory {
  private cache = new Map<string, Policy>()

  retry(options: RetryOptions): Policy {
    const key = this.computeKey('retry', options)
    
    if (!this.cache.has(key)) {
      this.cache.set(key, new RetryPolicy(options))
    }
    
    return this.cache.get(key)!
  }

  private computeKey(type: string, options: any): string {
    return `${type}:${JSON.stringify(options, Object.keys(options).sort())}`
  }
}
```

## Integration Points

### Result Extensions

```typescript
declare module '@zerothrow/core' {
  interface Result<T, E> {
    retry(policy: Policy): Promise<Result<T, E>>
    withPolicy(policy: Policy): Result<T, E>
  }
}

// Implementation
Result.prototype.retry = async function<T, E>(
  this: Result<T, E>,
  policy: Policy
): Promise<Result<T, E>> {
  if (this.ok) return this
  
  return policy.execute(() => this)
}
```

### ZT Namespace Extensions

```typescript
declare module '@zerothrow/core' {
  namespace ZT {
    function withPolicy<T>(
      policy: Policy,
      fn: () => T | Promise<T>
    ): Promise<Result<T, Error>>
    
    function collectWithPolicy<T>(
      items: Array<() => T | Promise<T>>,
      policy: Policy,
      options?: { concurrency?: number }
    ): Promise<Result<T[], Error>>
  }
}
```

## Future Considerations

### Policy Algebra

```typescript
// Composing policies with operators
const policy = retry(3) >> circuitBreaker() >> timeout(5000)

// Conditional composition
const policy = critical 
  ? retry(5) && circuitBreaker() 
  : retry(2) || fallback(cached)
```

### Distributed Policies

```typescript
// Share circuit breaker state across instances
const breaker = Policy.circuitBreaker({
  threshold: 5,
  stateStore: new RedisStateStore('circuit:api:user')
})
```

### Adaptive Policies

```typescript
// Policies that learn from behavior
const adaptive = Policy.adaptiveRetry({
  initial: { count: 3, backoff: 'linear' },
  learn: (history) => {
    // Adjust retry strategy based on success patterns
    const successRate = history.successes / history.attempts
    return successRate < 0.5 
      ? { count: 5, backoff: 'exponential' }
      : { count: 2, backoff: 'constant' }
  }
})
```