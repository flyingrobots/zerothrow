// Core types
export type {
  Policy as PolicyInterface,
  RetryOptions,
  CircuitOptions,
  TimeoutOptions,
  PolicyError,
  PolicyErrorType
} from './types.js'

// Error classes
export {
  RetryExhaustedError,
  CircuitOpenError,
  TimeoutError
} from './types.js'

// Policy implementations
export { RetryPolicy } from './policies/retry.js'
export { CircuitBreakerPolicy } from './policies/circuit.js'
export { TimeoutPolicy } from './policies/timeout.js'

// Composition utilities
export { wrap, compose } from './compose.js'

// Main factory
export { Policy } from './policy-factory.js'

// Clock utilities (for testing)
export type { Clock } from './clock.js'
export { SystemClock, TestClock } from './clock.js'