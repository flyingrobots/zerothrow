import { describe, it, expect, vi } from 'vitest'
import { TimeoutPolicy, TimeoutError } from '../src/index.js'
import { ZT } from '@zerothrow/core'
import '@zerothrow/vitest'

describe('TimeoutPolicy', () => {
  it('should return success when operation completes in time', async () => {
    const policy = new TimeoutPolicy({ timeout: 100 })
    const operation = vi.fn(() => ZT.ok('success'))
    
    const result = await policy.execute(operation)
    
    expect(result).toBeOkWith('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should return TimeoutError when operation exceeds timeout', async () => {
    const policy = new TimeoutPolicy({ timeout: 50 })
    const operation = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return ZT.ok('too late')
    })
    
    const result = await policy.execute(operation)
    
    expect(result).toBeErr()
    if (result.ok) return
    expect(result.error).toBeInstanceOf(TimeoutError)
    expect((result.error as TimeoutError).context?.timeout).toBe(50)
  })

  it('should accept timeout as number', async () => {
    const policy = new TimeoutPolicy({ timeout: 100 })
    const operation = vi.fn(() => ZT.ok('success'))
    
    const result = await policy.execute(operation)
    
    expect(result).toBeOkWith('success')
  })

  it('should preserve operation errors', async () => {
    const policy = new TimeoutPolicy({ timeout: 100 })
    const error = new Error('operation failed')
    const operation = vi.fn(() => ZT.err(error))
    
    const result = await policy.execute(operation)
    
    expect(result).toBeErrWith(error)
  })

  it('should handle non-Error rejections', async () => {
    const policy = new TimeoutPolicy({ timeout: 100 })
    const operation = vi.fn(() => {
      return ZT.try(() => {
        throw 'string error'
      })
    })
    
    const result = await policy.execute(operation)
    
    expect(result).toBeErr()
    if (result.ok) return
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error?.message).toBe('string error')
  })
})