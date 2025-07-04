import type { Result } from '@zerothrow/core'

export interface Policy {
  execute<T>(
    operation: () => Promise<T>
  ): Promise<Result<T, Error>>
}

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