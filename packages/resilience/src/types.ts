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