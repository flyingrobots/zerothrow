import { ZT, ZeroThrow, ZeroError } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import type { BulkheadOptions, BulkheadPolicy, BulkheadMetrics } from '../types.js'
import { BulkheadRejectedError, BulkheadQueueTimeoutError } from '../types.js'
import type { Clock } from '../clock.js'
import { SystemClock } from '../clock.js'

interface QueuedOperation<T, E extends ZeroError = ZeroError> {
  operation: () => ZeroThrow.Async<T, E>
  resolve: (result: ZeroThrow.Result<T, E>) => void
  enqueuedAt: number
  timeoutId?: NodeJS.Timeout
}

export class Bulkhead extends BasePolicy implements BulkheadPolicy {
  private maxConcurrent: number
  private maxQueue: number
  private queueTimeout: number
  
  // Semaphore state
  private activeConcurrent = 0
  private readonly queue: Array<QueuedOperation<unknown, ZeroError>> = []
  
  // Metrics
  private totalExecuted = 0
  private totalRejected = 0
  private totalQueued = 0
  private totalQueueTimeout = 0
  
  constructor(
    name: string,
    options: BulkheadOptions,
    clock: Clock = new SystemClock()
  ) {
    super(name, clock)
    this.maxConcurrent = options.maxConcurrent
    this.maxQueue = options.maxQueue ?? 0
    this.queueTimeout = options.queueTimeout ?? 60000 // Default 60s
    
    if (this.maxConcurrent < 1) {
      throw new Error('maxConcurrent must be at least 1')
    }
    
    if (this.maxQueue < 0) {
      throw new Error('maxQueue must be non-negative')
    }
  }
  
  override execute<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, E> {
    // Fast path: if we have capacity, execute immediately
    if (this.activeConcurrent < this.maxConcurrent) {
      return this.executeOperation(operation)
    }
    
    // Check if we can queue
    if (this.queue.length >= this.maxQueue) {
      this.totalRejected++
      // SAFE_CAST: BulkheadRejectedError extends Error
      const error = new BulkheadRejectedError(
        this.name,
        this.maxConcurrent,
        this.maxQueue,
        this.activeConcurrent,
        this.queue.length
      )
      return ZeroThrow.enhance(Promise.resolve(ZT.err(error as unknown as E) as unknown as ZeroThrow.Result<T, E>))
    }
    
    // Queue the operation
    return this.enqueueOperation(operation)
  }
  
  private executeOperation<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, E> {
    this.activeConcurrent++
    this.totalExecuted++
    
    return ZeroThrow.enhance(
      operation().then((result) => {
        this.activeConcurrent--
        // Don't await here to avoid blocking the return
        setImmediate(() => this.processQueue())
        return result
      })
    )
  }
  
  private enqueueOperation<T, E extends ZeroError = ZeroError>(
    operation: () => ZeroThrow.Async<T, E>
  ): ZeroThrow.Async<T, E> {
    return ZeroThrow.enhance(
      new Promise<ZeroThrow.Result<T, E>>((resolve) => {
        const enqueuedAt = this.clock.now().getTime()
        const queueItem: QueuedOperation<T, E> = {
          operation,
          resolve,
          enqueuedAt
        }
        
        // SAFE_CAST: Converting generic E to ZeroError for queue storage
        this.queue.push(queueItem as unknown as QueuedOperation<unknown, ZeroError>)
        this.totalQueued++
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
          // SAFE_CAST: Converting generic E to ZeroError for queue lookup
          const index = this.queue.indexOf(queueItem as unknown as QueuedOperation<unknown, ZeroError>)
          if (index !== -1) {
            this.queue.splice(index, 1)
            this.totalQueueTimeout++
            const waitTime = this.clock.now().getTime() - enqueuedAt
            // SAFE_CAST: BulkheadQueueTimeoutError extends Error
            const error = new BulkheadQueueTimeoutError(
              this.name,
              this.queueTimeout,
              waitTime
            )
            // SAFE_CAST: Converting Error to generic E
            resolve(ZT.err(error as unknown as E) as unknown as ZeroThrow.Result<T, E>)
          }
        }, this.queueTimeout)
        
        // Store timeout ID for cleanup
        queueItem.timeoutId = timeoutId
      })
    )
  }
  
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0 || this.activeConcurrent >= this.maxConcurrent) {
      return
    }
    
    const queueItem = this.queue.shift()
    if (!queueItem) return
    
    // Clear timeout
    if (queueItem.timeoutId) {
      clearTimeout(queueItem.timeoutId)
    }
    
    const typedItem = queueItem as QueuedOperation<unknown, ZeroError>
    const result = await this.executeOperation(typedItem.operation)
    // SAFE_CAST: Resolve expects Result<unknown, ZeroError>
    typedItem.resolve(result as ZeroThrow.Result<unknown, ZeroError>)
  }
  
  getMetrics(): BulkheadMetrics {
    return {
      activeConcurrent: this.activeConcurrent,
      queuedCount: this.queue.length,
      totalExecuted: this.totalExecuted,
      totalRejected: this.totalRejected,
      totalQueued: this.totalQueued,
      totalQueueTimeout: this.totalQueueTimeout
    }
  }
  
  updateCapacity(maxConcurrent: number): void {
    if (maxConcurrent < 1) {
      throw new Error('maxConcurrent must be at least 1')
    }
    
    this.maxConcurrent = maxConcurrent
    
    // If we increased capacity, process more from queue
    while (this.activeConcurrent < this.maxConcurrent && this.queue.length > 0) {
      this.processQueue()
    }
  }
  
  updateQueueSize(maxQueue: number): void {
    if (maxQueue < 0) {
      throw new Error('maxQueue must be non-negative')
    }
    
    this.maxQueue = maxQueue
    
    // If we reduced queue size, reject excess items
    while (this.queue.length > this.maxQueue) {
      const queueItem = this.queue.pop()
      if (queueItem) {
        if (queueItem.timeoutId) {
          clearTimeout(queueItem.timeoutId)
        }
        
        this.totalRejected++
        // SAFE_CAST: BulkheadRejectedError extends Error
        const error = new BulkheadRejectedError(
          this.name,
          this.maxConcurrent,
          this.maxQueue,
          this.activeConcurrent,
          this.queue.length + 1
        )
        queueItem.resolve(ZT.err(error) as unknown as ZeroThrow.Result<unknown, ZeroError>)
      }
    }
  }
}