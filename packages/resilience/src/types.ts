import { ZeroError } from '@zerothrow/core'
import type { ZeroThrow } from '@zerothrow/core'
import type { JitterStrategy } from './jitter.js'

export interface Policy {
  execute<T, E extends ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, ZeroError>
}

export interface RetryPolicy extends Policy {
  onRetry<E>(callback: (attempt: number, error: E, delay: number) => void): RetryPolicy
}

export interface CircuitBreakerPolicy extends Policy {
  onCircuitStateChange(callback: (state: 'open' | 'closed' | 'half-open') => void): CircuitBreakerPolicy
}

// TimeoutPolicy is just a Policy with no additional methods
// Using a type alias instead of an empty interface
export type TimeoutPolicy = Policy

export interface BulkheadPolicy extends Policy {
  getMetrics(): BulkheadMetrics
  updateCapacity(maxConcurrent: number): void
  updateQueueSize(maxQueue: number): void
}

export interface HedgePolicy extends Policy {
  getMetrics(): HedgeMetrics
  onHedge(callback: (attempt: number, delay: number) => void): HedgePolicy
}

// Union type for all policies
export type AnyPolicy = RetryPolicy | CircuitBreakerPolicy | TimeoutPolicy | BulkheadPolicy | HedgePolicy | Policy

/**
 * Context provided to the shouldRetry predicate for making informed retry decisions.
 */
export interface RetryContext<E extends ZeroError = ZeroError> {
  /** Current attempt number (1-based) */
  attempt: number
  /** The error that occurred in the current attempt */
  error: E
  /** Delay used before this attempt in milliseconds (undefined for first retry) */
  lastDelay?: number
  /** Total delay accumulated so far in milliseconds */
  totalDelay: number
  /** Optional metadata passed through from RetryOptions for complex scenarios */
  metadata?: Record<string, unknown>
}

export interface RetryOptions<E extends ZeroError = ZeroError> {
  backoff?: 'constant' | 'linear' | 'exponential'
  delay?: number        // Base delay in ms
  maxDelay?: number     // Cap for exponential
  handle?: (error: E) => boolean
  /**
   * Advanced conditional retry predicate with full context access.
   * If provided, this takes precedence over the `handle` function.
   * Return true to retry, false to stop retrying.
   */
  shouldRetry?: (context: RetryContext<E>) => boolean | Promise<boolean>
  /**
   * Optional metadata to pass through to the shouldRetry function
   */
  metadata?: Record<string, unknown>
  events?: RetryEventHandlers<E>
  eventOptions?: EventEmitterOptions
  jitter?: JitterStrategy | {
    strategy: JitterStrategy
    random?: () => number
  }
}

export interface CircuitOptions {
  threshold: number     // Failures to open
  duration: number      // Time to stay open
  onOpen?: () => void
  onClose?: () => void
}

export interface TimeoutOptions {
  timeout: number       // Ms before timeout
}

export interface BulkheadOptions {
  maxConcurrent: number    // Maximum concurrent executions
  maxQueue?: number        // Maximum queued executions (0 = no queue)
  queueTimeout?: number    // Ms to wait in queue before timeout
}

export interface BulkheadMetrics {
  activeConcurrent: number
  queuedCount: number
  totalExecuted: number
  totalRejected: number
  totalQueued: number
  totalQueueTimeout: number
}
// Context for conditional policies
export interface PolicyContext<E extends ZeroError = ZeroError> {
  readonly startTime: number
  readonly executionCount: number
  readonly failureCount: number
  readonly successCount: number
  readonly lastError?: E
  readonly lastExecutionTime?: number
  readonly metadata: Map<string, unknown>
}

export class MutablePolicyContext<E extends ZeroError = ZeroError> implements PolicyContext<E> {
  startTime: number
  executionCount = 0
  failureCount = 0
  successCount = 0
  lastError?: E
  lastExecutionTime?: number
  metadata = new Map<string, unknown>()

  constructor() {
    this.startTime = Date.now()
  }

  recordExecution(success: boolean, error?: E, duration?: number): void {
    this.executionCount++
    if (success) {
      this.successCount++
    } else {
      this.failureCount++
      if (error) this.lastError = error
    }
    if (duration !== undefined) {
      this.lastExecutionTime = duration
    }
  }

