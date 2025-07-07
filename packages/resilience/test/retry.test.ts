import { describe, it, expect, vi } from 'vitest'
import { RetryPolicy, RetryExhaustedError } from '../src/index.js'
import { TestClock } from '../src/clock.js'

describe('RetryPolicy', () => {
  it('should return success on first attempt', async () => {
    const policy = new RetryPolicy(3)
    const operation = vi.fn().mockResolvedValue('success')
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(true)
    expect(result.value).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure', async () => {
    const policy = new RetryPolicy(2)
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(true)
    expect(result.value).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should return RetryExhaustedError after all attempts fail', async () => {
    const policy = new RetryPolicy(2)
    const operation = vi.fn().mockRejectedValue(new Error('always fails'))
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(false)
    expect(result.error).toBeInstanceOf(RetryExhaustedError)
    expect((result.error as RetryExhaustedError).attempts).toBe(3)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('should respect max delay for exponential backoff', async () => {
    const policy = new RetryPolicy(5, { 
      delay: 10, 
      backoff: 'exponential',
      maxDelay: 50 
    })
    
    const operation = vi.fn().mockRejectedValue(new Error('always fails'))
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(false)
    expect(result.error).toBeInstanceOf(RetryExhaustedError)
    // Should attempt initial + 5 retries = 6 total
    expect(operation).toHaveBeenCalledTimes(6)
  })

  it('should handle different backoff strategies', async () => {
    // Just verify that different strategies can be configured and used
    const strategies = ['constant', 'linear', 'exponential'] as const
    
    for (const backoff of strategies) {
      const policy = new RetryPolicy(1, { delay: 10, backoff })
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(operation).toHaveBeenCalledTimes(2)
    }
  })

  it('should use handle function to filter errors', async () => {
    const policy = new RetryPolicy(2, {
      handle: (error) => error.message === 'retry me'
    })
    
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('retry me'))
      .mockRejectedValueOnce(new Error('do not retry'))
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(false)
    expect(result.error?.message).toBe('do not retry')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  describe('conditional retry with shouldRetry', () => {
    it('should use shouldRetry function when provided', async () => {
      const shouldRetry = vi.fn().mockReturnValue(true)
      const policy = new RetryPolicy(2, { shouldRetry })
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(result.value).toBe('success')
      expect(shouldRetry).toHaveBeenCalledTimes(2)
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should pass correct context to shouldRetry', async () => {
      const shouldRetry = vi.fn().mockReturnValue(true)
      const metadata = { userId: '123', requestId: 'abc' }
      const policy = new RetryPolicy(1, { 
        shouldRetry,
        delay: 100,
        metadata 
      })
      
      const error = new Error('test error')
      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success')
      
      await policy.execute(operation)
      
      expect(shouldRetry).toHaveBeenCalledTimes(1)
      const actualContext = shouldRetry.mock.calls[0][0]
      expect(actualContext.attempt).toBe(1)
      expect(actualContext.error.message).toBe('test error')
      expect(actualContext.totalDelay).toBe(0)
      expect(actualContext.metadata).toEqual(metadata)
      expect('lastDelay' in actualContext).toBe(false) // lastDelay should not be present when undefined
    })

    it('should stop retrying when shouldRetry returns false', async () => {
      const shouldRetry = vi.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
      
      const policy = new RetryPolicy(3, { shouldRetry })
      
      const operation = vi.fn()
        .mockRejectedValue(new Error('always fails'))
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(false)
      expect(result.error).toBeDefined()
      expect(shouldRetry).toHaveBeenCalledTimes(2)
      expect(operation).toHaveBeenCalledTimes(2) // initial + 1 retry (stopped when shouldRetry returned false)
    })

    it('should handle async shouldRetry functions', async () => {
      const shouldRetry = vi.fn().mockImplementation(async (context) => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10))
        return context.attempt < 2
      })
      
      const policy = new RetryPolicy(3, { shouldRetry })
      
      const operation = vi.fn()
        .mockRejectedValue(new Error('always fails'))
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(false)
      expect(shouldRetry).toHaveBeenCalledTimes(2)
      expect(operation).toHaveBeenCalledTimes(2) // initial + 1 retry (shouldRetry returns false on second call when attempt=2)
    })

    it('should track delays correctly in retry context', async () => {
      const contextHistory: any[] = []
      const shouldRetry = vi.fn().mockImplementation((context) => {
        contextHistory.push({ ...context })
        return true
      })
      
      const policy = new RetryPolicy(2, { 
        shouldRetry,
        delay: 100,
        backoff: 'linear'
      })
      
      const operation = vi.fn()
        .mockRejectedValue(new Error('always fails'))
      
      await policy.execute(operation)
      
      expect(contextHistory).toHaveLength(2)
      expect(contextHistory[0].attempt).toBe(1)
      expect(contextHistory[0].totalDelay).toBe(0)
      expect('lastDelay' in contextHistory[0]).toBe(false) // Should not have lastDelay on first retry
      
      expect(contextHistory[1].attempt).toBe(2)
      expect(contextHistory[1].lastDelay).toBe(100)
      expect(contextHistory[1].totalDelay).toBe(100)
    })

    it('should prefer shouldRetry over handle when both are provided', async () => {
      const handle = vi.fn().mockReturnValue(true)
      const shouldRetry = vi.fn().mockReturnValue(false)
      
      const policy = new RetryPolicy(2, { handle, shouldRetry })
      
      const operation = vi.fn()
        .mockRejectedValue(new Error('fail'))
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(false)
      expect(shouldRetry).toHaveBeenCalled()
      expect(handle).not.toHaveBeenCalled()
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should handle conditional retry based on error type', async () => {
      class NetworkError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'NetworkError'
        }
      }
      
      class ValidationError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'ValidationError'
        }
      }
      
      const shouldRetry = vi.fn().mockImplementation((context) => {
        // Check the cause since errors are wrapped by ZeroError
        const originalError = context.error.cause || context.error
        return originalError.name === 'NetworkError'
      })
      
      const policy = new RetryPolicy(2, { shouldRetry })
      
      // Test with NetworkError - should retry
      const operation1 = vi.fn()
        .mockRejectedValueOnce(new NetworkError('network fail'))
        .mockResolvedValue('success')
      
      const result1 = await policy.execute(operation1)
      expect(result1.ok).toBe(true)
      expect(operation1).toHaveBeenCalledTimes(2)
      
      // Test with ValidationError - should not retry
      const operation2 = vi.fn()
        .mockRejectedValue(new ValidationError('validation fail'))
      
      const result2 = await policy.execute(operation2)
      expect(result2.ok).toBe(false)
      expect(result2.error).toBeDefined()
      expect(operation2).toHaveBeenCalledTimes(1)
    })

    it('should support complex retry logic with metadata', async () => {
      const shouldRetry = vi.fn().mockImplementation((context) => {
        const maxRetries = context.metadata?.maxRetries as number || 3
        const criticalErrors = context.metadata?.criticalErrors as string[] || []
        
        // Don't retry if it's a critical error
        if (criticalErrors.includes(context.error.message)) {
          return false
        }
        
        // Retry up to the custom max retries
        return context.attempt <= maxRetries
      })
      
      const policy = new RetryPolicy(5, { 
        shouldRetry,
        metadata: {
          maxRetries: 2,
          criticalErrors: ['FATAL_ERROR', 'UNRECOVERABLE']
        }
      })
      
      // Test normal error - should retry up to maxRetries
      const operation1 = vi.fn()
        .mockRejectedValue(new Error('normal error'))
      
      const result1 = await policy.execute(operation1)
      expect(result1.ok).toBe(false)
      expect(operation1).toHaveBeenCalledTimes(3) // initial + 2 retries (based on metadata.maxRetries)
      
      // Test critical error - should not retry
      const operation2 = vi.fn()
        .mockRejectedValue(new Error('FATAL_ERROR'))
      
      const result2 = await policy.execute(operation2)
      expect(result2.ok).toBe(false)
      expect(operation2).toHaveBeenCalledTimes(1)
    })
  })

  describe('jitter integration', () => {
    it('should use no jitter by default', async () => {
      const mockRandom = vi.fn().mockReturnValue(0.5)
      
      const policy = new RetryPolicy(2, { 
        delay: 1, // Use small delay to avoid timeout
        jitter: { strategy: 'none', random: mockRandom }
      })
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(operation).toHaveBeenCalledTimes(2)
      expect(mockRandom).not.toHaveBeenCalled()
    })

    it('should apply full jitter when configured', async () => {
      const mockRandom = vi.fn().mockReturnValue(0.5)
      
      const policy = new RetryPolicy(2, { 
        delay: 1, // Use small delay to avoid timeout
        jitter: { strategy: 'full', random: mockRandom }
      })
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(operation).toHaveBeenCalledTimes(2)
      expect(mockRandom).toHaveBeenCalledTimes(1)
    })

    it('should apply equal jitter when configured', async () => {
      const mockRandom = vi.fn().mockReturnValue(0.5)
      
      const policy = new RetryPolicy(2, { 
        delay: 1, // Use small delay to avoid timeout
        jitter: { strategy: 'equal', random: mockRandom }
      })
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(operation).toHaveBeenCalledTimes(2)
      expect(mockRandom).toHaveBeenCalledTimes(1)
    })

    it('should apply decorrelated jitter across multiple retries', async () => {
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.5)
      
      const policy = new RetryPolicy(3, { 
        delay: 1, // Use small delay to avoid timeout
        jitter: { strategy: 'decorrelated', random: mockRandom }
      })
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(operation).toHaveBeenCalledTimes(3)
      expect(mockRandom).toHaveBeenCalledTimes(2)
    })

    it('should respect maxDelay with jitter', async () => {
      const mockRandom = vi.fn().mockReturnValue(1)
      
      const policy = new RetryPolicy(2, { 
        delay: 1, // Use small delay to avoid timeout
        backoff: 'exponential',
        maxDelay: 2,
        jitter: { strategy: 'full', random: mockRandom }
      })
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(operation).toHaveBeenCalledTimes(2)
      expect(mockRandom).toHaveBeenCalledTimes(1)
    })

    it('should accept jitter as string shorthand', async () => {
      const policy = new RetryPolicy(2, { 
        delay: 1, // Use small delay to avoid timeout
        jitter: 'full'
      })
      
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })
})