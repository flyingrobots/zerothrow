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

// Union type for all policies
export type AnyPolicy = RetryPolicy | CircuitBreakerPolicy | TimeoutPolicy | Policy

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