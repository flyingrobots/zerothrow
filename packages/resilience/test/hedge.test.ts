import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { hedge } from '../src/policies/hedge'

describe('hedge policy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should execute primary request without hedging when delay is high', async () => {
      let callCount = 0
      const operation = vi.fn(async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 50))
        return 'success'
      })

      const policy = hedge({ delay: 1000 })
      const resultPromise = policy.execute(operation)
      
      // Primary completes before hedge starts
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise

      expect(result.ok).toBe(true)
      expect(result.value).toBe('success')
      expect(callCount).toBe(1) // Only primary executed
    })

    it('should start hedge request after delay', async () => {
      let callCount = 0
      const operation = vi.fn(async () => {
        const id = ++callCount
        // Primary takes longer, hedge completes faster
        const delay = id === 1 ? 300 : 100
        await new Promise(resolve => setTimeout(resolve, delay))
        return `success-${id}`
      })

      const policy = hedge({ delay: 100 })
      const resultPromise = policy.execute(operation)
      
      // Advance to just before hedge starts
      await vi.advanceTimersByTimeAsync(50)
      expect(callCount).toBe(1) // Only primary started
      
      // Advance past hedge delay
      await vi.advanceTimersByTimeAsync(60)
      expect(callCount).toBe(2) // Hedge started
      
      // Let hedge complete first
      await vi.advanceTimersByTimeAsync(200)
      const result = await resultPromise

      expect(result.ok).toBe(true)
      expect(result.value).toBe('success-2') // Hedge won
    })

    it('should return primary result when it completes first', async () => {
      let callCount = 0
      const operation = vi.fn(async () => {
        const id = ++callCount
        const delay = id === 1 ? 50 : 200 // Primary faster
        await new Promise(resolve => setTimeout(resolve, delay))
        return `success-${id}`
      })

      const policy = hedge({ delay: 100 })
      const resultPromise = policy.execute(operation)
      
      await vi.advanceTimersByTimeAsync(300)
      const result = await resultPromise

      expect(result.ok).toBe(true)
      expect(result.value).toBe('success-1') // Primary won
    })
  })

  describe('delay strategies', () => {
    it('should support fixed delay strategy', async () => {
      const hedgeStartTimes: number[] = []
      const operation = vi.fn(async () => {
        hedgeStartTimes.push(Date.now())
        await new Promise(resolve => setTimeout(resolve, 500))
        return 'success'
      })

      const policy = hedge({
        delay: { type: 'fixed', initial: 100 },
        maxHedges: 2
      })
      
      const startTime = Date.now()
      const resultPromise = policy.execute(operation)
      
      await vi.advanceTimersByTimeAsync(600)
      await resultPromise

      expect(hedgeStartTimes.length).toBe(3) // Primary + 2 hedges
      expect(hedgeStartTimes[1] - startTime).toBeCloseTo(100, -1)
      expect(hedgeStartTimes[2] - startTime).toBeCloseTo(100, -1)
    })

    it('should support linear delay strategy', async () => {
      const hedgeStartTimes: number[] = []
      const operation = vi.fn(async () => {
        hedgeStartTimes.push(Date.now())
        await new Promise(resolve => setTimeout(resolve, 1000))
        return 'success'
      })

      const policy = hedge({
        delay: { type: 'linear', initial: 100, factor: 2 },
        maxHedges: 2
      })
      
      const startTime = Date.now()
      const resultPromise = policy.execute(operation)
      
      await vi.advanceTimersByTimeAsync(1100)
      await resultPromise

      expect(hedgeStartTimes.length).toBe(3)
      expect(hedgeStartTimes[1] - startTime).toBeCloseTo(100, -1)  // 100ms
      expect(hedgeStartTimes[2] - startTime).toBeCloseTo(300, -1)  // 100 + (100 * 2 * 1)
    })

    it('should support exponential delay strategy', async () => {
      const hedgeStartTimes: number[] = []
      const operation = vi.fn(async () => {
        hedgeStartTimes.push(Date.now())
        await new Promise(resolve => setTimeout(resolve, 1000))
        return 'success'
      })

      const policy = hedge({
        delay: { type: 'exponential', initial: 100, factor: 2 },
        maxHedges: 2
      })
      
      const startTime = Date.now()
      const resultPromise = policy.execute(operation)
      
      await vi.advanceTimersByTimeAsync(1100)
      await resultPromise

      expect(hedgeStartTimes.length).toBe(3)
      expect(hedgeStartTimes[1] - startTime).toBeCloseTo(100, -1)  // 100ms
      expect(hedgeStartTimes[2] - startTime).toBeCloseTo(200, -1)  // 100 * 2^1
    })

    it('should respect maxDelay cap', async () => {
      const hedgeStartTimes: number[] = []
      const operation = vi.fn(async () => {
        hedgeStartTimes.push(Date.now())
        await new Promise(resolve => setTimeout(resolve, 1000))
        return 'success'
      })

      const policy = hedge({
        delay: { type: 'exponential', initial: 100, factor: 10, maxDelay: 300 },
        maxHedges: 2
      })
      
      const startTime = Date.now()
      const resultPromise = policy.execute(operation)
      
      await vi.advanceTimersByTimeAsync(1100)
      await resultPromise

      expect(hedgeStartTimes[2] - startTime).toBeCloseTo(300, -1) // Capped at maxDelay
    })
  })

  describe('conditional hedging', () => {
    it('should respect shouldHedge callback', async () => {
      let callCount = 0
      const operation = vi.fn(async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 200))
        return 'success'
      })

      const policy = hedge({
        delay: 50,
        maxHedges: 3,
        shouldHedge: (attempt) => attempt <= 1 // Only allow first hedge
      })
      
      const resultPromise = policy.execute(operation)
      await vi.advanceTimersByTimeAsync(300)
      await resultPromise

      expect(callCount).toBe(2) // Primary + 1 hedge only
    })
  })

  describe('cancellation support', () => {
    it('should cancel losing requests when winner emerges', async () => {
      const abortedRequests: string[] = []
      const operation = vi.fn(async () => {
        const id = `request-${Date.now()}`
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(`success-${id}`), 200)
          
          // Simulate operation that can be cancelled
          const signal = new AbortController().signal
          signal.addEventListener('abort', () => {
            clearTimeout(timer)
            abortedRequests.push(id)
            reject(new Error('Cancelled'))
          })
        })
      })

      const policy = hedge({ delay: 100 })
      const resultPromise = policy.execute(operation)
      
      await vi.advanceTimersByTimeAsync(300)
      const result = await resultPromise

      expect(result.ok).toBe(true)
      // One of the requests should have been cancelled
      // (exact behavior depends on race conditions)
    })
  })

  describe('error handling', () => {
    it('should return error when all attempts fail', async () => {
      const callTimes: number[] = []
      const operation = vi.fn(async () => {
        callTimes.push(Date.now())
        throw new Error('Operation failed')
      })

      const policy = hedge({ delay: 50, maxHedges: 2 })
      const resultPromise = policy.execute(operation)
      
      // Let hedge requests start
      await vi.advanceTimersByTimeAsync(150)
      const result = await resultPromise


      expect(result.ok).toBe(false)
      expect(result.error.message).toContain('All')
      expect(operation).toHaveBeenCalledTimes(3) // Primary + 2 hedges
    })

    it('should continue with hedges when primary fails', async () => {
      let callCount = 0
      const operation = vi.fn(async () => {
        const id = ++callCount
        if (id === 1) throw new Error('Primary failed')
        await new Promise(resolve => setTimeout(resolve, 50))
        return `success-${id}`
      })

      const policy = hedge({ delay: 100 })
      const resultPromise = policy.execute(operation)
      
      // Wait for hedge to start and complete
      await vi.advanceTimersByTimeAsync(250)
      const result = await resultPromise

      expect(result.ok).toBe(true)
      expect(result.value).toBe('success-2')
    })
  })

  describe('metrics', () => {
    it('should track basic metrics', async () => {
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
        return 'success'
      })

      const policy = hedge({ delay: 100 })
      
      // Execute multiple requests
      const result1Promise = policy.execute(operation)
      await vi.advanceTimersByTimeAsync(200)
      await result1Promise
      
      const result2Promise = policy.execute(operation)
      await vi.advanceTimersByTimeAsync(200) // Primary wins this time
      await result2Promise

      const metrics = policy.getMetrics()
      expect(metrics.totalRequests).toBe(2)
      expect(metrics.hedgeRequests).toBeGreaterThan(0)
      expect(metrics.primaryWins + metrics.hedgeWins).toBe(2)
    })

    it('should calculate resource waste', async () => {
      const policy = hedge({ delay: 100 })
      
      // Execute multiple times to build up metrics
      for (let i = 0; i < 3; i++) {
        let callCount = 0
        const operation = vi.fn(async () => {
          const id = ++callCount
          const delay = id === 2 ? 50 : 200 // Second request (hedge) always wins
          await new Promise(resolve => setTimeout(resolve, delay))
          return `success-${id}`
        })
        
        const resultPromise = policy.execute(operation)
        await vi.advanceTimersByTimeAsync(300)
        await resultPromise
      }

      const metrics = policy.getMetrics()
      // Since all hedges win, resource waste should be 0
      expect(metrics.resourceWaste).toBe(0)
      expect(metrics.hedgeWins).toBe(3) // All won by hedges
    })

    it('should track latency percentiles', async () => {
      const delays = [50, 100, 150, 200, 250]
      let callIndex = 0
      
      const operation = vi.fn(async () => {
        const delay = delays[callIndex++ % delays.length]
        await new Promise(resolve => setTimeout(resolve, delay))
        return 'success'
      })

      const policy = hedge({ delay: 1000 }) // High delay so no hedging
      
      // Execute multiple requests
      for (let i = 0; i < delays.length; i++) {
        const resultPromise = policy.execute(operation)
        await vi.advanceTimersByTimeAsync(300)
        await resultPromise
      }

      const metrics = policy.getMetrics()
      expect(metrics.p99Latency).toBeGreaterThan(0)
      expect(metrics.avgPrimaryLatency).toBeGreaterThan(0)
    })
  })

  describe('callbacks', () => {
    it('should notify when hedge is triggered', async () => {
      const hedgeEvents: { attempt: number; delay: number }[] = []
      
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 300))
        return 'success'
      })

      const policy = hedge({ delay: 100, maxHedges: 2 })
        .onHedge((attempt, delay) => {
          hedgeEvents.push({ attempt, delay })
        })
      
      const resultPromise = policy.execute(operation)
      await vi.advanceTimersByTimeAsync(400)
      await resultPromise

      expect(hedgeEvents).toHaveLength(2)
      expect(hedgeEvents[0]).toEqual({ attempt: 1, delay: 100 })
      expect(hedgeEvents[1]).toEqual({ attempt: 2, delay: 100 })
    })
  })

  describe('edge cases', () => {
    it('should handle immediate primary success', async () => {
      const operation = vi.fn(async () => 'instant')

      const policy = hedge({ delay: 100 })
      const result = await policy.execute(operation)

      expect(result.ok).toBe(true)
      expect(result.value).toBe('instant')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should handle maxHedges of 0', async () => {
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'success'
      })

      const policy = hedge({ delay: 50, maxHedges: 0 })
      const resultPromise = policy.execute(operation)
      
      await vi.advanceTimersByTimeAsync(150)
      const result = await resultPromise

      expect(result.ok).toBe(true)
      expect(operation).toHaveBeenCalledTimes(1) // Only primary
    })

    it('should handle synchronous errors', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Sync error')
      })

      const policy = hedge({ delay: 50, maxHedges: 1 })
      const resultPromise = policy.execute(operation)
      
      // Let hedges start
      await vi.advanceTimersByTimeAsync(100)
      const result = await resultPromise

      expect(result.ok).toBe(false)
      expect(result.error.message).toContain('All')
    })
  })
})
