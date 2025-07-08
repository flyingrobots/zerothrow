import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PolicyFactory, BulkheadRejectedError, BulkheadQueueTimeoutError, TestClock } from '../src/index.js'
import { ZT } from '@zerothrow/core'

describe('Bulkhead Policy', () => {
  let clock: TestClock
  
  beforeEach(() => {
    clock = new TestClock()
  })
  
  describe('Basic Functionality', () => {
    it('should execute operations when under capacity', async () => {
      const bulkhead = PolicyFactory.bulkhead({ maxConcurrent: 3 }, clock)
      const operation = vi.fn().mockResolvedValue(ZT.ok('success'))
      
      const result = await bulkhead.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(result.unwrapOrThrow()).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })
    
    it('should limit concurrent executions', async () => {
      const bulkhead = PolicyFactory.bulkhead({ maxConcurrent: 2 }, clock)
      
      let resolve1: (value: string) => void
      let resolve2: (value: string) => void
      
      const operation1 = () => new Promise<ZT.Result<string, Error>>((res) => { resolve1 = (value: string) => res(ZT.ok(value)) })
      const operation2 = () => new Promise<ZT.Result<string, Error>>((res) => { resolve2 = (value: string) => res(ZT.ok(value)) })
      const operation3 = vi.fn().mockResolvedValue(ZT.ok('op3'))
      
      // Start two operations to fill capacity
      const promise1 = bulkhead.execute(operation1)
      const promise2 = bulkhead.execute(operation2)
      
      // Third should be rejected (no queue)
      const result3 = await bulkhead.execute(operation3)
      
      expect(result3.ok).toBe(false)
      expect(result3.error).toBeInstanceOf(BulkheadRejectedError)
      expect(operation3).not.toHaveBeenCalled()
      
      // Complete first operation
      resolve1!('op1')
      const result1 = await promise1
      expect(result1.unwrapOrThrow()).toBe('op1')
      
      // Now we can execute another
      const result4 = await bulkhead.execute(operation3)
      expect(result4.ok).toBe(true)
      expect(operation3).toHaveBeenCalledTimes(1)
      
      // Complete second operation
      resolve2!('op2')
      const result2 = await promise2
      expect(result2.unwrapOrThrow()).toBe('op2')
    })
    
    it('should accept number as shorthand for maxConcurrent', async () => {
      const bulkhead = PolicyFactory.bulkhead(5, clock)
      const operation = vi.fn().mockResolvedValue(ZT.ok('success'))
      
      const result = await bulkhead.execute(operation)
      
      expect(result.ok).toBe(true)
      expect(result.unwrapOrThrow()).toBe('success')
    })
  })
  
  describe('Queue Management', () => {
    it('should queue operations when at capacity', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 2,
        maxQueue: 2
      }, clock)
      
      const resolves: Array<(value: string) => void> = []
      const createOperation = (_id: string) => () => 
        new Promise<ZT.Result<string, Error>>((res) => { resolves.push((value: string) => res(ZT.ok(value))) })
      
      // Fill capacity
      const promise1 = bulkhead.execute(createOperation('op1'))
      const promise2 = bulkhead.execute(createOperation('op2'))
      
      // Queue operations
      const promise3 = bulkhead.execute(createOperation('op3'))
      const promise4 = bulkhead.execute(createOperation('op4'))
      
      // Fifth should be rejected (queue full)
      const operation5 = vi.fn().mockResolvedValue(ZT.ok('op5'))
      const promise5 = bulkhead.execute(operation5)
      const result5 = await promise5
      
      expect(result5.ok).toBe(false)
      expect(result5.error).toBeInstanceOf(BulkheadRejectedError)
      const error = result5.error as BulkheadRejectedError
      expect(error.activeConcurrent).toBe(2)
      expect(error.queuedCount).toBe(2)
      
      // Complete first operation - should trigger queued op3
      resolves[0]('op1')
      await promise1
      
      // Wait for queue processing
      await new Promise(resolve => setImmediate(resolve))
      
      // op3 should now be executing
      expect(resolves.length).toBe(3) // op3's resolver was added
      
      // Complete remaining operations
      resolves[1]('op2')
      await promise2
      
      // Wait for queue processing of op4
      await new Promise(resolve => setImmediate(resolve))
      
      // Now op4 should be executing
      expect(resolves.length).toBe(4)
      resolves[2]('op3')
      resolves[3]('op4')
      
      await Promise.all([promise3, promise4])
    })
    
    it('should timeout queued operations', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 1,
        maxQueue: 1,
        queueTimeout: 100
      }, clock)
      
      let resolve1: (value: string) => void
      const operation1 = () => new Promise<ZT.Result<string, Error>>((res) => { resolve1 = (value: string) => res(ZT.ok(value)) })
      const operation2 = vi.fn().mockResolvedValue(ZT.ok('op2'))
      
      // Fill capacity
      const promise1 = bulkhead.execute(operation1)
      
      // Queue an operation
      const promise2 = bulkhead.execute(operation2)
      
      // Advance time to trigger timeout
      clock.advance(150)
      
      const result2 = await promise2
      expect(result2.ok).toBe(false)
      expect(result2.error).toBeInstanceOf(BulkheadQueueTimeoutError)
      const error = result2.error as BulkheadQueueTimeoutError
      expect(error.queueTimeout).toBe(100)
      expect(error.waitTime).toBeGreaterThanOrEqual(100)
      
      // Operation should not have been called
      expect(operation2).not.toHaveBeenCalled()
      
      // Complete first operation
      resolve1!('op1')
      await promise1
    })
    
    it('should process queue in FIFO order', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 1,
        maxQueue: 3
      }, clock)
      
      const executionOrder: string[] = []
      let resolve: (value: string) => void
      
      const blockingOp = () => new Promise<ZT.Result<string, Error>>((res) => { resolve = (value: string) => res(ZT.ok(value)) })
      const createOp = (id: string) => vi.fn().mockImplementation(() => {
        executionOrder.push(id)
        return Promise.resolve(ZT.ok(id))
      })
      
      // Block the bulkhead
      const promise1 = bulkhead.execute(blockingOp)
      
      // Queue operations
      const op2 = createOp('op2')
      const op3 = createOp('op3')
      const op4 = createOp('op4')
      
      const promise2 = bulkhead.execute(op2)
      const promise3 = bulkhead.execute(op3)
      const promise4 = bulkhead.execute(op4)
      
      // Unblock
      resolve!('op1')
      await Promise.all([promise1, promise2, promise3, promise4])
      
      expect(executionOrder).toEqual(['op2', 'op3', 'op4'])
    })
  })
  
  describe('Metrics', () => {
    it('should track execution metrics', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 2,
        maxQueue: 1
      }, clock)
      
      // Check initial metrics
      let metrics = bulkhead.getMetrics()
      expect(metrics).toEqual({
        activeConcurrent: 0,
        queuedCount: 0,
        totalExecuted: 0,
        totalRejected: 0,
        totalQueued: 0,
        totalQueueTimeout: 0
      })
      
      // Simple operations that complete immediately
      const op1 = () => Promise.resolve(ZT.ok('op1'))
      const op2 = () => Promise.resolve(ZT.ok('op2'))
      const op3 = () => Promise.resolve(ZT.ok('op3'))
      const op4 = () => Promise.resolve(ZT.ok('op4'))
      
      // Execute operations
      const results = await Promise.all([
        bulkhead.execute(op1),
        bulkhead.execute(op2),
        bulkhead.execute(op3), // Should queue then execute
        bulkhead.execute(op4)  // Should be rejected
      ])
      
      // Check results
      expect(results[0].ok).toBe(true)
      expect(results[1].ok).toBe(true)
      expect(results[2].ok).toBe(true)
      expect(results[3].ok).toBe(false)
      
      // Final metrics
      metrics = bulkhead.getMetrics()
      expect(metrics.activeConcurrent).toBe(0)
      expect(metrics.queuedCount).toBe(0)
      expect(metrics.totalExecuted).toBe(3)
      expect(metrics.totalQueued).toBe(1)
      expect(metrics.totalRejected).toBe(1)
    })
    
    it('should track queue timeout metrics', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 1,
        maxQueue: 1,
        queueTimeout: 50
      }, clock)
      
      let resolve: (value: string) => void
      const blockingOp = () => new Promise<ZT.Result<string, Error>>((res) => { resolve = (value: string) => res(ZT.ok(value)) })
      
      const promise1 = bulkhead.execute(blockingOp)
      const promise2 = bulkhead.execute(() => Promise.resolve(ZT.ok('queued')))
      
      // Trigger timeout
      clock.advance(100)
      await promise2
      
      const metrics = bulkhead.getMetrics()
      expect(metrics.totalQueueTimeout).toBe(1)
      
      // Cleanup
      resolve!('done')
      await promise1
    })
  })
  
  describe('Dynamic Capacity Adjustment', () => {
    it('should update max concurrent capacity', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 2,
        maxQueue: 2
      }, clock)
      
      const resolves: Array<(value: string) => void> = []
      const createOperation = () => () => 
        new Promise<ZT.Result<string, Error>>((res) => { resolves.push((value: string) => res(ZT.ok(value))) })
      
      // Fill capacity and queue
      const promises = [
        bulkhead.execute(createOperation()),
        bulkhead.execute(createOperation()),
        bulkhead.execute(createOperation()),
        bulkhead.execute(createOperation())
      ]
      
      let metrics = bulkhead.getMetrics()
      expect(metrics.activeConcurrent).toBe(2)
      expect(metrics.queuedCount).toBe(2)
      
      // Increase capacity
      bulkhead.updateCapacity(4)
      
      // Queue should be processed
      await new Promise(resolve => setTimeout(resolve, 0))
      
      metrics = bulkhead.getMetrics()
      expect(metrics.activeConcurrent).toBe(4)
      expect(metrics.queuedCount).toBe(0)
      
      // Complete all
      resolves.forEach(res => res('done'))
      await Promise.all(promises)
    })
    
    it('should update max queue size', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 1,
        maxQueue: 3
      }, clock)
      
      let resolve: (value: string) => void
      const blockingOp = () => new Promise<ZT.Result<string, Error>>((res) => { resolve = (value: string) => res(ZT.ok(value)) })
      
      // Block bulkhead and fill queue
      const promise1 = bulkhead.execute(blockingOp)
      const promise2 = bulkhead.execute(() => Promise.resolve(ZT.ok('q1')))
      const promise3 = bulkhead.execute(() => Promise.resolve(ZT.ok('q2')))
      const promise4 = bulkhead.execute(() => Promise.resolve(ZT.ok('q3')))
      
      let metrics = bulkhead.getMetrics()
      expect(metrics.queuedCount).toBe(3)
      
      // Reduce queue size - should reject excess
      bulkhead.updateQueueSize(1)
      
      metrics = bulkhead.getMetrics()
      expect(metrics.queuedCount).toBe(1)
      expect(metrics.totalRejected).toBe(2)
      
      // Check rejected promises
      const results = await Promise.all([promise3, promise4])
      results.forEach(result => {
        expect(result.ok).toBe(false)
        expect(result.error).toBeInstanceOf(BulkheadRejectedError)
      })
      
      // Cleanup
      resolve!('done')
      await Promise.all([promise1, promise2])
    })
    
    it('should reject invalid capacity updates', () => {
      const bulkhead = PolicyFactory.bulkhead({ maxConcurrent: 2 }, clock)
      
      expect(() => bulkhead.updateCapacity(0)).toThrow('maxConcurrent must be at least 1')
      expect(() => bulkhead.updateCapacity(-1)).toThrow('maxConcurrent must be at least 1')
      
      expect(() => bulkhead.updateQueueSize(-1)).toThrow('maxQueue must be non-negative')
    })
  })
  
  describe('Error Handling', () => {
    it('should handle operation failures', async () => {
      const bulkhead = PolicyFactory.bulkhead({ maxConcurrent: 2 }, clock)
      const error = new Error('Operation failed')
      const operation = vi.fn().mockResolvedValue(ZT.err(error))
      
      const result = await bulkhead.execute(operation)
      
      expect(result.ok).toBe(false)
      expect(result.error?.message).toBe(error.message)
      expect(operation).toHaveBeenCalledTimes(1)
      
      // Should still free up capacity
      const metrics = bulkhead.getMetrics()
      expect(metrics.activeConcurrent).toBe(0)
    })
    
    it('should handle queued operation failures', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 1,
        maxQueue: 1
      }, clock)
      
      let resolve: (value: string) => void
      const blockingOp = () => new Promise<ZT.Result<string, Error>>((res) => { resolve = (value: string) => res(ZT.ok(value)) })
      const failingOp = vi.fn().mockResolvedValue(ZT.err(new Error('Queued op failed')))
      
      const promise1 = bulkhead.execute(blockingOp)
      const promise2 = bulkhead.execute(failingOp)
      
      // Unblock to process queue
      resolve!('done')
      
      const [result1, result2] = await Promise.all([promise1, promise2])
      
      expect(result1.ok).toBe(true)
      expect(result2.ok).toBe(false)
      expect(result2.error?.message).toBe('Queued op failed')
    })
    
    it('should validate constructor options', () => {
      expect(() => PolicyFactory.bulkhead({ maxConcurrent: 0 }, clock))
        .toThrow('maxConcurrent must be at least 1')
      
      expect(() => PolicyFactory.bulkhead({ maxConcurrent: -1 }, clock))
        .toThrow('maxConcurrent must be at least 1')
      
      expect(() => PolicyFactory.bulkhead({ maxConcurrent: 1, maxQueue: -1 }, clock))
        .toThrow('maxQueue must be non-negative')
    })
  })
  
  describe('Integration with Result', () => {
    it('should work with Result-returning operations', async () => {
      const bulkhead = PolicyFactory.bulkhead({ maxConcurrent: 2 }, clock)
      
      const successOp = () => Promise.resolve(ZT.ok('success'))
      const failOp = () => Promise.resolve(ZT.err(new Error('failure')))
      
      const result1 = await bulkhead.execute(successOp)
      const result2 = await bulkhead.execute(failOp)
      
      expect(result1.ok).toBe(true)
      expect(result1.unwrapOrThrow()).toBe('success')
      
      expect(result2.ok).toBe(false)
      expect(result2.error?.message).toBe('failure')
    })
  })
  
  describe('Concurrency Edge Cases', () => {
    it('should handle rapid concurrent requests', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 3,
        maxQueue: 5
      }, clock)
      
      const operations = Array.from({ length: 10 }, (_, i) =>
        vi.fn().mockResolvedValue(ZT.ok(`result-${i}`))
      )
      
      const promises = operations.map(op => bulkhead.execute(op))
      const results = await Promise.all(promises)
      
      // First 3 + 5 queued should succeed
      const successCount = results.filter(r => r.ok).length
      const rejectCount = results.filter(r => !r.ok && r.error instanceof BulkheadRejectedError).length
      
      expect(successCount).toBe(8)
      expect(rejectCount).toBe(2)
    })
    
    it('should maintain consistency under stress', async () => {
      const bulkhead = PolicyFactory.bulkhead({
        maxConcurrent: 5,
        maxQueue: 10
      }, clock)
      
      const delays = [10, 20, 5, 15, 25, 30, 8, 12, 18, 22]
      let activeCount = 0
      let maxActive = 0
      
      const operations = delays.map(delay => async () => {
        activeCount++
        maxActive = Math.max(maxActive, activeCount)
        await new Promise(resolve => setTimeout(resolve, delay))
        activeCount--
        return ZT.ok(delay)
      })
      
      const promises = operations.map(op => bulkhead.execute(op))
      await Promise.all(promises)
      
      expect(maxActive).toBeLessThanOrEqual(5)
      expect(activeCount).toBe(0)
    })
  })
})