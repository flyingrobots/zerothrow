import { describe, it, expect, vi } from 'vitest'
import { RetryPolicy } from '../src/index.js'
import type { RetryEvent, RetryEventHandlers } from '../src/types.js'
import { ZT } from '@zerothrow/core'

describe('Retry Events - Simple Tests', () => {
  it('should emit events for successful retry', async () => {
    const events: RetryEvent[] = []
    const handlers: RetryEventHandlers = {
      onEvent: (event) => events.push(event)
    }
    
    const policy = new RetryPolicy(2, { 
      delay: 10, // Very short delay
      events: handlers 
    })
    
    const operation = vi.fn()
      .mockResolvedValueOnce(ZT.err(new Error('fail 1')))
      .mockResolvedValue(ZT.ok('success'))
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(true)
    expect(events.length).toBeGreaterThan(0)
    
    // Check that we have the expected event types
    const eventTypes = events.map(e => e.type)
    expect(eventTypes).toContain('retry:started')
    expect(eventTypes).toContain('retry:attempt')
    expect(eventTypes).toContain('retry:failed')
    expect(eventTypes).toContain('retry:backoff')
    expect(eventTypes).toContain('retry:succeeded')
  })

  it('should emit exhausted event when all retries fail', async () => {
    const events: RetryEvent[] = []
    const handlers: RetryEventHandlers = {
      onEvent: (event) => events.push(event)
    }
    
    const policy = new RetryPolicy(1, { 
      delay: 10, // Very short delay
      events: handlers 
    })
    
    const operation = vi.fn().mockResolvedValue(ZT.err(new Error('always fails')))
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(false)
    
    const eventTypes = events.map(e => e.type)
    expect(eventTypes).toContain('retry:exhausted')
    
    const exhaustedEvent = events.find(e => e.type === 'retry:exhausted')
    expect(exhaustedEvent).toBeDefined()
    expect(exhaustedEvent?.totalAttempts).toBe(2)
    expect(exhaustedEvent?.lastError?.message).toBe('always fails')
  })

  it('should call individual event handlers', async () => {
    const onStarted = vi.fn()
    const onAttempt = vi.fn()
    const onFailed = vi.fn()
    const onBackoff = vi.fn()
    const onSucceeded = vi.fn()
    
    const handlers: RetryEventHandlers = {
      onStarted,
      onAttempt,
      onFailed,
      onBackoff,
      onSucceeded
    }
    
    const policy = new RetryPolicy(1, { 
      delay: 10,
      events: handlers 
    })
    
    const operation = vi.fn()
      .mockResolvedValueOnce(ZT.err(new Error('fail')))
      .mockResolvedValue(ZT.ok('success'))
    
    await policy.execute(operation)
    
    expect(onStarted).toHaveBeenCalledTimes(1)
    expect(onAttempt).toHaveBeenCalledTimes(2)
    expect(onFailed).toHaveBeenCalledTimes(1)
    expect(onBackoff).toHaveBeenCalledTimes(1)
    expect(onSucceeded).toHaveBeenCalledTimes(1)
  })

  it('should emit failed event with willRetry=false when error is not handled', async () => {
    const events: RetryEvent[] = []
    const handlers: RetryEventHandlers = {
      onEvent: (event) => events.push(event)
    }
    
    const policy = new RetryPolicy(2, {
      handle: (error) => error.message === 'retry me',
      events: handlers
    })
    
    const operation = vi.fn()
      .mockResolvedValueOnce(ZT.err(new Error('do not retry')))
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(false)
    
    const failedEvent = events.find(e => e.type === 'retry:failed')
    expect(failedEvent).toBeDefined()
    expect(failedEvent?.willRetry).toBe(false)
  })

  it('should include operation ID when set', async () => {
    const events: RetryEvent[] = []
    const handlers: RetryEventHandlers = {
      onEvent: (event) => events.push(event)
    }
    
    const policy = new RetryPolicy(1, { 
      delay: 10,
      events: handlers 
    })
    
    policy.withOperationId('test-operation-123')
    
    const operation = vi.fn().mockResolvedValue(ZT.ok('success'))
    
    await policy.execute(operation)
    
    events.forEach(event => {
      expect(event.operationId).toBe('test-operation-123')
    })
  })

  it('should maintain backward compatibility with onRetry callback', async () => {
    const onRetryCallback = vi.fn()
    const events: RetryEvent[] = []
    const handlers: RetryEventHandlers = {
      onEvent: (event) => events.push(event)
    }
    
    const policy = new RetryPolicy(1, { 
      delay: 10,
      events: handlers 
    })
    
    policy.onRetry(onRetryCallback)
    
    const operation = vi.fn()
      .mockResolvedValueOnce(ZT.err(new Error('fail')))
      .mockResolvedValue(ZT.ok('success'))
    
    await policy.execute(operation)
    
    // Both legacy callback and new events should work
    expect(onRetryCallback).toHaveBeenCalledWith(1, expect.any(Error), 10)
    expect(events.length).toBeGreaterThan(0)
  })

  it('should include timing information in events', async () => {
    const events: RetryEvent[] = []
    const handlers: RetryEventHandlers = {
      onEvent: (event) => events.push(event)
    }
    
    const policy = new RetryPolicy(1, { 
      delay: 10,
      events: handlers 
    })
    
    const operation = vi.fn()
      .mockResolvedValueOnce(ZT.err(new Error('fail')))
      .mockResolvedValue(ZT.ok('success'))
    
    await policy.execute(operation)
    
    // Check that events have timestamps
    events.forEach(event => {
      expect(event.timestamp).toBeGreaterThan(0)
    })
    
    // Check that timing events have proper fields
    const backoffEvent = events.find(e => e.type === 'retry:backoff')
    expect(backoffEvent).toBeDefined()
    expect(backoffEvent?.delay).toBe(10)
    expect(backoffEvent?.nextAttemptAt).toBeGreaterThan(backoffEvent?.timestamp)
    
    const succeededEvent = events.find(e => e.type === 'retry:succeeded')
    expect(succeededEvent).toBeDefined()
    expect(succeededEvent?.totalElapsed).toBeGreaterThan(0)
  })

  it('should handle different backoff strategies in events', async () => {
    const events: RetryEvent[] = []
    const handlers: RetryEventHandlers = {
      onEvent: (event) => events.push(event)
    }
    
    const policy = new RetryPolicy(3, { 
      delay: 10,
      backoff: 'exponential',
      maxDelay: 50,
      events: handlers 
    })
    
    const operation = vi.fn().mockResolvedValue(ZT.err(new Error('fail')))
    
    await policy.execute(operation)
    
    const backoffEvents = events.filter(e => e.type === 'retry:backoff')
    
    expect(backoffEvents[0].delay).toBe(10)  // 10 * 2^0
    expect(backoffEvents[1].delay).toBe(20)  // 10 * 2^1
    expect(backoffEvents[2].delay).toBe(40)  // 10 * 2^2
  })
})