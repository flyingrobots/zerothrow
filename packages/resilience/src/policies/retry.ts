import { ZT, type Result } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import { RetryExhaustedError, type RetryOptions, type RetryPolicy as IRetryPolicy, type RetryContext } from '../types.js'
import type { Clock } from '../clock.js'

/**
 * Retry policy that handles transient failures by retrying operations with configurable backoff strategies.
 * 
 * @example
 * // Basic retry with exponential backoff
 * const policy = new RetryPolicy(3, { backoff: 'exponential', delay: 100 })
 * 
 * @example
 * // Conditional retry based on error type
 * const policy = new RetryPolicy(5, {
 *   shouldRetry: (context) => {
 *     // Only retry network errors
 *     return context.error.name === 'NetworkError'
 *   }
 * })
 * 
 * @example
 * // Complex retry logic with metadata
 * const policy = new RetryPolicy(10, {
 *   metadata: { criticalErrors: ['FATAL', 'UNRECOVERABLE'] },
 *   shouldRetry: (context) => {
 *     const criticalErrors = context.metadata?.criticalErrors as string[]
 *     return !criticalErrors.includes(context.error.message)
 *   }
 * })
 */
export class RetryPolicy extends BasePolicy implements IRetryPolicy {
  private retryCallback?: (attempt: number, error: unknown, delay: number) => void
  constructor(
    private readonly count: number,
    private readonly options: RetryOptions = {},
    clock?: Clock
  ) {
    super('retry', clock)
  }

  /**
   * Executes an operation with retry logic based on the configured options.
   * 
   * The retry behavior can be controlled through:
   * - `handle`: Legacy function to filter retryable errors (deprecated, use `shouldRetry`)
   * - `shouldRetry`: Advanced predicate with full retry context access
   * - `backoff`: Strategy for calculating delays between retries
   * - `metadata`: Custom data passed to the shouldRetry function
   * 
   * @param operation - The async operation to execute with retry protection
   * @returns A Result containing either the successful value or the final error
   */
  async execute<T>(
    operation: () => Promise<T>
  ): Promise<Result<T, Error>> {
    let lastError: Error | undefined
    let totalDelay = 0
    let lastDelay: number | undefined
    
    for (let attempt = 0; attempt <= this.count; attempt++) {
      const result = await this.runOperation(operation)
      
      if (result.ok) {
        return result
      }
      
      lastError = result.error
      
      // If this is the last attempt, don't check retry conditions
      if (attempt >= this.count) {
        break
      }
      
      // Build retry context for conditional evaluation
      const retryContext: RetryContext = {
        attempt: attempt + 1,
        error: result.error,
        totalDelay,
        ...(lastDelay !== undefined && { lastDelay }),
        ...(this.options.metadata && { metadata: this.options.metadata })
      }
      
      // Check if we should retry using the new shouldRetry function if provided
      if (this.options.shouldRetry) {
        const shouldRetry = await this.options.shouldRetry(retryContext)
        if (!shouldRetry) {
          return result
        }
      } else if (this.options.handle && !this.options.handle(result.error)) {
        // Fall back to legacy handle function for backward compatibility
        return result
      }
      
      // Calculate and apply delay
      const delayTime = this.calculateDelay(attempt + 1)
      lastDelay = delayTime
      totalDelay += delayTime
      
      if (this.retryCallback) {
        this.retryCallback(attempt + 1, lastError, delayTime)
      }
      await this.clock.sleep(delayTime)
    }
    
    return ZT.err(new RetryExhaustedError(
      this.name,
      this.count + 1,
      lastError as Error
    ))
  }

  onRetry(callback: (attempt: number, error: unknown, delay: number) => void): IRetryPolicy {
    this.retryCallback = callback
    return this
  }


  private calculateDelay(attempt: number): number {
    const { backoff = 'constant', delay = 1000, maxDelay = 30000 } = this.options
    
    let calculatedDelay: number
    
    switch (backoff) {
      case 'constant':
        calculatedDelay = delay
        break
      case 'linear':
        calculatedDelay = delay * attempt
        break
      case 'exponential':
        calculatedDelay = delay * Math.pow(2, attempt - 1)
        break
      default:
        calculatedDelay = delay
    }
    
    return Math.min(calculatedDelay, maxDelay)
  }
}