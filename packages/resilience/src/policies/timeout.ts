import { ZT, ZeroThrow, ZeroError } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import { TimeoutError, type TimeoutOptions } from '../types.js'
import type { Clock } from '../clock.js'

// Sentinel value to identify timeout
const TIMEOUT_SENTINEL = Symbol('timeout')

export class TimeoutPolicy extends BasePolicy {
  constructor(
    private readonly options: TimeoutOptions,
    clock?: Clock
  ) {
    super('timeout', clock)
  }

  execute<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, E> {
    return ZeroThrow.enhance(this.executeAsync(operation))
  }

  private async executeAsync<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): Promise<ZeroThrow.Result<T, E>> {
      const startTime = this.clock.now().getTime()
      
      // Create abort controller for cleanup
      const abortController = new AbortController()
      
      // Create a timeout promise that resolves with our sentinel
      const timeoutPromise = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
        const timeoutId = setTimeout(() => {
          abortController.abort()
          resolve(TIMEOUT_SENTINEL)
        }, this.options.timeout)
        
        // Clean up timeout if aborted
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
        })
      })
      
      // Race the operation against the timeout
      const raceResult = await Promise.race([
        operation(),
        timeoutPromise
      ])
      
      // Check which promise won
      if (raceResult === TIMEOUT_SENTINEL) {
        const elapsed = this.clock.now().getTime() - startTime
        // SAFE_CAST: TimeoutError extends ZeroError, cast to generic E
        return ZT.err(new TimeoutError(
          this.name,
          this.options.timeout,
          elapsed
        ) as unknown as E) as unknown as ZeroThrow.Result<T, E>
      }
      
      // Operation completed first, abort the timeout
      abortController.abort()
      
      // Return the operation's result directly
      return raceResult
  }
}