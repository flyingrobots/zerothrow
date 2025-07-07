import type { Result } from '@zerothrow/core'
import { ZT } from '@zerothrow/core'
import { BasePolicy } from '../policy.js'
import type { BulkheadOptions, BulkheadPolicy, BulkheadMetrics } from '../types.js'
import { BulkheadRejectedError, BulkheadQueueTimeoutError } from '../types.js'
import type { Clock } from '../clock.js'
import { SystemClock } from '../clock.js'

interface QueuedOperation<T> {
  operation: () => Promise<T>
  resolve: (result: Result<T, Error>) => void
  reject: (error: Error) => void
  enqueuedAt: number
}

export class Bulkhead extends BasePolicy implements BulkheadPolicy {
  private maxConcurrent: number
  private maxQueue: number
  private queueTimeout: number
  
  // Semaphore state
  private activeConcurrent = 0
  private readonly queue: Array<QueuedOperation<unknown>> = []
  
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
  
  override async execute<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    // Fast path: if we have capacity, execute immediately
    if (this.activeConcurrent < this.maxConcurrent) {
      return this.executeOperation(operation)
    }
    
    // Check if we can queue
    if (this.queue.length >= this.maxQueue) {
      this.totalRejected++
      return ZT.err(new BulkheadRejectedError(
        this.name,
        this.maxConcurrent,
        this.maxQueue,
        this.activeConcurrent,
        this.queue.length
      ))
    }
    
    // Queue the operation
    return this.enqueueOperation(operation)
  }
  
  private async executeOperation<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    this.activeConcurrent++
    this.totalExecuted++
    
    try {
      const result = await this.runOperation(operation)
      return result
    } finally {
      this.activeConcurrent--
      // Don't await here to avoid blocking the return
      setImmediate(() => this.processQueue())
    }
  }
  
  private async enqueueOperation<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    return new Promise<Result<T, Error>>((resolve, reject) => {
      const enqueuedAt = this.clock.now().getTime()
      const queueItem: QueuedOperation<T> = {
        operation,
        resolve: resolve as (result: Result<unknown, Error>) => void,
        reject,
        enqueuedAt
      }
      
      this.queue.push(queueItem)
      this.totalQueued++
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        const index = this.queue.indexOf(queueItem)
        if (index !== -1) {
          this.queue.splice(index, 1)
          this.totalQueueTimeout++
          const waitTime = this.clock.now().getTime() - enqueuedAt
          resolve(ZT.err(new BulkheadQueueTimeoutError(
            this.name,
            this.queueTimeout,
            waitTime
          )))
        }
      }, this.queueTimeout)
      
      // Store timeout ID for cleanup
      ;(queueItem as Record<string, unknown>).timeoutId = timeoutId
    })
  }
  
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0 || this.activeConcurrent >= this.maxConcurrent) {
      return
    }
    
    const queueItem = this.queue.shift()
    if (!queueItem) return
    
    // Clear timeout
    const timeoutId = (queueItem as Record<string, unknown>).timeoutId
    if (timeoutId) {
      clearTimeout(timeoutId as NodeJS.Timeout)
    }
    
    try {
      const result = await this.executeOperation(queueItem.operation)
      queueItem.resolve(result)
    } catch (error) {
      queueItem.reject(error as Error)
    }
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
        const timeoutId = (queueItem as Record<string, unknown>).timeoutId
        if (timeoutId) {
          clearTimeout(timeoutId as NodeJS.Timeout)
        }
        
        this.totalRejected++
        queueItem.resolve(ZT.err(new BulkheadRejectedError(
          this.name,
          this.maxConcurrent,
          this.maxQueue,
          this.activeConcurrent,
          this.queue.length + 1
        )))
      }
    }
  }
}