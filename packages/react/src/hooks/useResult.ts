import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { ZT } from '@zerothrow/core'
import type { Result } from '@zerothrow/core'
import { type LoadingState, type LoadingFlags, LoadingPhase } from '../types/loading.js'
import { useStateIntrospection, type UseStateIntrospectionOptions, type IntrospectionData } from './useStateIntrospection.js'

export interface UseResultOptions {
  /**
   * Whether to execute the function immediately on mount
   * @default true
   */
  immediate?: boolean
  
  /**
   * Dependencies array for re-execution
   */
  deps?: React.DependencyList
  
  /**
   * Enable advanced state introspection with optional configuration
   * @default false
   */
  introspection?: boolean | UseStateIntrospectionOptions
}

export interface UseResultReturn<T, E extends Error> {
  /**
   * The current Result value (undefined while loading)
   */
  result: Result<T, E> | undefined
  
  /**
   * Whether the async operation is in progress (backward compatible)
   */
  loading: boolean
  
  /**
   * Granular loading state information
   */
  loadingState: LoadingState
  
  /**
   * Convenient state information derived from loading state
   */
  state: LoadingFlags & {
    /** Current attempt number (1-based) */
    attempt: number
  }
  
  /**
   * Manually trigger execution
   */
  reload: () => void
  
  /**
   * Reset to initial state
   */
  reset: () => void
  
  /**
   * Advanced introspection data (only when introspection is enabled)
   */
  introspect?: IntrospectionData<T, E>
  
  /**
   * Development tools (only in development mode)
   */
  devTools: {
    pause: () => void
    resume: () => void
    setMockResult: (result: Result<T, E>) => void
  } | undefined
}

interface State<T, E extends Error> {
  result: Result<T, E> | undefined
  attempt: number
}

type Action<T, E extends Error> = 
  | { type: 'LOADING'; isRetry?: boolean }
  | { type: 'SUCCESS'; result: Result<T, E> }
  | { type: 'RESET' }

function reducer<T, E extends Error>(state: State<T, E>, action: Action<T, E>): State<T, E> {
  switch (action.type) {
    case 'LOADING':
      return { 
        ...state,
        attempt: action.isRetry ? state.attempt + 1 : 1
      }
    case 'SUCCESS':
      return { ...state, result: action.result }
    case 'RESET':
      return { result: undefined, attempt: 0 }
    default:
      return state
  }
}

/**
 * Enhanced React hook for handling async operations that return Results with
 * optional advanced state introspection and granular loading states.
 * 
 * @example
 * ```tsx
 * // Basic usage (backward compatible)
 * const { result, loading, reload } = useResult(
 *   async () => {
 *     const response = await fetch('/api/user')
 *     if (!response.ok) return ZT.err(new Error('Failed to fetch'))
 *     const data = await response.json()
 *     return ZT.ok(data)
 *   },
 *   { deps: [userId] }
 * )
 * 
 * // Advanced usage with granular state
 * const { result, state, loadingState, introspect } = useResult(
 *   fetchUser,
 *   { 
 *     deps: [userId],
 *     introspection: { 
 *       name: 'UserData',
 *       historyLimit: 20 
 *     }
 *   }
 * )
 * 
 * // Use granular state information
 * if (state.retrying) {
 *   return <RetryIndicator attempt={state.attempt} />
 * }
 * 
 * if (state.executing) {
 *   return <LoadingSpinner />
 * }
 * 
 * return result?.match({
 *   ok: user => <UserProfile {...user} />,
 *   err: error => <ErrorMessage error={error} />
 * }) ?? null
 * ```
 */
