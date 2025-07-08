/**
 * @file State history tracking and metrics calculation
 */

import type { Result } from '@zerothrow/core'

/**
 * Trigger types for state changes
 */
export type TriggerType = 'initial' | 'refresh' | 'retry' | 'manual'

/**
 * History entry representing a single state change
 */
export interface HistoryEntry<T, E extends Error> {
  timestamp: number
  state: Result<T, E>
  trigger: TriggerType
  duration?: number
  attempt?: number
}

/**
 * Aggregated metrics calculated from history
 */
export interface Metrics {
  totalRequests: number
  successCount: number
  errorCount: number
  averageDuration: number
  successRate: number
  lastError?: { error: unknown; timestamp: number }
  fastestRequest: number | undefined
  slowestRequest: number | undefined
}

/**
 * Manages state history with automatic metrics calculation
 */
export class StateHistory<T, E extends Error> {
  private history: Array<HistoryEntry<T, E>> = []
  private maxSize: number
  
  constructor(maxSize: number = 10) {
    this.maxSize = Math.max(1, maxSize)
  }
  
  /**
   * Add a new entry to the history
   */
  push(entry: HistoryEntry<T, E>): void {
    this.history.push(entry)
    
    // Maintain size limit by removing oldest entries
    if (this.history.length > this.maxSize) {
      this.history.shift()
    }
  }
  
  /**
   * Get read-only copy of history
   */
  getHistory(): ReadonlyArray<HistoryEntry<T, E>> {
    return [...this.history]
  }
  
  /**
   * Clear all history
   */
  clear(): void {
    this.history = []
  }
  
  /**
   * Get the most recent entry
   */
  getLatest(): HistoryEntry<T, E> | undefined {
    return this.history[this.history.length - 1]
  }
  
  /**
   * Get calculated metrics from current history
   */
  getMetrics(): Metrics {
    const entriesWithDuration = this.history.filter(entry => entry.duration !== undefined)
    const successEntries = this.history.filter(entry => entry.state.ok)
    const errorEntries = this.history.filter(entry => !entry.state.ok)
    
    const durations = entriesWithDuration
      .map(entry => entry.duration as number)
      .filter(duration => duration > 0)
    
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0
    
    const lastErrorEntry = errorEntries[errorEntries.length - 1]
    
    const result: Metrics = {
      totalRequests: this.history.length,
      successCount: successEntries.length,
      errorCount: errorEntries.length,
      averageDuration: Math.round(averageDuration),
      successRate: this.history.length > 0 
        ? Math.round((successEntries.length / this.history.length) * 100) / 100
        : 0,
      fastestRequest: durations.length > 0 ? Math.min(...durations) : undefined,
      slowestRequest: durations.length > 0 ? Math.max(...durations) : undefined
    }
    
    if (lastErrorEntry) {
      result.lastError = {
        error: !lastErrorEntry.state.ok ? lastErrorEntry.state.error : undefined,
        timestamp: lastErrorEntry.timestamp
      }
    }
    
    return result
  }
  
  /**
   * Get entries filtered by trigger type
   */
  getByTrigger(trigger: TriggerType): ReadonlyArray<HistoryEntry<T, E>> {
    return this.history.filter(entry => entry.trigger === trigger)
  }
  
  /**
   * Get entries within a time range
   */
  getByTimeRange(startTime: number, endTime: number): ReadonlyArray<HistoryEntry<T, E>> {
    return this.history.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    )
  }
  
  /**
   * Export history as JSON string for debugging
   */
  export(): string {
    return JSON.stringify({
      history: this.history,
      metrics: this.getMetrics(),
      exportedAt: Date.now()
    }, null, 2)
  }
  
  /**
   * Get the current size of the history
   */
  size(): number {
    return this.history.length
  }
  
  /**
   * Check if history is at maximum capacity
   */
  isFull(): boolean {
    return this.history.length >= this.maxSize
  }
}