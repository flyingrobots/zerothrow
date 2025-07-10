import type { Clock } from './clock.js'
import { RetryEventEmitter } from './event-emitter.js'
import type {
  RetryOptions,
  RetryEvent,
  RetryStartedEvent,
  RetryAttemptEvent,
  RetryFailedEvent,
  RetryBackoffEvent,
  RetrySucceededEvent,
  RetryExhaustedEvent,
  RetryEventHandlers
} from './types.js'

/**
 * Manages retry event emission with timing information
 */
export class RetryEventManager {
  private readonly emitter: RetryEventEmitter
  private readonly startTime: number
  private operationId?: string

  constructor(
    private readonly policyName: string,
    private readonly clock: Clock,
    handlers?: RetryEventHandlers,
    options?: import('./types.js').EventEmitterOptions
  ) {
    this.emitter = new RetryEventEmitter(options)
    this.startTime = clock.now().getTime()
    
    // Register handlers
    if (handlers) {
      if (handlers.onStarted) this.emitter.on('retry:started', handlers.onStarted)
      if (handlers.onAttempt) this.emitter.on('retry:attempt', handlers.onAttempt)
      if (handlers.onFailed) this.emitter.on('retry:failed', handlers.onFailed)
      if (handlers.onBackoff) this.emitter.on('retry:backoff', handlers.onBackoff)
      if (handlers.onSucceeded) this.emitter.on('retry:succeeded', handlers.onSucceeded)
      if (handlers.onExhausted) this.emitter.on('retry:exhausted', handlers.onExhausted)
      if (handlers.onEvent) this.emitter.on('all', handlers.onEvent)
    }
  }

  /**
   * Set operation ID for all events
   */
  setOperationId(id: string): void {
    this.operationId = id
  }

  /**
   * Emit retry started event
   */
  emitStarted(maxAttempts: number, options: RetryOptions): void {
    const event: RetryStartedEvent = {
      type: 'retry:started',
      timestamp: this.clock.now().getTime(),
      policyName: this.policyName,
      ...(this.operationId && { operationId: this.operationId }),
      maxAttempts,
      options: {
        ...(options.backoff && { backoff: options.backoff }),
        ...(options.delay !== undefined && { delay: options.delay }),
        ...(options.maxDelay !== undefined && { maxDelay: options.maxDelay })
      }
    }
    this.emitter.emit(event)
  }

  /**
   * Emit retry attempt event
   */
  emitAttempt(attemptNumber: number): void {
    const event: RetryAttemptEvent = {
      type: 'retry:attempt',
      timestamp: this.clock.now().getTime(),
      policyName: this.policyName,
      ...(this.operationId && { operationId: this.operationId }),
      attemptNumber,
      elapsed: this.clock.now().getTime() - this.startTime
    }
    this.emitter.emit(event)
  }

  /**
   * Emit retry failed event
   */
  emitFailed(attemptNumber: number, error: Error, willRetry: boolean): void {
    const event: RetryFailedEvent = {
      type: 'retry:failed',
      timestamp: this.clock.now().getTime(),
      policyName: this.policyName,
      ...(this.operationId && { operationId: this.operationId }),
      attemptNumber,
      error,
      elapsed: this.clock.now().getTime() - this.startTime,
      willRetry
    }
    this.emitter.emit(event)
  }

  /**
   * Emit retry backoff event
   */
  emitBackoff(attemptNumber: number, delay: number): void {
    const event: RetryBackoffEvent = {
      type: 'retry:backoff',
      timestamp: this.clock.now().getTime(),
      policyName: this.policyName,
      ...(this.operationId && { operationId: this.operationId }),
      attemptNumber,
      delay,
      nextAttemptAt: this.clock.now().getTime() + delay
    }
    this.emitter.emit(event)
  }

  /**
   * Emit retry succeeded event
   */
  emitSucceeded(attemptNumber: number): void {
    const event: RetrySucceededEvent = {
      type: 'retry:succeeded',
      timestamp: this.clock.now().getTime(),
      policyName: this.policyName,
      ...(this.operationId && { operationId: this.operationId }),
      attemptNumber,
      totalAttempts: attemptNumber,
      totalElapsed: this.clock.now().getTime() - this.startTime
    }
    this.emitter.emit(event)
  }

  /**
   * Emit retry exhausted event
   */
  emitExhausted(totalAttempts: number, lastError: Error): void {
    const event: RetryExhaustedEvent = {
      type: 'retry:exhausted',
      timestamp: this.clock.now().getTime(),
      policyName: this.policyName,
      ...(this.operationId && { operationId: this.operationId }),
      totalAttempts,
      lastError,
      totalElapsed: this.clock.now().getTime() - this.startTime
    }
    this.emitter.emit(event)
  }

  /**
   * Get the event buffer
   */
  getEventBuffer(): ReadonlyArray<RetryEvent> {
    return this.emitter.getBuffer()
  }

  /**
   * Clear the event buffer
   */
  clearEventBuffer(): void {
    this.emitter.clearBuffer()
  }
}