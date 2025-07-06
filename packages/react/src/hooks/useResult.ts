import { useCallback, useEffect, useReducer, useRef } from 'react'
import { ZT } from '@zerothrow/core'
import type { Result } from '@zerothrow/core'

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
}

export interface UseResultReturn<T, E extends Error> {
  /**
   * The current Result value (undefined while loading)
   */
  result: Result<T, E> | undefined
  
  /**
   * Whether the async operation is in progress
   */
  loading: boolean
  
  /**
   * Manually trigger execution
   */
  reload: () => void
  
  /**
   * Reset to initial state
   */
  reset: () => void
}

interface State<T, E extends Error> {
  result: Result<T, E> | undefined
  loading: boolean
}

type Action<T, E extends Error> = 
  | { type: 'LOADING' }
  | { type: 'SUCCESS'; result: Result<T, E> }
  | { type: 'RESET' }

function reducer<T, E extends Error>(state: State<T, E>, action: Action<T, E>): State<T, E> {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true }
    case 'SUCCESS':
      return { result: action.result, loading: false }
    case 'RESET':
      return { result: undefined, loading: false }
    default:
      return state
  }
}

/**
 * React hook for handling async operations that return Results.
 * 
 * @example
 * ```tsx
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
 * if (loading) return <Spinner />
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
  const { immediate = true, deps = [] } = options
  
  const [state, dispatch] = useReducer(reducer<T, E>, {
    result: undefined,
    loading: immediate,
  })
  
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController>()
  
  const execute = useCallback(async () => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    
    dispatch({ type: 'LOADING' })
    
    try {
      const result = await fn()
      
      // Only update state if component is still mounted
      if (isMountedRef.current && !abortControllerRef.current.signal.aborted) {
        dispatch({ type: 'SUCCESS', result })
      }
    } catch (error) {
      // If fn throws (which it shouldn't if following Result patterns),
      // convert to Result.err
      if (isMountedRef.current && !abortControllerRef.current.signal.aborted) {
        const errorResult = ZT.err(error instanceof Error ? error : new Error(String(error))) as Result<T, any>
        dispatch({ type: 'SUCCESS', result: errorResult })
      }
    }
  }, deps)
  
  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    dispatch({ type: 'RESET' })
  }, [])
  
  useEffect(() => {
    if (immediate) {
      execute()
    }
    
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [execute, immediate])
  
  return {
    result: state.result,
    loading: state.loading,
    reload: execute,
    reset,
  }
}