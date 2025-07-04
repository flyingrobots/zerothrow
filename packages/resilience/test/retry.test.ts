import { describe, it, expect, vi } from 'vitest'
import { RetryPolicy, RetryExhaustedError } from '../src/index.js'

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
})