import { ZT, type Result } from '@zerothrow/core'
import type { Policy } from './types.js'
import { SystemClock, type Clock } from './clock.js'

export abstract class BasePolicy implements Policy {
  constructor(
    protected readonly name: string,
    protected readonly clock: Clock = new SystemClock()
  ) {}

  abstract execute<T>(
    operation: () => Promise<T>
  ): Promise<Result<T, Error>>

  protected async runOperation<T>(
    operation: () => Promise<T>
  ): Promise<Result<T, Error>> {
    return ZT.tryAsync(operation)
  }
}