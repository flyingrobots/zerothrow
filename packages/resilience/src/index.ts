// Core types
export type {
  Policy,
  RetryPolicy as RetryPolicyInterface,
  CircuitBreakerPolicy as CircuitBreakerPolicyInterface,
  TimeoutPolicy as TimeoutPolicyInterface,
  BulkheadPolicy as BulkheadPolicyInterface,
  AnyPolicy,
  RetryOptions,
  CircuitOptions,
  TimeoutOptions,
  BulkheadOptions,
  BulkheadMetrics,
  PolicyError,
  PolicyErrorType
} from './types.js'

// Error classes
export {
  RetryExhaustedError,
  CircuitOpenError,
  TimeoutError,
  BulkheadRejectedError,
  BulkheadQueueTimeoutError
} from './types.js'

// Policy implementations
export { RetryPolicy } from './policies/retry.js'
export { CircuitBreakerPolicy } from './policies/circuit.js'
export { TimeoutPolicy } from './policies/timeout.js'
export { Bulkhead } from './policies/bulkhead.js'

// Composition utilities
export { wrap, compose } from './compose.js'

// Main factory
export { Policy as PolicyFactory } from './policy-factory.js'

// Clock utilities (for testing)
export type { Clock } from './clock.js'
export { SystemClock, TestClock } from './clock.js'