  get failureRate(): number {
    return this.executionCount === 0 ? 0 : this.failureCount / this.executionCount
  }

  get successRate(): number {
    return this.executionCount === 0 ? 0 : this.successCount / this.executionCount
  }
}

// Conditional policy types
export type PolicyCondition<E extends ZeroError = ZeroError> = (context: PolicyContext<E>) => boolean

export interface ConditionalPolicyOptions<E extends ZeroError = ZeroError> {
  condition: PolicyCondition<E>
  whenTrue: Policy
  whenFalse: Policy
}

export interface BranchCase<E extends ZeroError = ZeroError> {
  condition: PolicyCondition<E>
  policy: Policy
}

export interface BranchPolicyOptions<E extends ZeroError = ZeroError> {
  branches: BranchCase<E>[]
  default: Policy
}

export interface AdaptivePolicyOptions<E extends ZeroError = ZeroError> {
  policies: Policy[]
  selector: (context: PolicyContext<E>) => Policy
  warmupPeriod?: number  // executions before adapting
}

// Extend existing policy interfaces
export interface ConditionalPolicy extends Policy {
  getContext<E extends ZeroError = ZeroError>(): PolicyContext<E>
}

export interface HedgeOptions {
  delay: number | DelayStrategy  // When to start hedge request
  maxHedges?: number              // Max parallel requests (default: 1)
  shouldHedge?: (attempt: number) => boolean  // Conditional hedging
}

export interface DelayStrategy {
  type: 'fixed' | 'linear' | 'exponential'
  initial: number    // Initial delay in ms
  factor?: number    // Multiplier for linear/exponential (default: 2)
  maxDelay?: number  // Cap for delays
}

export interface HedgeMetrics {
  totalRequests: number
  hedgeRequests: number
  primaryWins: number
  hedgeWins: number
  resourceWaste: number  // Percentage of wasted hedge requests
  avgPrimaryLatency: number
  avgHedgeLatency: number
  p99Latency: number
}

// Policy error types
export interface PolicyError<E extends ZeroError = ZeroError> extends Error {
  type: PolicyErrorType
  policyName: string
  context?: unknown
  wrappedError?: E
}

export type PolicyErrorType =
  | 'retry-exhausted'
  | 'circuit-open'
  | 'timeout'
  | 'bulkhead-rejected'
  | 'bulkhead-queue-timeout'
  | 'hedge-failed'

export class RetryExhaustedError<E extends ZeroError = ZeroError> extends Error implements PolicyError<E> {
  readonly type = 'retry-exhausted' as const
  
  constructor(
    public readonly policyName: string,
    public readonly attempts: number,
    public readonly lastError: E,
    public readonly context?: unknown
  ) {
    super(`Retry exhausted after ${attempts} attempts`)
    this.name = 'RetryExhaustedError'
    this.wrappedError = lastError
  }
  
  public readonly wrappedError: E
}

export class CircuitOpenError<E extends ZeroError = ZeroError> extends Error implements PolicyError<E> {
  readonly type = 'circuit-open' as const
  public readonly wrappedError?: E
  
  constructor(
    public readonly policyName: string,
    public readonly openedAt: Date,
    public readonly failureCount: number,
    public readonly context?: Record<string, string | number | boolean>,
    wrappedError?: E
  ) {
    super(`Circuit breaker is open`)
    this.name = 'CircuitOpenError'
    if (wrappedError !== undefined) {
      this.wrappedError = wrappedError
    }
  }
}

export class TimeoutError extends ZeroError<{
  policyName: string
  timeout: number
  elapsed: number
}> {
  constructor(
    policyName: string,
    timeout: number,
    elapsed: number
  ) {
    super('TIMEOUT', `Operation timed out after ${elapsed}ms (limit: ${timeout}ms)`, {
      context: {
        policyName,
        timeout,
        elapsed
      }
    })
    this.name = 'TimeoutError'
  }
}

export class BulkheadRejectedError<E extends ZeroError = ZeroError> extends Error implements PolicyError<E> {
  readonly type = 'bulkhead-rejected' as const
  public readonly wrappedError?: E
  
