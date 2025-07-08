/**
 * @file Loading state machine implementation using @zerothrow/graph
 * Clean, simple, Result-first design following ZeroThrow principles
 */

import { Graph, GraphIterator } from '@zerothrow/graph'
import type { Result } from '@zerothrow/core'
import type { LoadingState } from '../types/loading.js'

// Define our states and events as enums for performance
export enum LoadingStateType {
  Idle = 0,
  Pending = 1,
  Refreshing = 2,
  Retrying = 3,
  Success = 4,
  Error = 5
}

export enum LoadingEvent {
  Start = 0,
  Success = 1,
  Error = 2,
  Retry = 3,
  Refresh = 4,
  Reset = 5,
  Abort = 6
}

// Context holds the additional state data
export interface LoadingContext {
  data: LoadingState
  startTime?: number
  attempt: number
}

/**
 * Loading state machine with event-to-state mapping
 * Simple, clean, Result-oriented design
 */
export class LoadingStateMachine {
  private graph: Graph<LoadingStateType, LoadingEvent>
  private iterator: GraphIterator<LoadingStateType, LoadingEvent>
  private context: LoadingContext
  private listeners = new Set<(state: LoadingState) => void>()
  
  constructor() {
    // Build the graph structure
    this.graph = new Graph<LoadingStateType, LoadingEvent>()
      // From Idle
      .addEdge(LoadingStateType.Idle, LoadingStateType.Pending, LoadingEvent.Start)
      
      // From Pending
      .addEdge(LoadingStateType.Pending, LoadingStateType.Success, LoadingEvent.Success)
      .addEdge(LoadingStateType.Pending, LoadingStateType.Error, LoadingEvent.Error)
      .addEdge(LoadingStateType.Pending, LoadingStateType.Idle, LoadingEvent.Abort)
      
      // From Refreshing
      .addEdge(LoadingStateType.Refreshing, LoadingStateType.Success, LoadingEvent.Success)
      .addEdge(LoadingStateType.Refreshing, LoadingStateType.Error, LoadingEvent.Error)
      .addEdge(LoadingStateType.Refreshing, LoadingStateType.Idle, LoadingEvent.Abort)
      
      // From Retrying
      .addEdge(LoadingStateType.Retrying, LoadingStateType.Success, LoadingEvent.Success)
      .addEdge(LoadingStateType.Retrying, LoadingStateType.Error, LoadingEvent.Error)
      .addEdge(LoadingStateType.Retrying, LoadingStateType.Idle, LoadingEvent.Abort)
      
      // From Success
      .addEdge(LoadingStateType.Success, LoadingStateType.Idle, LoadingEvent.Reset)
      .addEdge(LoadingStateType.Success, LoadingStateType.Refreshing, LoadingEvent.Refresh)
      
      // From Error
      .addEdge(LoadingStateType.Error, LoadingStateType.Idle, LoadingEvent.Reset)
      .addEdge(LoadingStateType.Error, LoadingStateType.Retrying, LoadingEvent.Retry)
      .addEdge(LoadingStateType.Error, LoadingStateType.Refreshing, LoadingEvent.Refresh)
    
    // Initialize iterator and context
    this.iterator = new GraphIterator(this.graph, LoadingStateType.Idle)
    this.context = {
      data: { type: 'idle' },
      attempt: 0
    }
  }
  
  /**
   * Get current state data
   */
  getState(): LoadingState {
    return this.context.data
  }
  
  /**
   * Get internal state type
   */
  getStateType(): LoadingStateType {
    return this.iterator.current
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: LoadingState) => void): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }
  
  /**
   * Send events to transition states
   * Simple data parameter - let the caller decide what to pass
   */
  send(event: LoadingEvent, data?: {
    result?: Result<unknown, Error>
    duration?: number
    attempt?: number
    maxAttempts?: number
    previousData?: unknown
    value?: unknown
    error?: Error
    canRetry?: boolean
  }): boolean {
    const previousState = this.iterator.current
    const newState = this.iterator.go(event)
    
    if (newState === undefined) {
      return false
    }
    
    // Update context based on transition
    this.updateContext(previousState, newState, event, data)
    
    // Notify listeners
    for (const listener of this.listeners) {
      listener(this.context.data)
    }
    
    return true
  }
  
  /**
   * Update context based on state transition
   * Simple, straightforward logic
   */
  private updateContext(
    _from: LoadingStateType, 
    to: LoadingStateType, 
    _event: LoadingEvent,
    data?: {
      result?: Result<unknown, Error>
      duration?: number
      attempt?: number
      maxAttempts?: number
      previousData?: unknown
      value?: unknown
      error?: Error
      canRetry?: boolean
    }
  ): void {
    const now = Date.now()
    
    switch (to) {
      case LoadingStateType.Idle:
        this.context = {
          data: { type: 'idle' },
          attempt: 0
        }
        break
        
      case LoadingStateType.Pending:
        this.context = {
          ...this.context,
          startTime: now,
          data: { type: 'pending', startedAt: now }
        }
        break
        
      case LoadingStateType.Refreshing:
        this.context = {
          ...this.context,
          startTime: now,
          data: {
            type: 'refreshing',
            startedAt: now,
            previousData: data?.previousData
          }
        }
        break
        
      case LoadingStateType.Retrying:
        this.context = {
          ...this.context,
          startTime: now,
          attempt: this.context.attempt + 1,
          data: {
            type: 'retrying',
            startedAt: now,
            attempt: this.context.attempt + 1,
            maxAttempts: data?.maxAttempts ?? 3,
            nextRetryAt: now + 1000 // Simple 1s delay
          }
        }
        break
        
      case LoadingStateType.Success:
        this.context = {
          ...this.context,
          data: {
            type: 'success',
            completedAt: now,
            duration: data?.duration || (this.context.startTime ? now - this.context.startTime : 0)
          }
        }
        break
        
      case LoadingStateType.Error:
        this.context = {
          ...this.context,
          data: {
            type: 'error',
            error: data?.error || (data?.result?.match ? data.result.match({ ok: () => new Error('Operation failed'), err: e => e }) : new Error('Operation failed')),
            failedAt: now,
            canRetry: data?.canRetry !== undefined ? data.canRetry : true,
            duration: data?.duration || (this.context.startTime ? now - this.context.startTime : 0)
          }
        }
        break
    }
  }
  
  /**
   * Convenience state checkers
   */
  isIdle(): boolean { return this.iterator.current === LoadingStateType.Idle }
  isPending(): boolean { return this.iterator.current === LoadingStateType.Pending }
  isRefreshing(): boolean { return this.iterator.current === LoadingStateType.Refreshing }
  isRetrying(): boolean { return this.iterator.current === LoadingStateType.Retrying }
  isSuccess(): boolean { return this.iterator.current === LoadingStateType.Success }
  isError(): boolean { return this.iterator.current === LoadingStateType.Error }
  
  isLoading(): boolean {
    const state = this.iterator.current
    return state === LoadingStateType.Pending || 
           state === LoadingStateType.Refreshing || 
           state === LoadingStateType.Retrying
  }
  
  isSettled(): boolean {
    const state = this.iterator.current
    return state === LoadingStateType.Success || 
           state === LoadingStateType.Error
  }
  
  /**
   * Check if a specific event can be sent
   */
  can(event: LoadingEvent): boolean {
    return this.iterator.can(event)
  }
}