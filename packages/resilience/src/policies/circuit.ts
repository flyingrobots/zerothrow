import { ZT, type Result } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import { CircuitOpenError, type CircuitOptions } from '../types.js'
import type { Clock } from '../clock.js'

type CircuitState = 'closed' | 'open' | 'half-open'

export class CircuitBreakerPolicy extends BasePolicy {
  private state: CircuitState = 'closed'
  private failures = 0
  private lastFailureTime?: number
  private nextAllowedTime?: number
  
  constructor(
    private readonly options: CircuitOptions,
    clock?: Clock
  ) {
    super('circuit-breaker', clock)
  }

  async execute<T>(
    operation: () => Promise<T>
  ): Promise<Result<T, Error>> {
    // Check if circuit is open
    if (this.state === 'open') {
      const now = this.clock.now().getTime()
      
      // Check if we should try half-open
      if (this.nextAllowedTime && now >= this.nextAllowedTime) {
        this.state = 'half-open'
      } else {
        return ZT.err(new CircuitOpenError(
          this.name,
          new Date(this.lastFailureTime || now),
          this.failures
        ))
      }
    }
    
    // Try the operation
    const result = await this.runOperation(operation)
    
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
        return ZT.err(new CircuitOpenError(
          this.name,
          new Date(this.lastFailureTime || Date.now()),
          this.failures
        ))
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
    this.state = 'open'
    this.nextAllowedTime = this.clock.now().getTime() + this.options.duration
    this.options.onOpen?.()
  }
  
  private reset(): void {
    this.state = 'closed'
    this.failures = 0
    delete this.lastFailureTime
    delete this.nextAllowedTime
  }
}