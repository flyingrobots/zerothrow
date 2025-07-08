import { ZT, ZeroThrow, ZeroError } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import { CircuitOpenError, type CircuitOptions, type CircuitBreakerPolicy as ICircuitBreakerPolicy } from '../types.js'
import type { Clock } from '../clock.js'

type CircuitState = 'closed' | 'open' | 'half-open'

export class CircuitBreakerPolicy extends BasePolicy implements ICircuitBreakerPolicy {
  private state: CircuitState = 'closed'
  private failures = 0
  private lastFailureTime?: number
  private nextAllowedTime?: number
  private stateChangeCallback?: (state: CircuitState) => void
  
  constructor(
    private readonly options: CircuitOptions,
    clock?: Clock
  ) {
    super('circuit-breaker', clock)
  }

  execute<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, E> {
    return ZeroThrow.enhance(this.executeAsync(operation))
  }

  private async executeAsync<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): Promise<ZeroThrow.Result<T, E>> {
    // Check if circuit is open
    if (this.state === 'open') {
      const now = this.clock.now().getTime()
      
      // Check if we should try half-open
      if (this.nextAllowedTime && now >= this.nextAllowedTime) {
        this.setState('half-open')
      } else {
        // When circuit is open, we need to return an error of type E
        // SAFE_CAST: CircuitOpenError is a valid error type
        const circuitError = new CircuitOpenError<E>(
          this.name,
          new Date(this.lastFailureTime || now),
          this.failures
        )
        // SAFE_CAST: Type assertion necessary - CircuitOpenError extends Error
        return ZT.err(circuitError as unknown as E) as unknown as ZeroThrow.Result<T, E>
      }
    }
    
    // Execute the operation directly - it returns a Result
    const result = await operation()
    
    if (result.ok) {
      this.onSuccess()
      return result
    } else {
      // At this point, state is either 'closed' or 'half-open'
      this.onFailure()
      
      // After onFailure(), check if circuit is now open
      // This cast is safe because onFailure() may have changed the state
      const currentState = this.state as CircuitState
      if (currentState === 'open') {
        // Circuit just opened, return circuit error instead of original error
        // Circuit just opened due to this failure, wrap the original error
        const circuitError = new CircuitOpenError<E>(
          this.name,
          new Date(this.lastFailureTime || Date.now()),
          this.failures,
          undefined,
          result.error  // Preserve the original error
        )
        // SAFE_CAST: Type assertion necessary - CircuitOpenError extends Error
        return ZT.err(circuitError as unknown as E) as unknown as ZeroThrow.Result<T, E>
      }
      
      return result
    }
  }
  
  private onSuccess(): void {
    if (this.state === 'half-open') {
      // Circuit recovery successful
      this.reset()
      this.options.onClose?.()
    }
    // In closed state, success doesn't change anything
  }
  
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = this.clock.now().getTime()
    
    if (this.state === 'half-open') {
      // Failed during recovery, reopen immediately
      this.open()
    } else if (this.failures >= this.options.threshold) {
      // Threshold reached, open circuit
      this.open()
    }
  }
  
  private open(): void {
    this.setState('open')
    this.nextAllowedTime = this.clock.now().getTime() + this.options.duration
    this.options.onOpen?.()
  }
  
  private reset(): void {
    this.setState('closed')
    this.failures = 0
    delete this.lastFailureTime
    delete this.nextAllowedTime
  }

  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState
      this.stateChangeCallback?.(newState)
    }
  }

  onCircuitStateChange(callback: (state: CircuitState) => void): ICircuitBreakerPolicy {
    this.stateChangeCallback = callback
    return this
  }
}