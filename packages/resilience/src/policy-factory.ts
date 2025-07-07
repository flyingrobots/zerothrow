import { RetryPolicy } from './policies/retry.js'
import { CircuitBreakerPolicy } from './policies/circuit.js'
import { TimeoutPolicy } from './policies/timeout.js'
import { Bulkhead } from './policies/bulkhead.js'
import { wrap, compose } from './compose.js'
import type { RetryOptions, CircuitOptions, TimeoutOptions, BulkheadOptions } from './types.js'
import type { Clock } from './clock.js'

/**
 * Main factory for creating resilience policies
 */
export const Policy = {
  /**
   * Creates a retry policy
   */
  retry(count: number, options?: RetryOptions, clock?: Clock) {
    return new RetryPolicy(count, options, clock)
  },

  /**
   * Creates a circuit breaker policy
   */
  circuitBreaker(options: CircuitOptions, clock?: Clock) {
    return new CircuitBreakerPolicy(options, clock)
  },

  /**
   * Creates a timeout policy
   */
  timeout(options: TimeoutOptions | number, clock?: Clock) {
    const opts = typeof options === 'number' 
      ? { timeout: options } 
      : options
    return new TimeoutPolicy(opts, clock)
  },

  /**
   * Creates a bulkhead isolation policy
   */
  bulkhead(options: BulkheadOptions | number, clock?: Clock) {
    const opts = typeof options === 'number'
      ? { maxConcurrent: options }
      : options
    return new Bulkhead('bulkhead', opts, clock)
  },

  /**
   * Wraps one policy with another
   * The outer policy executes first
   */
  wrap,

  /**
   * Composes multiple policies from left to right
   * The leftmost policy is the outermost wrapper
   */
  compose
} as const