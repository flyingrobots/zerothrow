import { RetryPolicy } from './policies/retry.js'
import { CircuitBreakerPolicy } from './policies/circuit.js'
import { TimeoutPolicy } from './policies/timeout.js'
import { ConditionalPolicyImpl } from './policies/conditional.js'
import { BranchPolicyImpl } from './policies/branch.js'
import { AdaptivePolicyImpl } from './policies/adaptive.js'
import { wrap, compose } from './compose.js'
import type { 
  RetryOptions, 
  CircuitOptions, 
  TimeoutOptions,
  ConditionalPolicyOptions,
  BranchPolicyOptions,
  AdaptivePolicyOptions
} from './types.js'
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
   * Wraps one policy with another
   * The outer policy executes first
   */
  wrap,

  /**
   * Composes multiple policies from left to right
   * The leftmost policy is the outermost wrapper
   */
  compose,

  /**
   * Creates a conditional policy that chooses between two policies based on a condition
   */
  conditional(options: ConditionalPolicyOptions) {
    return new ConditionalPolicyImpl(options)
  },

  /**
   * Creates a branch policy that selects from multiple policies based on conditions
   */
  branch(options: BranchPolicyOptions) {
    return new BranchPolicyImpl(options)
  },

  /**
   * Creates an adaptive policy that dynamically selects policies based on runtime metrics
   */
  adaptive(options: AdaptivePolicyOptions) {
    return new AdaptivePolicyImpl(options)
  }
} as const