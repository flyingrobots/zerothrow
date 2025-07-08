import type { RetryEvent, RetryEventHandler, EventEmitterOptions } from './types.js'

/**
 * Event emitter for retry events with support for immediate and buffered emission
 */
export class RetryEventEmitter {
  private handlers: Map<string, Set<RetryEventHandler>> = new Map()
  private buffer: RetryEvent[] = []
  private readonly options: Required<EventEmitterOptions>

  constructor(options: EventEmitterOptions = {}) {
    this.options = {
      buffered: options.buffered ?? false,
      bufferSize: options.bufferSize ?? 100
    }
  }

  /**
   * Register an event handler
   */
  on<T extends RetryEvent>(
    eventType: T['type'] | 'all',
    handler: RetryEventHandler<T>
  ): void {
    const key = eventType === 'all' ? '*' : eventType
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set())
    }
    const handlers = this.handlers.get(key)
    if (handlers) {
      handlers.add(handler as RetryEventHandler)
    }
  }

  /**
   * Remove an event handler
   */
  off<T extends RetryEvent>(
    eventType: T['type'] | 'all',
    handler: RetryEventHandler<T>
  ): void {
    const key = eventType === 'all' ? '*' : eventType
    const handlers = this.handlers.get(key)
    if (handlers) {
      handlers.delete(handler as RetryEventHandler)
      if (handlers.size === 0) {
        this.handlers.delete(key)
      }
    }
  }

  /**
   * Emit an event synchronously
   */
  emit(event: RetryEvent): void {
    // Store in buffer if buffering is enabled
    if (this.options.buffered) {
      this.buffer.push(event)
      if (this.buffer.length > this.options.bufferSize) {
        this.buffer.shift() // Remove oldest event
      }
    }

    // Emit to specific handlers
    const specificHandlers = this.handlers.get(event.type)
    if (specificHandlers) {
      for (const handler of specificHandlers) {
        try {
          handler(event)
        } catch {
          // Swallow errors from handlers to prevent disrupting retry flow
          // In production, you might want to use a proper logger here
        }
      }
    }

    // Emit to catch-all handlers
    const allHandlers = this.handlers.get('*')
    if (allHandlers) {
      for (const handler of allHandlers) {
        try {
          handler(event)
        } catch {
          // Swallow errors from handlers to prevent disrupting retry flow
          // In production, you might want to use a proper logger here
        }
      }
    }
  }

  /**
   * Get buffered events
   */
  getBuffer(): ReadonlyArray<RetryEvent> {
    return [...this.buffer]
  }

  /**
   * Clear the event buffer
   */
  clearBuffer(): void {
    this.buffer = []
  }

  /**
   * Get the number of registered handlers
   */
  handlerCount(): number {
    let count = 0
    for (const handlers of this.handlers.values()) {
      count += handlers.size
    }
    return count
  }

  /**
   * Remove all event handlers
   */
  removeAllHandlers(): void {
    this.handlers.clear()
  }
}