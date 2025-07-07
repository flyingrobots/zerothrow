// Core types
export type {
  Policy,
  RetryPolicy as RetryPolicyInterface,
  CircuitBreakerPolicy as CircuitBreakerPolicyInterface,
  TimeoutPolicy as TimeoutPolicyInterface,
  ConditionalPolicy,
  AnyPolicy,
  RetryOptions,
  CircuitOptions,
  TimeoutOptions,
  ConditionalPolicyOptions,
  BranchPolicyOptions,
  AdaptivePolicyOptions,
  PolicyContext,
  PolicyCondition,
  BranchCase,
  PolicyError,
  PolicyErrorType
} from './types.js'

// Error classes
export {
  RetryExhaustedError,
  CircuitOpenError,
  TimeoutError,
  MutablePolicyContext
} from './types.js'

// Policy implementations
export { RetryPolicy } from './policies/retry.js'
export { CircuitBreakerPolicy } from './policies/circuit.js'
export { TimeoutPolicy } from './policies/timeout.js'
export { ConditionalPolicyImpl } from './policies/conditional.js'
export { BranchPolicyImpl } from './policies/branch.js'
export { AdaptivePolicyImpl } from './policies/adaptive.js'

// Composition utilities
export { wrap, compose } from './compose.js'

// Main factory
export { Policy as PolicyFactory } from './policy-factory.js'

// Clock utilities (for testing)
export type { Clock } from './clock.js'
export { SystemClock, TestClock } from './clock.js'