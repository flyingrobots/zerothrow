import { ZT, type Result } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import { TimeoutError, type TimeoutOptions } from '../types.js'
import type { Clock } from '../clock.js'

export class TimeoutPolicy extends BasePolicy {
  constructor(
    private readonly options: TimeoutOptions,
    clock?: Clock
  ) {
    super('timeout', clock)
  }

  async execute<T>(
    operation: () => Promise<T>
  ): Promise<Result<T, Error>> {
    const startTime = this.clock.now().getTime()
    
    // Create a timeout promise that rejects after the specified time
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const elapsed = this.clock.now().getTime() - startTime
        reject(new TimeoutError(
          this.name,
          this.options.timeout,
          elapsed
        ))
      }, this.options.timeout)
    })
    
    try {
      // Race the operation against the timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ])
      
      return ZT.ok(result)
    } catch (error) {
      // Check if it's our timeout error
      if (error instanceof TimeoutError) {
        return ZT.err(error)
      }
      
      // Otherwise it's an error from the operation
      return ZT.err(error instanceof Error ? error : new Error(String(error)))
    }
  }
}