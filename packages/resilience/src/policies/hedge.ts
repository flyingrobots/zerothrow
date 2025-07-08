import type { Result } from '@zerothrow/core'
import { ZT } from '@zerothrow/core'
import type { HedgePolicy, HedgeOptions, HedgeMetrics, DelayStrategy } from '../types.js'
import { HedgeFailedError as HedgeErrorImpl } from '../types.js'

interface CancellableOperation<T> {
  promise: Promise<T>
  cancel?: () => void
}

export class Hedge implements HedgePolicy {
  private readonly options: HedgeOptions & {
    maxHedges: number
    shouldHedge: (attempt: number) => boolean
  }
  private hedgeCallback?: (attempt: number, delay: number) => void
  
  // Metrics tracking
  private metrics: HedgeMetrics = {
    totalRequests: 0,
    hedgeRequests: 0,
    primaryWins: 0,
    hedgeWins: 0,
    resourceWaste: 0,
    avgPrimaryLatency: 0,
    avgHedgeLatency: 0,
    p99Latency: 0
  }
  
  private latencies: number[] = []
  private primaryLatencies: number[] = []
  private hedgeLatencies: number[] = []

  constructor(options: HedgeOptions) {
    this.options = {
      ...options,
      maxHedges: options.maxHedges ?? 1,
      shouldHedge: options.shouldHedge ?? (() => true)
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    const startTime = Date.now()
    this.metrics.totalRequests++
    
    // Create individual cancellation tokens for each request
    const cancellationTokens: AbortController[] = []
    const operations: CancellableOperation<{ result: Result<T, Error>; type: 'primary' | 'hedge'; hedgeIndex: number }>[] = []
    
    try {
      // Create primary request with its own cancellation token
      const primaryController = new AbortController()
      cancellationTokens.push(primaryController)
      
      const primaryOperation = this.createCancellableOperation(
        operation, 
        'primary', 
        primaryController.signal,
        0
      )
      operations.push(primaryOperation)
      
      // If no hedging needed, just return primary result
      const delay = this.calculateDelay(0)
      if (delay === Infinity || !this.options.shouldHedge(0)) {
        const result = await primaryOperation.promise
        this.updateLatencyMetrics(Date.now() - startTime)
        return result.result
      }
      
      // Create hedge requests with delays
      for (let i = 0; i < this.options.maxHedges; i++) {
        if (this.options.shouldHedge(i + 1)) {
          const hedgeDelay = this.calculateDelay(i)
          const hedgeController = new AbortController()
          cancellationTokens.push(hedgeController)
          
          const hedgeOperation = this.createHedgeOperation(
            operation,
            i,
            hedgeDelay,
            hedgeController.signal
          )
          operations.push(hedgeOperation)
        }
      }
      
      // Use a custom race that continues on errors
      const raceForSuccess = async () => {
        return new Promise<{ result: Result<T, Error>; type: 'primary' | 'hedge'; hedgeIndex: number }>((resolve, reject) => {
          let completed = 0
          const errors: Error[] = []
          
          operations.forEach((op, index) => {
            op.promise.then(result => {
              if (result.result.ok) {
                // First success wins
                resolve(result)
                // Cancel other operations
                cancellationTokens.forEach((controller, idx) => {
                  if (idx !== index) controller.abort()
                })
              } else {
                // Track error and continue
                errors[index] = result.result.error
                completed++
                if (completed === operations.length) {
                  // All failed
                  reject(errors)
                }
              }
            }).catch(err => {
              errors[index] = err
              completed++
              if (completed === operations.length) {
                reject(errors)
              }
            })
          })
        })
      }
      
      try {
        const winner = await raceForSuccess()
        
        // Update metrics based on winner
        const latency = Date.now() - startTime
        this.updateLatencyMetrics(latency)
        
        if (winner.type === 'primary') {
          this.metrics.primaryWins++
          this.primaryLatencies.push(latency)
        } else {
          this.metrics.hedgeWins++
          this.hedgeLatencies.push(latency)
        }
        
        this.updateResourceWaste()
        return winner.result
      } catch (errors) {
        // All operations failed
        const err = new HedgeErrorImpl(
          'hedge',
          operations.length,
          errors as Error[],
          { options: this.options }
        )
        return ZT.err(err)
      }
      
    } catch (error) {
      // Cancel all pending operations
      cancellationTokens.forEach(controller => controller.abort())
      
      // If all requests fail, return error
      const err = new HedgeErrorImpl(
        'hedge',
        this.options.maxHedges + 1,
        [error as Error],
        { options: this.options }
      )
      return ZT.err(err)
    }
  }

  private createCancellableOperation<T>(
    operation: () => Promise<T>,
    type: 'primary' | 'hedge',
    signal: AbortSignal,
    hedgeIndex: number = 0
  ): CancellableOperation<{ result: Result<T, Error>; type: 'primary' | 'hedge'; hedgeIndex: number }> {
    const promise = this.executeWithCancellation(operation, signal)
      .then(value => ({ result: ZT.ok(value), type, hedgeIndex }))
      .catch(error => ({ result: ZT.err(error as Error), type, hedgeIndex }))
    
    return { promise }
  }

  private createHedgeOperation<T>(
    operation: () => Promise<T>,
    hedgeIndex: number,
    delay: number,
    signal: AbortSignal
  ): CancellableOperation<{ result: Result<T, Error>; type: 'primary' | 'hedge'; hedgeIndex: number }> {
    const promise = (async () => {
      // Wait for the hedge delay
      await this.delay(delay, signal)
      
      // Check if cancelled during delay
      if (signal.aborted) {
        throw new Error('Hedge request cancelled during delay')
      }
      
      // Notify callback if set
      if (this.hedgeCallback) {
        this.hedgeCallback(hedgeIndex + 1, delay)
      }
      
      this.metrics.hedgeRequests++
      
      // Execute hedge request
      const value = await this.executeWithCancellation(operation, signal)
      return { result: ZT.ok(value), type: 'hedge' as const, hedgeIndex: hedgeIndex + 1 }
    })().catch(error => ({ result: ZT.err(error as Error), type: 'hedge' as const, hedgeIndex: hedgeIndex + 1 }))
    
    return { promise }
  }

  private async executeWithCancellation<T>(
    operation: () => Promise<T>,
    signal: AbortSignal
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // If already aborted, reject immediately
      if (signal.aborted) {
        reject(new Error('Operation cancelled'))
        return
      }
      
      // Set up abort handler
      const abortHandler = () => {
        reject(new Error('Operation cancelled'))
      }
      signal.addEventListener('abort', abortHandler)
      
      // Execute the operation
      try {
        const result = operation()
        
        // Handle both sync and async operations
        Promise.resolve(result)
          .then(value => {
            signal.removeEventListener('abort', abortHandler)
            resolve(value)
          })
          .catch(error => {
            signal.removeEventListener('abort', abortHandler)
            reject(error)
          })
      } catch (error) {
        // Handle synchronous errors
        signal.removeEventListener('abort', abortHandler)
        reject(error)
      }
    })
  }

  private async delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Delay cancelled'))
        return
      }
      
      const timer = setTimeout(resolve, ms)
      
      if (signal) {
        const abortHandler = () => {
          clearTimeout(timer)
          reject(new Error('Delay cancelled'))
        }
        signal.addEventListener('abort', abortHandler, { once: true })
      }
    })
  }

  private calculateDelay(attempt: number): number {
    const delay = this.options.delay
    
    if (typeof delay === 'number') {
      return delay
    }
    
    const strategy = delay as DelayStrategy
    const factor = strategy.factor ?? 2
    
    let calculatedDelay: number
    
    switch (strategy.type) {
      case 'fixed':
        calculatedDelay = strategy.initial
        break
        
      case 'linear':
        calculatedDelay = strategy.initial + (strategy.initial * factor * attempt)
        break
        
      case 'exponential':
        calculatedDelay = strategy.initial * Math.pow(factor, attempt)
        break
        
      default:
        calculatedDelay = strategy.initial
    }
    
    // Apply max delay cap if specified
    if (strategy.maxDelay !== undefined && calculatedDelay > strategy.maxDelay) {
      return strategy.maxDelay
    }
    
    return calculatedDelay
  }

  private updateLatencyMetrics(latency: number): void {
    this.latencies.push(latency)
    
    // Update average latencies
    this.metrics.avgPrimaryLatency = this.calculateAverage(this.primaryLatencies)
    this.metrics.avgHedgeLatency = this.calculateAverage(this.hedgeLatencies)
    
    // Update p99 latency
    if (this.latencies.length > 0) {
      const sorted = [...this.latencies].sort((a, b) => a - b)
      const p99Index = Math.floor(sorted.length * 0.99)
      this.metrics.p99Latency = sorted[p99Index] ?? sorted[sorted.length - 1] ?? 0
    }
  }

  private updateResourceWaste(): void {
    if (this.metrics.hedgeRequests > 0) {
      // Resource waste = hedge requests that didn't win / total hedge requests
      const wastedHedges = this.metrics.hedgeRequests - this.metrics.hedgeWins
      this.metrics.resourceWaste = (wastedHedges / this.metrics.hedgeRequests) * 100
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  getMetrics(): HedgeMetrics {
    return { ...this.metrics }
  }

  onHedge(callback: (attempt: number, delay: number) => void): HedgePolicy {
    this.hedgeCallback = callback
    return this
  }
}

export function hedge(options: HedgeOptions): HedgePolicy {
  return new Hedge(options)
}