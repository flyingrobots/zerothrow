import type { Result } from '@zerothrow/core'
import type { JitterStrategy } from './jitter.js'

export interface Policy {
  execute<T>(
    operation: () => Promise<T>
  ): Promise<Result<T, Error>>
}

export interface RetryPolicy extends Policy {
  onRetry(callback: (attempt: number, error: unknown, delay: number) => void): RetryPolicy
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
export interface RetryContext {
  /** Current attempt number (1-based) */
  attempt: number
  /** The error that occurred in the current attempt */
  error: Error
  /** Delay used before this attempt in milliseconds (undefined for first retry) */
  lastDelay?: number
  /** Total delay accumulated so far in milliseconds */
  totalDelay: number
  /** Optional metadata passed through from RetryOptions for complex scenarios */
  metadata?: Record<string, unknown>
}

export interface RetryOptions {
  backoff?: 'constant' | 'linear' | 'exponential'
  delay?: number        // Base delay in ms
  maxDelay?: number     // Cap for exponential
  handle?: (error: Error) => boolean
  /**
   * Advanced conditional retry predicate with full context access.
   * If provided, this takes precedence over the `handle` function.
   * Return true to retry, false to stop retrying.
   */
  shouldRetry?: (context: RetryContext) => boolean | Promise<boolean>
  /**
   * Optional metadata to pass through to the shouldRetry function
   */
  metadata?: Record<string, unknown>
  events?: RetryEventHandlers
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
export interface PolicyContext {
  readonly startTime: number
  readonly executionCount: number
  readonly failureCount: number
  readonly successCount: number
  readonly lastError?: Error
  readonly lastExecutionTime?: number
  readonly metadata: Map<string, unknown>
}

export class MutablePolicyContext implements PolicyContext {
  startTime: number
  executionCount = 0
  failureCount = 0
  successCount = 0
  lastError?: Error
  lastExecutionTime?: number
  metadata = new Map<string, unknown>()

  constructor() {
    this.startTime = Date.now()
  }

  recordExecution(success: boolean, error?: Error, duration?: number): void {
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
export type PolicyCondition = (context: PolicyContext) => boolean

export interface ConditionalPolicyOptions {
  condition: PolicyCondition
  whenTrue: Policy
  whenFalse: Policy
}

export interface BranchCase {
  condition: PolicyCondition
  policy: Policy
}

export interface BranchPolicyOptions {
  branches: BranchCase[]
  default: Policy
}

export interface AdaptivePolicyOptions {
  policies: Policy[]
  selector: (context: PolicyContext) => Policy
  warmupPeriod?: number  // executions before adapting
}

// Extend existing policy interfaces
export interface ConditionalPolicy extends Policy {
  getContext(): PolicyContext
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
export interface PolicyError extends Error {
  type: PolicyErrorType
  policyName: string
  context?: unknown
}

export type PolicyErrorType =
  | 'retry-exhausted'
  | 'circuit-open'
  | 'timeout'
  | 'bulkhead-rejected'
  | 'bulkhead-queue-timeout'
  | 'hedge-failed'

export class RetryExhaustedError extends Error implements PolicyError {
  readonly type = 'retry-exhausted' as const
  
  constructor(
    public readonly policyName: string,
    public readonly attempts: number,
    public readonly lastError: Error,
    public readonly context?: unknown
  ) {
    super(`Retry exhausted after ${attempts} attempts`)
    this.name = 'RetryExhaustedError'
  }
}

export class CircuitOpenError extends Error implements PolicyError {
  readonly type = 'circuit-open' as const
  
  constructor(
    public readonly policyName: string,
    public readonly openedAt: Date,
    public readonly failureCount: number,
    public readonly context?: unknown
  ) {
    super(`Circuit breaker is open`)
    this.name = 'CircuitOpenError'
  }
}

export class TimeoutError extends Error implements PolicyError {
  readonly type = 'timeout' as const
  
  constructor(
    public readonly policyName: string,
    public readonly timeout: number,
    public readonly elapsed: number,
    public readonly context?: unknown
  ) {
    super(`Operation timed out after ${elapsed}ms (limit: ${timeout}ms)`)
    this.name = 'TimeoutError'
  }
}

export class BulkheadRejectedError extends Error implements PolicyError {
  readonly type = 'bulkhead-rejected' as const
  
  constructor(
    public readonly policyName: string,
    public readonly maxConcurrent: number,
    public readonly maxQueue: number,
    public readonly activeConcurrent: number,
    public readonly queuedCount: number,
    public readonly context?: unknown
  ) {
    super(`Bulkhead rejected: ${activeConcurrent} active, ${queuedCount} queued (limits: ${maxConcurrent} concurrent, ${maxQueue} queue)`)
    this.name = 'BulkheadRejectedError'
  }
}

export class BulkheadQueueTimeoutError extends Error implements PolicyError {
  readonly type = 'bulkhead-queue-timeout' as const
  
  constructor(
    public readonly policyName: string,
    public readonly queueTimeout: number,
    public readonly waitTime: number,
    public readonly context?: unknown
  ) {
    super(`Bulkhead queue timeout: waited ${waitTime}ms (limit: ${queueTimeout}ms)`)
    this.name = 'BulkheadQueueTimeoutError'
  }
}

export class HedgeFailedError extends Error implements PolicyError {
  readonly type = 'hedge-failed' as const
  
  constructor(
    public readonly policyName: string,
    public readonly attempts: number,
    public readonly errors: Error[],
    public readonly context?: unknown
  ) {
    super(`All ${attempts} hedge attempts failed`)
    this.name = 'HedgeFailedError'
  }
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
  options: RetryOptions
}

export interface RetryAttemptEvent extends RetryEventBase {
  type: 'retry:attempt'
  attemptNumber: number
  elapsed: number
}

export interface RetryFailedEvent extends RetryEventBase {
  type: 'retry:failed'
  attemptNumber: number
  error: Error
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

export interface RetryExhaustedEvent extends RetryEventBase {
  type: 'retry:exhausted'
  totalAttempts: number
  lastError: Error
  totalElapsed: number
}

export type RetryEvent =
  | RetryStartedEvent
  | RetryAttemptEvent
  | RetryFailedEvent
  | RetryBackoffEvent
  | RetrySucceededEvent
  | RetryExhaustedEvent

// Event Handler Types
export type RetryEventHandler<T extends RetryEvent = RetryEvent> = (event: T) => void

export interface RetryEventHandlers {
  onStarted?: RetryEventHandler<RetryStartedEvent>
  onAttempt?: RetryEventHandler<RetryAttemptEvent>
  onFailed?: RetryEventHandler<RetryFailedEvent>
  onBackoff?: RetryEventHandler<RetryBackoffEvent>
  onSucceeded?: RetryEventHandler<RetrySucceededEvent>
  onExhausted?: RetryEventHandler<RetryExhaustedEvent>
  onEvent?: RetryEventHandler<RetryEvent>
}

// Event Emitter Options
export interface EventEmitterOptions {
  buffered?: boolean
  bufferSize?: number
}