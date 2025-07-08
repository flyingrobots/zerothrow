/**
 * @file Advanced state introspection hook for React Result hooks
 */

import { useEffect, useRef, useState } from 'react'
import type { Result } from '@zerothrow/core'
import type { LoadingState, LoadingFlags } from '../types/loading.js'
import { LoadingStateUtils } from '../types/loading.js'
import { StateHistory, type HistoryEntry, type Metrics, type TriggerType } from '../utils/stateHistory.js'

/**
 * Configuration options for state introspection
 */
export interface UseStateIntrospectionOptions {
  /**
   * Maximum number of history entries to keep
   * @default 10
   */
  historyLimit?: number
  
  /**
   * Enable DevTools integration (auto-enabled in development)
   * @default true in development
   */
  enableDevTools?: boolean
  
  /**
   * Track performance metrics
   * @default true
   */
  trackMetrics?: boolean
  
  /**
   * Name for debugging and DevTools display
   * @default 'Unknown'
   */
  name?: string
}

/**
 * Debug information about the hook and component
 */
export interface DebugInfo {
  componentName: string
  hookName: string
  mountedAt: number
  renderCount: number
  stateChanges: number
}

/**
 * Complete introspection data combining state, history, and metrics
 */
export interface IntrospectionData<T, E extends Error> {
  // Core state
  current: Result<T, E> | null
  loading: LoadingState
  flags: LoadingFlags
  
  // History tracking
  history: ReadonlyArray<HistoryEntry<T, E>>
  
  // Metrics
  metrics: Metrics
  
  // Debugging
  debug: DebugInfo
}

/**
 * Return type for useStateIntrospection hook
 */
export interface UseStateIntrospectionReturn<T, E extends Error> {
  introspection: IntrospectionData<T, E>
  clearHistory: () => void
  exportState: () => string
  timeTravel: (index: number) => void
}

/**
 * Global DevTools registry (only in development)
 */
declare global {
  interface Window {
    __ZEROTHROW_DEVTOOLS__?: {
      register: (name: string, data: IntrospectionData<unknown, Error>) => void
      unregister: (name: string) => void
    }
  }
}

/**
 * Advanced state introspection hook providing detailed visibility into
 * Result hook state, history, and performance metrics.
 * 
 * @example
 * ```typescript
 * const MyComponent = () => {
 *   const { result, loadingState } = useResult(fetchUser)
 *   const { introspection, exportState } = useStateIntrospection(
 *     result, 
 *     loadingState,
 *     { name: 'UserData', historyLimit: 20 }
 *   )
 *   
 *   // Access detailed state information
 *   console.log('Success rate:', introspection.metrics.successRate)
 *   console.log('Average duration:', introspection.metrics.averageDuration)
 *   
 *   // Export for debugging
 *   const handleExport = () => {
 *     console.log(exportState())
 *   }
 * }
 * ```
 */
export function useStateIntrospection<T, E extends Error>(
  result: Result<T, E> | null | undefined,
  loadingState: LoadingState,
  options: UseStateIntrospectionOptions = {}
): UseStateIntrospectionReturn<T, E> {
  const {
    historyLimit = 10,
    enableDevTools = process.env['NODE_ENV'] === 'development',
    trackMetrics = true,
    name = 'Unknown'
  } = options
  
  // Initialize history manager
  const [history] = useState(() => new StateHistory<T, E>(historyLimit))
  const [metrics, setMetrics] = useState<Metrics>(() => history.getMetrics())
  
  // Debug tracking
  const mountTime = useRef(Date.now())
  const renderCount = useRef(0)
  const previousResult = useRef<Result<T, E> | null | undefined>(result)
  const previousLoadingState = useRef<LoadingState>(loadingState)
  
  // Track renders
  useEffect(() => {
    renderCount.current++
  })
  
  // Determine trigger type based on state transitions
  const determineTrigger = (
    newLoadingState: LoadingState,
    previousLoadingState: LoadingState
  ): TriggerType => {
    if (newLoadingState.type === 'retrying') {
      return 'retry'
    }
    if (newLoadingState.type === 'refreshing') {
      return 'refresh'
    }
    if (previousLoadingState.type === 'idle' && newLoadingState.type === 'pending') {
      return 'initial'
    }
    return 'manual'
  }
  
  // Calculate duration from loading state
  const calculateDuration = (loadingState: LoadingState): number | undefined => {
    return LoadingStateUtils.getCurrentDuration(loadingState)
  }
  
  // Track state changes and update history
  useEffect(() => {
    const hasResultChanged = result !== previousResult.current
    
    // Only add to history when we have a settled result
    if (hasResultChanged && result && (loadingState.type === 'success' || loadingState.type === 'error')) {
      const trigger = determineTrigger(loadingState, previousLoadingState.current)
      const duration = calculateDuration(loadingState)
      const attempt = undefined // Will be set based on loading state in the future
      
      const entry: HistoryEntry<T, E> = {
        timestamp: Date.now(),
        state: result,
        trigger,
        ...(duration !== undefined ? { duration } : {}),
        ...(attempt !== undefined ? { attempt } : {})
      }
      
      history.push(entry)
      
      if (trackMetrics) {
        setMetrics(history.getMetrics())
      }
    }
    
    // Update refs
    previousResult.current = result
    previousLoadingState.current = loadingState
  }, [result, loadingState, trackMetrics, history])
  
  // Build introspection data
  const introspection: IntrospectionData<T, E> = {
    current: result || null,
    loading: loadingState,
    flags: LoadingStateUtils.toFlags(loadingState),
    history: history.getHistory(),
    metrics,
    debug: {
      componentName: name,
      hookName: 'useStateIntrospection',
      mountedAt: mountTime.current,
      renderCount: renderCount.current,
      stateChanges: history.size()
    }
  }
  
  // DevTools integration
  useEffect(() => {
    if (enableDevTools && typeof window !== 'undefined' && window.__ZEROTHROW_DEVTOOLS__) {
      window.__ZEROTHROW_DEVTOOLS__.register(name, introspection as IntrospectionData<unknown, Error>)
      return () => {
        window.__ZEROTHROW_DEVTOOLS__?.unregister(name)
      }
    }
    return undefined
  }, [name, introspection, enableDevTools])
  
  // Time travel implementation (development only)
  const timeTravel = (index: number): void => {
    if (!enableDevTools) {
      // eslint-disable-next-line no-console
      console.warn('Time travel is only available in development mode')
      return
    }
    
    const historyEntries = history.getHistory()
    if (index < 0 || index >= historyEntries.length) {
      // eslint-disable-next-line no-console
      console.warn(`Invalid time travel index: ${index}. Valid range: 0-${historyEntries.length - 1}`)
      return
    }
    
    // In a real implementation, this would trigger the parent hook to update
    // For now, we just log the action
    // eslint-disable-next-line no-console
    console.log('Time travel to entry:', historyEntries[index])
    return // Explicit return to satisfy all code paths
  }
  
  return {
    introspection,
    clearHistory: () => {
      history.clear()
      setMetrics(history.getMetrics())
    },
    exportState: () => {
      return JSON.stringify({
        introspection,
        exportedAt: Date.now(),
        version: '1.0.0'
      }, null, 2)
    },
    timeTravel: enableDevTools ? timeTravel : () => {}
  }
}