import type { Result } from '@zerothrow/core'

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

// Union type for all policies
export type AnyPolicy = RetryPolicy | CircuitBreakerPolicy | TimeoutPolicy | BulkheadPolicy | Policy

export interface RetryOptions {
  backoff?: 'constant' | 'linear' | 'exponential'
  delay?: number        // Base delay in ms
  maxDelay?: number     // Cap for exponential
  handle?: (error: Error) => boolean
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