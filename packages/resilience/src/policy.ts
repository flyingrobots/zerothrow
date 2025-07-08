import { type ZeroThrow, ZeroError } from '@zerothrow/core'
import type { Policy } from './types.js'
import { SystemClock, type Clock } from './clock.js'

export abstract class BasePolicy implements Policy {
  constructor(
    protected readonly name: string,
    protected readonly clock: Clock = new SystemClock()
  ) {}

  abstract execute<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, E>
}