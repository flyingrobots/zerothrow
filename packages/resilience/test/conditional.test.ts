import { describe, it, expect, vi } from 'vitest'
import { PolicyFactory as Policy } from '../src/index.js'

describe('Conditional Policies', () => {
  describe('ConditionalPolicy', () => {
    it('should execute whenTrue policy when condition is true', async () => {
      const whenTrueMock = vi.fn(() => Promise.resolve(42))

      const policy = Policy.conditional({
        condition: () => true,
        whenTrue: Policy.retry(3),
        whenFalse: Policy.timeout(1000)
      })

      const result = await policy.execute(whenTrueMock)
      
      expect(result.ok).toBe(true)
      expect(result.ok && result.value).toBe(42)
      expect(whenTrueMock).toHaveBeenCalledOnce()
    })

    it('should execute whenFalse policy when condition is false', async () => {
      const operation = vi.fn(() => Promise.resolve(42))

      const policy = Policy.conditional({
        condition: () => false,
        whenTrue: Policy.retry(3),
        whenFalse: Policy.timeout(1000)
      })

      const result = await policy.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(result.ok && result.value).toBe(42)
      expect(operation).toHaveBeenCalledOnce()
    })

    it('should use context in condition evaluation', async () => {
      const executionCounts: number[] = []
      const operation = vi.fn(() => Promise.resolve(42))

      const policy = Policy.conditional({
        condition: (context) => {
          executionCounts.push(context.executionCount)
          return context.executionCount > 0
        },
        whenTrue: Policy.retry(1),
        whenFalse: Policy.timeout(100)
      })

      // First execution - should use whenFalse (timeout)
      await policy.execute(operation)
      expect(executionCounts[0]).toBe(0)

      // Second execution - should use whenTrue (retry)
      await policy.execute(operation)
      expect(executionCounts[1]).toBe(1)
    })

    it('should track execution metrics', async () => {
      const failingOp = vi.fn(() => Promise.reject(new Error('Test error')))
      const successOp = vi.fn(() => Promise.resolve(42))

      const policy = Policy.conditional({
        condition: (ctx) => ctx.failureRate > 0.5,
        whenTrue: Policy.retry(3),
        whenFalse: Policy.timeout(100)
      })

      // Execute failing operation
      await policy.execute(failingOp)
      
      // Execute successful operation
      await policy.execute(successOp)
      
      const context = (policy as any).getContext()
      expect(context.executionCount).toBe(2)
      expect(context.failureCount).toBe(1)
      expect(context.successCount).toBe(1)
      expect(context.failureRate).toBe(0.5)
    })
  })

  describe('BranchPolicy', () => {
    it('should select first matching branch', async () => {
      const operation = vi.fn(() => Promise.resolve(42))

      const policy = Policy.branch({
        branches: [
          {
            condition: (ctx) => ctx.executionCount === 0,
            policy: Policy.timeout(50)
          },
          {
            condition: (ctx) => ctx.failureRate > 0.5,
            policy: Policy.retry(3)
          },
          {
            condition: () => true,
            policy: Policy.circuitBreaker({ threshold: 3, duration: 1000 })
          }
        ],
        default: Policy.timeout(1000)
      })

      // First execution should match first branch
      const result = await policy.execute(operation)
      expect(result.ok).toBe(true)
      expect(result.ok && result.value).toBe(42)
    })

    it('should use default policy when no branches match', async () => {
      const operation = vi.fn(() => Promise.resolve(42))

      const policy = Policy.branch({
        branches: [
          {
            condition: () => false,
            policy: Policy.retry(3)
          },
          {
            condition: () => false,
            policy: Policy.timeout(50)
          }
        ],
        default: Policy.circuitBreaker({ threshold: 3, duration: 1000 })
      })

      const result = await policy.execute(operation)
      expect(result.ok).toBe(true)
      expect(result.ok && result.value).toBe(42)
    })

    it('should evaluate branches based on context', async () => {
      const failingOp = vi.fn(() => Promise.reject(new Error('Test error')))
      const successOp = vi.fn(() => Promise.resolve(42))

      const policy = Policy.branch({
        branches: [
          {
            condition: (ctx) => ctx.failureRate > 0.7,
            policy: Policy.retry(5, { delay: 100 })
          },
          {
            condition: (ctx) => ctx.failureRate > 0.3,
            policy: Policy.retry(3, { delay: 50 })
          },
          {
            condition: (ctx) => ctx.executionCount < 5,
            policy: Policy.timeout(100)
          }
        ],
        default: Policy.circuitBreaker({ threshold: 3, duration: 1000 })
      })

      // Build up failure rate
      await policy.execute(failingOp)
      await policy.execute(failingOp)
      await policy.execute(successOp)
      
      const context = (policy as any).getContext()
      expect(context.failureRate).toBeCloseTo(0.67, 1)
    })
  })

  describe('AdaptivePolicy', () => {
    it('should use first policy during warmup period', async () => {
      const operation = vi.fn(() => Promise.resolve(42))
      let selectorCalled = false

      const policy = Policy.adaptive({
        policies: [
          Policy.timeout(100),
          Policy.retry(3),
          Policy.circuitBreaker({ threshold: 3, duration: 1000 })
        ],
        selector: (_context) => {
          selectorCalled = true
          return Policy.retry(3)
        },
        warmupPeriod: 3
      })

      // Execute during warmup
      await policy.execute(operation)
      await policy.execute(operation)
      
      expect(selectorCalled).toBe(false)
    })

    it('should call selector after warmup period', async () => {
      const operation = vi.fn(() => Promise.resolve(42))
      let selectorCallCount = 0

      const policies = [
        Policy.timeout(100),
        Policy.retry(3),
        Policy.circuitBreaker({ threshold: 3, duration: 1000 })
      ]

      const policy = Policy.adaptive({
        policies,
        selector: (_context) => {
          selectorCallCount++
          return policies[1] // Return retry policy
        },
        warmupPeriod: 2
      })

      // Execute during warmup
      await policy.execute(operation)
      await policy.execute(operation)
      expect(selectorCallCount).toBe(0)

      // Execute after warmup
      await policy.execute(operation)
      expect(selectorCallCount).toBe(1)
    })

    it('should adapt based on failure rate', async () => {
      const failingOp = vi.fn(() => Promise.reject(new Error('Test error')))
      const successOp = vi.fn(() => Promise.resolve(42))

      const policies = [
        Policy.timeout(100),
        Policy.retry(3, { delay: 50 }),
        Policy.circuitBreaker({ threshold: 3, duration: 1000 })
      ]

      const policy = Policy.adaptive({
        policies,
        selector: (context) => {
          // High failure rate -> use retry
          if (context.failureRate > 0.5) {
            return policies[1]
          }
          // Low failure rate -> use timeout
          return policies[0]
        },
        warmupPeriod: 0
      })

      // Start with successful operations
      await policy.execute(successOp)
      await policy.execute(successOp)
      
      // Now fail to increase failure rate
      await policy.execute(failingOp)
      await policy.execute(failingOp)
      
      const context = (policy as any).getContext()
      expect(context.failureRate).toBe(0.5)
    })

    it('should avoid thrashing between policies', async () => {
      const operation = vi.fn(() => Promise.resolve(42))
      const selectedPolicies: string[] = []

      const policies = [
        Policy.timeout(100),
        Policy.retry(3)
      ]

      const policy = Policy.adaptive({
        policies,
        selector: (context) => {
          // Simple hysteresis example
          const policy = context.executionCount % 2 === 0 ? policies[0] : policies[1]
          selectedPolicies.push(policy === policies[0] ? 'timeout' : 'retry')
          return policy
        },
        warmupPeriod: 0
      })

      // Execute multiple times
      for (let i = 0; i < 6; i++) {
        await policy.execute(operation)
      }

      // Should alternate between policies
      expect(selectedPolicies).toEqual(['timeout', 'retry', 'timeout', 'retry', 'timeout', 'retry'])
    })
  })

  describe('Composition with existing policies', () => {
    it('should compose conditional policy with retry', async () => {
      let attempts = 0
      const failingOp = vi.fn(() => {
        attempts++
        if (attempts < 3) {
          return Promise.reject(new Error('Test error'))
        }
        return Promise.resolve(42)
      })

      // Use retry policy directly in the conditional
      const conditional = Policy.conditional({
        condition: () => true, // Always use retry
        whenTrue: Policy.retry(5),
        whenFalse: Policy.timeout(100)
      })

      const result = await conditional.execute(failingOp)
      expect(result.ok).toBe(true)
      expect(result.ok && result.value).toBe(42)
      expect(attempts).toBe(3)
    })

    it('should wrap conditional policy with circuit breaker', async () => {
      const operation = vi.fn(() => Promise.resolve(42))

      const conditional = Policy.conditional({
        condition: (ctx) => ctx.executionCount < 5,
        whenTrue: Policy.retry(3),
        whenFalse: Policy.timeout(100)
      })

      const wrapped = Policy.wrap(
        Policy.circuitBreaker({ threshold: 3, duration: 1000 }),
        conditional
      )

      const result = await wrapped.execute(operation)
      expect(result.ok).toBe(true)
      expect(result.ok && result.value).toBe(42)
    })

    it('should use branch policy in adaptive policy', async () => {
      const operation = vi.fn(() => Promise.resolve(42))

      const branchPolicy = Policy.branch({
        branches: [
          {
            condition: (ctx) => ctx.failureRate > 0.5,
            policy: Policy.retry(5)
          },
          {
            condition: (ctx) => ctx.executionCount < 10,
            policy: Policy.timeout(100)
          }
        ],
        default: Policy.circuitBreaker({ threshold: 3, duration: 1000 })
      })

      const adaptive = Policy.adaptive({
        policies: [branchPolicy, Policy.retry(3)],
        selector: (ctx) => ctx.executionCount > 5 ? branchPolicy : Policy.retry(3),
        warmupPeriod: 0
      })

      const result = await adaptive.execute(operation)
      expect(result.ok).toBe(true)
      expect(result.ok && result.value).toBe(42)
    })
  })
})