export function useResult<T, E extends Error = Error>(
  fn: () => Promise<Result<T, E>> | Result<T, E>,
  options: UseResultOptions = {}
): UseResultReturn<T, E> {
  const { immediate = true, deps = [], introspection } = options
  
  const [state, dispatch] = useReducer(reducer<T, E>, {
    result: undefined,
    attempt: 0
  })
  
  const abortControllerRef = useRef<AbortController>()
  const [loadingState, setLoadingState] = useState<LoadingState>({ type: 'idle' })
  const [isPaused, setIsPaused] = useState(false)
  const [mockResult, setMockResult] = useState<Result<T, E> | null>(null)
  
  // Use ref to access current state without causing re-renders
  const stateRef = useRef(state)
  stateRef.current = state
  
  const execute = useCallback(async (isRetry = false) => {
    if (isPaused) return
    
    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    
    dispatch({ type: 'LOADING', isRetry })
    
    const startTime = Date.now()
    
    // Update loading state based on context
    const currentState = stateRef.current
    if (isRetry) {
      setLoadingState({
        type: 'retrying',
        attempt: currentState.attempt + 1,
        maxAttempts: 3, // Could be configurable
        nextRetryAt: Date.now() + 1000, // Could be configurable
        startedAt: startTime
      })
    } else if (currentState.result) {
      setLoadingState({
        type: 'refreshing',
        previousData: currentState.result.ok ? currentState.result.value : undefined,
        startedAt: startTime
      })
    } else {
      setLoadingState({
        type: 'pending',
        startedAt: startTime
      })
    }
    
    try {
      const result = mockResult || await fn()
      
      // Only update state if not aborted
      if (!abortControllerRef.current.signal.aborted) {
        dispatch({ type: 'SUCCESS', result })
        
        const duration = Date.now() - startTime
        setLoadingState({
          type: 'success',
          completedAt: Date.now(),
          duration
        })
      }
    } catch (error) {
      // If fn throws (which it shouldn't if following Result patterns),
      // convert to Result.err
      if (!abortControllerRef.current.signal.aborted) {
        const errorResult = ZT.err(
          error instanceof Error ? error : new Error(String(error))
        ) as unknown as Result<T, E>
        dispatch({ type: 'SUCCESS', result: errorResult })
        
        const duration = Date.now() - startTime
        setLoadingState({
          type: 'error',
          failedAt: Date.now(),
          error: error instanceof Error ? error : new Error(String(error)),
          canRetry: true,
          duration
        })
      }
    }
  }, [fn, isPaused, mockResult, ...deps])
  
  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    dispatch({ type: 'RESET' })
    setLoadingState({ type: 'idle' })
    setMockResult(null)
  }, [])
  
  useEffect(() => {
    if (immediate) {
      execute()
    }
    
    return () => {
      abortControllerRef.current?.abort()
      // Reset to idle when component unmounts/effect re-runs
      setLoadingState({ type: 'idle' })
    }
  }, [execute, immediate])
  
  // Introspection setup (always call to satisfy Rules of Hooks)
  const introspectionConfig = introspection
  const introspectionOptions = introspectionConfig
    ? typeof introspectionConfig === 'object' 
      ? introspectionConfig 
      : { name: 'useResult' }
    : undefined
  
  const introspectionHook = useStateIntrospection(
    state.result,
    loadingState,
    introspectionOptions
  )
  
  // Derive phase from loading state
  const getPhase = (loadingState: LoadingState): LoadingPhase => {
    switch (loadingState.type) {
      case 'idle':
        return LoadingPhase.Idle
      case 'pending':
      case 'refreshing':
        return LoadingPhase.Executing
      case 'retrying':
        return LoadingPhase.Retrying
      case 'success':
      case 'error':
        return LoadingPhase.Settled
    }
  }
  
  const flags: LoadingFlags = {
    phase: getPhase(loadingState),
    isRetrying: loadingState.type === 'retrying'
  }
  
  const enhancedState = {
    ...flags,
    attempt: state.attempt
  }
  
  // Development tools
  const devTools = process.env['NODE_ENV'] === 'development' ? {
    pause: () => setIsPaused(true),
    resume: () => setIsPaused(false),
    setMockResult: (result: Result<T, E>) => setMockResult(result)
  } : undefined
  
  // Derive backward-compatible loading boolean from loading state
  const isLoading = loadingState.type === 'pending' || 
                   loadingState.type === 'refreshing' || 
                   loadingState.type === 'retrying'

  return {
    result: state.result,
    loading: isLoading, // Backward compatible
    loadingState,
    state: enhancedState,
    reload: () => execute(false),
    reset,
    ...(introspectionConfig ? { introspect: introspectionHook.introspection } : {}),
    devTools
  }
}