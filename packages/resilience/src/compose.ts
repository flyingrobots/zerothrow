import type { ZeroThrow } from '@zerothrow/core'
import { ZeroError } from '@zerothrow/core'
import type { Policy } from './types.js'

/**
 * Wraps one policy with another, creating a composed policy.
 * The outer policy executes first and passes its operation to the inner policy.
 * 
 * Example: Policy.wrap(retry, timeout) creates a policy that retries with timeouts
 */
export function wrap(outer: Policy, inner: Policy): Policy {
  return {
    execute<T, E extends ZeroError = ZeroError>(
      operation: () => ZeroThrow.Async<T, E>
    ): ZeroThrow.Async<T, E> {
      // The outer policy wraps the inner policy's execution
      return outer.execute(() => 
        // The inner policy executes the actual operation and returns its Result
        inner.execute(operation)
      ) as ZeroThrow.Async<T, E>
    }
  }
}

/**
 * Composes multiple policies from left to right.
 * The leftmost policy is the outermost wrapper.
 * 
 * Example: compose(retry, circuit, timeout) 
 * Results in: retry wraps (circuit wraps (timeout wraps operation))
 */
export function compose(...policies: Policy[]): Policy {
  if (policies.length === 0) {
    throw new Error('compose requires at least one policy')
  }
  
  if (policies.length === 1) {
    return policies[0] as Policy
  }
  
  return policies.reduce((acc, policy) => wrap(policy, acc))
}