import { ZeroThrow, ZT, ZeroError } from '@zerothrow/core'
import type { HedgePolicy, HedgeOptions, HedgeMetrics, DelayStrategy } from '../types.js'
import { HedgeFailedError as HedgeErrorImpl } from '../types.js'

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

  execute<T, E extends ZeroError = ZeroError>(operation: () => ZeroThrow.Async<T, E>): ZeroThrow.Async<T, E> {
    return ZeroThrow.enhance(this.executeAsync(operation))
  }

  private async executeAsync<T, E extends ZeroError = ZeroError>(operation: () => ZeroThrow.Async<T, E>): Promise<ZeroThrow.Result<T, E>> {
    const startTime = Date.now()
    this.metrics.totalRequests++
    
    // Calculate delay for first hedge
    const delay = this.calculateDelay(0)
    
    // If delay is very high or hedging is disabled, just run primary
    if (delay >= 10000 || !this.options.shouldHedge(0)) {
      const result = await operation()
      const latency = Date.now() - startTime
      this.updateLatencyMetrics(latency)
      this.primaryLatencies.push(latency)
      this.metrics.primaryWins++
      this.updateResourceWaste()
      return result
    }
    
    return new Promise((resolve) => {
      let resolved = false
      const controllers: AbortController[] = []
      const allErrors: E[] = []
      
      // Start primary operation
      const primaryController = new AbortController()
      controllers.push(primaryController)
      
      // Start primary operation
      operation()
        .then(result => {
          if (!resolved) {
            const latency = Date.now() - startTime
            this.updateLatencyMetrics(latency)
            this.primaryLatencies.push(latency)
            if (result.ok) {
              resolved = true
              this.metrics.primaryWins++
              this.updateResourceWaste()
              resolve(result)
            } else {
              allErrors.push(result.error)
            }
          }
        })
        .catch((error) => {
          // Handle promise rejection (should not happen with Result pattern)
          if (!resolved) {
            const zeroError = error instanceof ZeroError ? error : new ZeroError('HEDGE_ERROR', String(error))
            allErrors.push(zeroError as E)
          }
        })
      
      // Schedule hedge requests
      for (let i = 0; i < this.options.maxHedges && !resolved; i++) {
        if (this.options.shouldHedge(i + 1)) {
          const hedgeDelay = this.calculateDelay(i)
          
          setTimeout(async () => {
            if (resolved) return
            
            if (this.hedgeCallback) {
              this.hedgeCallback(i + 1, hedgeDelay)
            }
            
            this.metrics.hedgeRequests++
            
            const hedgeController = new AbortController()
            controllers.push(hedgeController)
            
            try {
              const result = await operation()
              if (!resolved) {
                const latency = Date.now() - startTime
                if (result.ok) {
                  resolved = true
                  this.updateLatencyMetrics(latency)
                  this.hedgeLatencies.push(latency)
                  this.metrics.hedgeWins++
                  this.updateResourceWaste()
                  resolve(result)
                } else {
                  // Track error for potential final error response
                  allErrors.push(result.error)
                }
              }
            } catch {
              // Hedge failed, continue waiting
            }
          }, hedgeDelay)
        }
      }
      
      // If no success after reasonable time, collect errors and fail
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          // All attempts failed - use collected errors or create default
          const errors = allErrors.length > 0 ? allErrors : [new ZeroError('HEDGE_TIMEOUT', 'All hedge attempts timed out') as E]
          const hedgeError = new HedgeErrorImpl<E>(
            'hedge',
            Math.min(this.options.maxHedges + 1, 2),
            errors,
            { attempts: Math.min(this.options.maxHedges + 1, 2) }
          ) as unknown as E
          resolve(ZT.err(hedgeError) as unknown as ZeroThrow.Result<T, E>)
        }
      }, Math.max(delay * (this.options.maxHedges + 2), 500))
    })
  }

  private calculateDelay(attemptIndex: number): number {
    const { delay } = this.options
    
    if (typeof delay === 'number') {
      return delay
    }
    
    const strategy = delay as DelayStrategy
    const { initial, factor = 2, maxDelay = Infinity } = strategy
    
    switch (strategy.type) {
      case 'fixed':
        return Math.min(initial, maxDelay)
      case 'linear':
        return Math.min(initial + (attemptIndex * (factor * initial)), maxDelay)
      case 'exponential':
        return Math.min(initial * Math.pow(factor, attemptIndex), maxDelay)
      default:
        return initial
    }
  }

  private updateLatencyMetrics(latency: number): void {
    this.latencies.push(latency)
    
    // Update averages
    if (this.primaryLatencies.length > 0) {
      this.metrics.avgPrimaryLatency = this.primaryLatencies.reduce((a, b) => a + b, 0) / this.primaryLatencies.length
    }
    
    if (this.hedgeLatencies.length > 0) {
      this.metrics.avgHedgeLatency = this.hedgeLatencies.reduce((a, b) => a + b, 0) / this.hedgeLatencies.length
    }
    
    // Update p99
    if (this.latencies.length > 0) {
      const sorted = [...this.latencies].sort((a, b) => a - b)
      const p99Index = Math.floor(sorted.length * 0.99)
      // Ensure we always have a valid number
      this.metrics.p99Latency = sorted[p99Index] ?? sorted[sorted.length - 1] ?? 0
    }
  }

  private updateResourceWaste(): void {
    const totalHedgeRequests = this.metrics.hedgeRequests
    const wastedRequests = totalHedgeRequests - this.metrics.hedgeWins
    this.metrics.resourceWaste = totalHedgeRequests > 0 ? (wastedRequests / totalHedgeRequests) * 100 : 0
  }

  onHedge(callback: (attempt: number, delay: number) => void): HedgePolicy {
    this.hedgeCallback = callback
    return this
  }

  getMetrics(): HedgeMetrics {
    return { ...this.metrics }
  }
}

/**
 * Creates a hedge policy for tail latency reduction
 */
export function hedge(options: HedgeOptions): HedgePolicy {
  return new Hedge(options)
}