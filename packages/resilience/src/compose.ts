import type { Result } from '@zerothrow/core'
import type { Policy } from './types.js'

/**
 * Wraps one policy with another, creating a composed policy.
 * The outer policy executes first and passes its operation to the inner policy.
 * 
 * Example: Policy.wrap(retry, timeout) creates a policy that retries with timeouts
 */
export function wrap(outer: Policy, inner: Policy): Policy {
  return {
    async execute<T>(
      operation: () => Promise<T>
    ): Promise<Result<T, Error>> {
      // The outer policy wraps the inner policy's execution
      return outer.execute(() => 
        // The inner policy executes the actual operation
        inner.execute(operation).then(result => {
          // If inner policy returns an error Result, we need to throw
          // so the outer policy can handle it (e.g., retry on error)
          if (!result.ok) {
            throw result.error
          }
          return result.value
        })
      )
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