  constructor(
    public readonly policyName: string,
    public readonly maxConcurrent: number,
    public readonly maxQueue: number,
    public readonly activeConcurrent: number,
    public readonly queuedCount: number,
    public readonly context?: unknown,
    wrappedError?: E
  ) {
    super(`Bulkhead rejected: ${activeConcurrent} active, ${queuedCount} queued (limits: ${maxConcurrent} concurrent, ${maxQueue} queue)`)
    this.name = 'BulkheadRejectedError'
    if (wrappedError !== undefined) {
      this.wrappedError = wrappedError
    }
  }
}

export class BulkheadQueueTimeoutError<E extends ZeroError = ZeroError> extends Error implements PolicyError<E> {
  readonly type = 'bulkhead-queue-timeout' as const
  public readonly wrappedError?: E
  
  constructor(
    public readonly policyName: string,
    public readonly queueTimeout: number,
    public readonly waitTime: number,
    public readonly context?: unknown,
    wrappedError?: E
  ) {
    super(`Bulkhead queue timeout: waited ${waitTime}ms (limit: ${queueTimeout}ms)`)
    this.name = 'BulkheadQueueTimeoutError'
    if (wrappedError !== undefined) {
      this.wrappedError = wrappedError
    }
  }
}

export class HedgeFailedError<E extends ZeroError = ZeroError> extends Error implements PolicyError<E> {
  readonly type = 'hedge-failed' as const
  
  constructor(
    public readonly policyName: string,
    public readonly attempts: number,
    public readonly errors: E[],
    public readonly context?: unknown
  ) {
    super(`All ${attempts} hedge attempts failed`)
    this.name = 'HedgeFailedError'
    // SAFE_CAST: Use last error as wrapped error if available
    if (errors.length > 0) {
      this.wrappedError = errors[errors.length - 1] as E
    }
  }
  
  public readonly wrappedError?: E
}

// Retry Event Types
export type RetryEventType = 
  | 'retry:started'
  | 'retry:attempt'
  | 'retry:failed'
  | 'retry:backoff'
  | 'retry:succeeded'
  | 'retry:exhausted'

export interface RetryEventBase {
  type: RetryEventType
  timestamp: number
  policyName: string
  operationId?: string
}

export interface RetryStartedEvent extends RetryEventBase {
  type: 'retry:started'
  maxAttempts: number
  options: RetryOptions<ZeroError>
}

export interface RetryAttemptEvent extends RetryEventBase {
  type: 'retry:attempt'
  attemptNumber: number
  elapsed: number
}

export interface RetryFailedEvent<E extends ZeroError = ZeroError> extends RetryEventBase {
  type: 'retry:failed'
  attemptNumber: number
  error: E
  elapsed: number
  willRetry: boolean
}

export interface RetryBackoffEvent extends RetryEventBase {
  type: 'retry:backoff'
  attemptNumber: number
  delay: number
  nextAttemptAt: number
}

export interface RetrySucceededEvent extends RetryEventBase {
  type: 'retry:succeeded'
  attemptNumber: number
  totalAttempts: number
  totalElapsed: number
}

export interface RetryExhaustedEvent<E extends ZeroError = ZeroError> extends RetryEventBase {
  type: 'retry:exhausted'
  totalAttempts: number
  lastError: E
  totalElapsed: number
}

export type RetryEvent<E extends ZeroError = ZeroError> =
  | RetryStartedEvent
  | RetryAttemptEvent
  | RetryFailedEvent<E>
  | RetryBackoffEvent
  | RetrySucceededEvent
  | RetryExhaustedEvent<E>

// Event Handler Types
export type RetryEventHandler<T extends RetryEvent<ZeroError> = RetryEvent<ZeroError>> = (event: T) => void

export interface RetryEventHandlers<E extends ZeroError> {
  onStarted?: RetryEventHandler<RetryStartedEvent>
  onAttempt?: RetryEventHandler<RetryAttemptEvent>
  onFailed?: RetryEventHandler<RetryFailedEvent<E>>
  onBackoff?: RetryEventHandler<RetryBackoffEvent>
  onSucceeded?: RetryEventHandler<RetrySucceededEvent>
  onExhausted?: RetryEventHandler<RetryExhaustedEvent<E>>
  onEvent?: RetryEventHandler<RetryEvent<E>>
}

// Event Emitter Options
export interface EventEmitterOptions {
  buffered?: boolean
  bufferSize?: number
}