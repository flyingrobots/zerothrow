import { describe, it, expect, vi } from 'vitest'
import { PolicyFactory as Policy, wrap, compose, TestClock } from '../src/index.js'

describe('Policy composition', () => {
  describe('wrap', () => {
    it('should compose two policies', async () => {
      const retry = Policy.retry(2, { delay: 10 })
      const timeout = Policy.timeout(100)
      
      const combined = wrap(retry, timeout)
      
      let attempts = 0
      const operation = vi.fn(async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('fail')
        }
        return 'success'
      })
      
      const result = await combined.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(result.value).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should propagate errors through the chain', async () => {
      const retry = Policy.retry(1)
      const timeout = Policy.timeout(50)
      
      const combined = wrap(retry, timeout)
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'too late'
      })
      
      const result = await combined.execute(operation)
      
      expect(result.ok).toBe(false)
      // The retry policy will see the timeout error and retry once
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('compose', () => {
    it('should compose multiple policies left to right', async () => {
      const clock = new TestClock()
      const retry = Policy.retry(2, { delay: 10 }, clock)
      const circuit = Policy.circuitBreaker({ threshold: 3, duration: 1000 }, clock)
      const timeout = Policy.timeout(100, clock)
      
      const combined = compose(retry, circuit, timeout)
      
      const operation = vi.fn().mockResolvedValue('success')
      const result = await combined.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(result.value).toBe('success')
    })

    it('should throw with no policies', () => {
      expect(() => compose()).toThrow('compose requires at least one policy')
    })

    it('should return single policy unchanged', async () => {
      const timeout = Policy.timeout(100)
      const composed = compose(timeout)
      
      const operation = vi.fn().mockResolvedValue('success')
      const result = await composed.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(result.value).toBe('success')
    })
  })

  describe('Policy factory integration', () => {
    it('should work with Policy factory methods', async () => {
      const policy = Policy.compose(
        Policy.retry(2, { delay: 10 }),
        Policy.timeout(100)
      )
      
      let attempts = 0
      const operation = vi.fn(async () => {
        attempts++
        if (attempts === 1) {
          throw new Error('first attempt fails')
        }
        return 'success on retry'
      })
      
      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(result.value).toBe('success on retry')
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })
})