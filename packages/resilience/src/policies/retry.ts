import { ZT, type Result } from '@zerothrow/core'
import { BasePolicy } from '../policy'
import { RetryExhaustedError, type RetryOptions } from '../types'
import type { Clock } from '../clock'

export class RetryPolicy extends BasePolicy {
  constructor(
    private readonly count: number,
    private readonly options: RetryOptions = {},
    clock?: Clock
  ) {
    super('retry', clock)
  }

  async execute<T>(
    operation: () => Promise<T>
  ): Promise<Result<T, Error>> {
    let lastError: Error | undefined
    
    for (let attempt = 0; attempt <= this.count; attempt++) {
      const result = await this.runOperation(operation)
      
      if (result.ok) {
        return result
      }
      
      lastError = result.error
      
      // Check if we should handle this error
      if (this.options.handle && !this.options.handle(result.error)) {
        return result
      }
      
      // If this is the last attempt, don't delay
      if (attempt < this.count) {
        await this.delay(attempt + 1)
      }
    }
    
    return ZT.err(new RetryExhaustedError(
      this.name,
      this.count + 1,
      lastError as Error
    ))
  }

  private async delay(attempt: number): Promise<void> {
    const delay = this.calculateDelay(attempt)
    await this.clock.sleep(delay)
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