import { ZeroThrow, ZeroError } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import { type RetryOptions, type RetryPolicy as IRetryPolicy, type RetryContext, RetryExhaustedError } from '../types.js'
import type { Clock } from '../clock.js'
import { RetryEventManager } from '../retry-events.js'
import { JitterCalculator } from '../jitter.js'

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
  private retryCallback?: <E>(attempt: number, error: E, delay: number) => void
  private eventManager?: RetryEventManager
  private readonly jitterCalculator: JitterCalculator
  
  constructor(
    private readonly count: number,
    private readonly options: RetryOptions<ZeroError> = {},
    clock?: Clock
  ) {
    super('retry', clock)
    
    // Initialize event manager if event handlers are provided
    if (this.options.events) {
      this.eventManager = new RetryEventManager(
        this.name,
        this.clock,
        this.options.events,
        this.options.eventOptions
      )
    }
    
    // Initialize jitter calculator
    this.jitterCalculator = this.createJitterCalculator()
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
  execute<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, E> {
    return ZeroThrow.enhance(this.executeAsync(operation))
  }

  private async executeAsync<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): Promise<ZeroThrow.Result<T, E>> {
    let lastResult: ZeroThrow.Result<T, E> | undefined
    let totalDelay = 0
    let lastDelay: number | undefined
    
    // Emit retry started event
    this.eventManager?.emitStarted(this.count + 1, this.options)
    
    for (let attempt = 0; attempt <= this.count; attempt++) {
      // Emit attempt event
      this.eventManager?.emitAttempt(attempt + 1)
      const result = await operation()
      
      if (result.ok) {
        // Emit succeeded event
        this.eventManager?.emitSucceeded(attempt + 1)
        return result
      }
      
      lastResult = result
      
      // If this is the last attempt, don't check retry conditions
      if (attempt >= this.count) {
        // Emit failed event with willRetry = false for final attempt
        if (result.ok === false) {
          // SAFE_CAST: E extends ZeroError, convert for event manager
          this.eventManager?.emitFailed(attempt + 1, result.error as import('@zerothrow/core').ZeroError, false)
        }
        break
      }
      
      // We can only build retry context if we have an error
      if (result.ok === false) {
        // Build retry context for conditional evaluation
        const retryContext: RetryContext<E> = {
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
            // Emit failed event with willRetry = false
            // SAFE_CAST: E extends ZeroError, convert for event manager
          this.eventManager?.emitFailed(attempt + 1, result.error as import('@zerothrow/core').ZeroError, false)
            return result
          }
        } else if (this.options.handle && !this.options.handle(result.error)) {
          // Fall back to legacy handle function for backward compatibility
          // Emit failed event with willRetry = false
          // SAFE_CAST: E extends ZeroError, convert for event manager
          this.eventManager?.emitFailed(attempt + 1, result.error as import('@zerothrow/core').ZeroError, false)
          return result
        }
      }
      
      // Will retry - emit failed event with willRetry = true
      if (result.ok === false) {
        // SAFE_CAST: E extends ZeroError, convert for event manager
        this.eventManager?.emitFailed(attempt + 1, result.error as import('@zerothrow/core').ZeroError, true)
      }
      
      // Calculate and apply delay
      const delayTime = this.calculateDelay(attempt + 1)
      lastDelay = delayTime
      totalDelay += delayTime
      
      // Emit backoff event
      this.eventManager?.emitBackoff(attempt + 1, delayTime)
      
      // Call legacy callback for backward compatibility
      if (this.retryCallback && lastResult && lastResult.ok === false) {
        this.retryCallback(attempt + 1, lastResult.error, delayTime)
      }
      
      await this.clock.sleep(delayTime)
    }
    
    // Emit exhausted event
    if (lastResult && lastResult.ok === false) {
      // SAFE_CAST: E extends ZeroError, convert for event manager
      this.eventManager?.emitExhausted(this.count + 1, lastResult.error as import('@zerothrow/core').ZeroError)
    }
    
    // Create RetryExhaustedError when all retries are exhausted
    // SAFE_CAST: Create a proper ZeroError if no error available
    const lastError = lastResult && lastResult.ok === false ? lastResult.error : new ZeroError('UNKNOWN_ERROR', 'Unknown error') as E
    const exhaustedError = new RetryExhaustedError<E>(
      this.name,
      this.count + 1,
      // SAFE_CAST: E extends ZeroError
      lastError,
      { lastResult }
    ) as unknown as E
    return { ok: false, error: exhaustedError } as ZeroThrow.Result<T, E>
  }

  onRetry<E>(callback: (attempt: number, error: E, delay: number) => void): IRetryPolicy {
    this.retryCallback = callback as <F>(attempt: number, error: F, delay: number) => void
    return this
  }

  /**
   * Set operation ID for event tracking
   */
  withOperationId(id: string): this {
    this.eventManager?.setOperationId(id)
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
    
    const baseDelay = Math.min(calculatedDelay, maxDelay)
    return this.jitterCalculator.calculate(baseDelay, maxDelay)
  }

  private createJitterCalculator(): JitterCalculator {
    const { jitter } = this.options
    
    if (!jitter) {
      return new JitterCalculator({ strategy: 'none' })
    }
    
    if (typeof jitter === 'string') {
      return new JitterCalculator({ strategy: jitter })
    }
    
    return new JitterCalculator(jitter)
  }
}