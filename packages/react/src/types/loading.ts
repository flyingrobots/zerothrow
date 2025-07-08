/**
 * @file Loading state types and management for Result-based React hooks
 */

/**
 * Granular loading state information providing detailed visibility
 * into async operation lifecycle and retry behavior.
 */
export type LoadingState = 
  | IdleState
  | PendingState
  | RefreshingState
  | RetryingState
  | SuccessState
  | ErrorState

export interface IdleState {
  type: 'idle'
}

export interface PendingState {
  type: 'pending'
  startedAt: number
  progress?: number
}

export interface RefreshingState {
  type: 'refreshing'
  previousData: unknown
  startedAt: number
  progress?: number
}

export interface RetryingState {
  type: 'retrying'
  attempt: number
  maxAttempts: number
  nextRetryAt: number
  startedAt: number
  lastError?: Error
}

export interface SuccessState {
  type: 'success'
  completedAt: number
  duration: number
}

export interface ErrorState {
  type: 'error'
  failedAt: number
  error: Error
  canRetry: boolean
  duration?: number
}

/**
 * Computed convenience booleans derived from LoadingState
 */
export enum LoadingPhase {
  Idle = 'idle',
  Executing = 'executing', 
  Retrying = 'retrying',
  Settled = 'settled'
}

export interface LoadingFlags {
  phase: LoadingPhase
  isRetrying: boolean // This can coexist with phase since retry is a specific type of execution
}


/**
 * Utility functions for working with loading states
 */
export const LoadingStateUtils = {
  /**
   * Check if state represents an active loading operation
   */
  isLoading(state: LoadingState): boolean {
    return state.type === 'pending' || state.type === 'refreshing' || state.type === 'retrying'
  },
  
  /**
   * Get duration of current operation if applicable
   */
  getCurrentDuration(state: LoadingState): number | undefined {
    const now = Date.now()
    switch (state.type) {
      case 'pending':
      case 'refreshing':
        return now - state.startedAt
      case 'retrying':
        return now - state.startedAt
      case 'success':
      case 'error':
        return state.duration
      default:
        return undefined
    }
  },
  
  /**
   * Create a LoadingFlags object from a LoadingState
   */
  toFlags(state: LoadingState): LoadingFlags {
    return {
      idle: state.type === 'idle',
      executing: state.type === 'pending' || state.type === 'refreshing',
      retrying: state.type === 'retrying',
      settled: state.type === 'success' || state.type === 'error'
    }
  }
}