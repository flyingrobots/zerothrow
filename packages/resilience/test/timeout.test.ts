import { describe, it, expect, vi } from 'vitest'
import { TimeoutPolicy, TimeoutError } from '../src/index.js'

describe('TimeoutPolicy', () => {
  it('should return success when operation completes in time', async () => {
    const policy = new TimeoutPolicy({ timeout: 100 })
    const operation = vi.fn().mockResolvedValue('success')
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(true)
    expect(result.value).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should return TimeoutError when operation exceeds timeout', async () => {
    const policy = new TimeoutPolicy({ timeout: 50 })
    const operation = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return 'too late'
    })
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(false)
    expect(result.error).toBeInstanceOf(TimeoutError)
    expect((result.error as TimeoutError).timeout).toBe(50)
  })

  it('should accept timeout as number', async () => {
    const policy = new TimeoutPolicy(100)
    const operation = vi.fn().mockResolvedValue('success')
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(true)
    expect(result.value).toBe('success')
  })

  it('should preserve operation errors', async () => {
    const policy = new TimeoutPolicy({ timeout: 100 })
    const error = new Error('operation failed')
    const operation = vi.fn().mockRejectedValue(error)
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(false)
    expect(result.error).toBe(error)
  })

  it('should handle non-Error rejections', async () => {
    const policy = new TimeoutPolicy({ timeout: 100 })
    const operation = vi.fn().mockRejectedValue('string error')
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(false)
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('string error')
  })
})