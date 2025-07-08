import { describe, it, expect, vi } from 'vitest'
import { RetryEventEmitter } from '../src/event-emitter.js'
import type { RetryEvent } from '../src/types.js'

describe('RetryEventEmitter', () => {
  it('should emit events to specific handlers', () => {
    const emitter = new RetryEventEmitter()
    const handler = vi.fn()
    
    const event: RetryEvent = {
      type: 'retry:started',
      timestamp: Date.now(),
      policyName: 'test-policy',
      maxAttempts: 3,
      options: {}
    }
    
    emitter.on('retry:started', handler)
    emitter.emit(event)
    
    expect(handler).toHaveBeenCalledWith(event)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should emit events to catch-all handlers', () => {
    const emitter = new RetryEventEmitter()
    const handler = vi.fn()
    
    const event: RetryEvent = {
      type: 'retry:failed',
      timestamp: Date.now(),
      policyName: 'test-policy',
      attemptNumber: 1,
      error: new Error('test'),
      elapsed: 100,
      willRetry: true
    }
    
    emitter.on('all', handler)
    emitter.emit(event)
    
    expect(handler).toHaveBeenCalledWith(event)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('should emit to both specific and catch-all handlers', () => {
    const emitter = new RetryEventEmitter()
    const specificHandler = vi.fn()
    const catchAllHandler = vi.fn()
    
    const event: RetryEvent = {
      type: 'retry:attempt',
      timestamp: Date.now(),
      policyName: 'test-policy',
      attemptNumber: 1,
      elapsed: 0
    }
    
    emitter.on('retry:attempt', specificHandler)
    emitter.on('all', catchAllHandler)
    emitter.emit(event)
    
    expect(specificHandler).toHaveBeenCalledWith(event)
    expect(catchAllHandler).toHaveBeenCalledWith(event)
    expect(specificHandler).toHaveBeenCalledTimes(1)
    expect(catchAllHandler).toHaveBeenCalledTimes(1)
  })

  it('should buffer events when buffering is enabled', () => {
    const emitter = new RetryEventEmitter({ buffered: true, bufferSize: 3 })
    
    const events: RetryEvent[] = [
      {
        type: 'retry:started',
        timestamp: 1,
        policyName: 'test',
        maxAttempts: 3,
        options: {}
      },
      {
        type: 'retry:attempt',
        timestamp: 2,
        policyName: 'test',
        attemptNumber: 1,
        elapsed: 10
      },
      {
        type: 'retry:failed',
        timestamp: 3,
        policyName: 'test',
        attemptNumber: 1,
        error: new Error('test'),
        elapsed: 20,
        willRetry: true
      },
      {
        type: 'retry:attempt',
        timestamp: 4,
        policyName: 'test',
        attemptNumber: 2,
        elapsed: 30
      }
    ]
    
    events.forEach(event => emitter.emit(event))
    
    const buffer = emitter.getBuffer()
    expect(buffer).toHaveLength(3)
    expect(buffer[0].timestamp).toBe(2) // First event should be dropped
    expect(buffer[1].timestamp).toBe(3)
    expect(buffer[2].timestamp).toBe(4)
  })

  it('should not buffer events when buffering is disabled', () => {
    const emitter = new RetryEventEmitter({ buffered: false })
    
    const event: RetryEvent = {
      type: 'retry:started',
      timestamp: Date.now(),
      policyName: 'test',
      maxAttempts: 3,
      options: {}
    }
    
    emitter.emit(event)
    
    const buffer = emitter.getBuffer()
    expect(buffer).toHaveLength(0)
  })

  it('should handle handler errors without disrupting event flow', () => {
    const emitter = new RetryEventEmitter()
    const errorHandler = vi.fn().mockImplementation(() => {
      throw new Error('Handler error')
    })
    const normalHandler = vi.fn()
    
    const event: RetryEvent = {
      type: 'retry:attempt',
      timestamp: Date.now(),
      policyName: 'test',
      attemptNumber: 1,
      elapsed: 0
    }
    
    // Register handlers in order
    emitter.on('retry:attempt', errorHandler)
    emitter.on('retry:attempt', normalHandler)
    
    emitter.emit(event)
    
    expect(errorHandler).toHaveBeenCalledWith(event)
    expect(normalHandler).toHaveBeenCalledWith(event)
    // Error should be swallowed and not break the flow
  })

  it('should remove handlers correctly', () => {
    const emitter = new RetryEventEmitter()
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    
    const event: RetryEvent = {
      type: 'retry:attempt',
      timestamp: Date.now(),
      policyName: 'test',
      attemptNumber: 1,
      elapsed: 0
    }
    
    emitter.on('retry:attempt', handler1)
    emitter.on('retry:attempt', handler2)
    
    emitter.emit(event)
    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
    
    emitter.off('retry:attempt', handler1)
    
    emitter.emit(event)
    expect(handler1).toHaveBeenCalledTimes(1) // Not called again
    expect(handler2).toHaveBeenCalledTimes(2) // Called again
  })

  it('should clear buffer', () => {
    const emitter = new RetryEventEmitter({ buffered: true })
    
    const event: RetryEvent = {
      type: 'retry:started',
      timestamp: Date.now(),
      policyName: 'test',
      maxAttempts: 3,
      options: {}
    }
    
    emitter.emit(event)
    expect(emitter.getBuffer()).toHaveLength(1)
    
    emitter.clearBuffer()
    expect(emitter.getBuffer()).toHaveLength(0)
  })

  it('should count handlers correctly', () => {
    const emitter = new RetryEventEmitter()
    
    expect(emitter.handlerCount()).toBe(0)
    
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    const handler3 = vi.fn()
    
    emitter.on('retry:attempt', handler1)
    emitter.on('retry:attempt', handler2)
    emitter.on('retry:failed', handler3)
    emitter.on('all', handler1)
    
    expect(emitter.handlerCount()).toBe(4)
    
    emitter.off('retry:attempt', handler1)
    expect(emitter.handlerCount()).toBe(3)
  })

  it('should remove all handlers', () => {
    const emitter = new RetryEventEmitter()
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    
    emitter.on('retry:attempt', handler1)
    emitter.on('retry:failed', handler2)
    emitter.on('all', handler1)
    
    expect(emitter.handlerCount()).toBe(3)
    
    emitter.removeAllHandlers()
    expect(emitter.handlerCount()).toBe(0)
    
    const event: RetryEvent = {
      type: 'retry:attempt',
      timestamp: Date.now(),
      policyName: 'test',
      attemptNumber: 1,
      elapsed: 0
    }
    
    emitter.emit(event)
    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
  })
})