import { useCallback, useEffect, useReducer, useRef } from 'react'
import { ZT } from '@zerothrow/core'
import type { Result } from '@zerothrow/core'
// import type { PolicyInterface } from '@zerothrow/resilience' // TODO: Fix when resilience exports proper types

type CircuitState = 'closed' | 'open' | 'half-open'

export interface UseResilientResultOptions {
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

export interface UseResilientResultReturn<T, E extends Error> {
  /**
   * The current Result value (undefined while loading)
   */
  result: Result<T, E> | undefined
  
  /**
   * Whether the async operation is in progress
   */
  loading: boolean
  
  /**
   * Number of retry attempts made
   */
  retryCount: number
  
  /**
   * Timestamp when the next retry will occur (if applicable)
   */
  nextRetryAt: number | undefined
  
  /**
   * Current state of the circuit breaker (if using CircuitBreakerPolicy)
   */
  circuitState: CircuitState | undefined
  
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
  retryCount: number
  nextRetryAt: number | undefined
  circuitState: CircuitState | undefined
}

type Action<T, E extends Error> = 
  | { type: 'LOADING' }
  | { type: 'SUCCESS'; result: Result<T, E> }
  | { type: 'RETRY_SCHEDULED'; nextRetryAt: number; retryCount: number }
  | { type: 'CIRCUIT_STATE_CHANGED'; state: CircuitState }
  | { type: 'RESET' }

function reducer<T, E extends Error>(state: State<T, E>, action: Action<T, E>): State<T, E> {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true }
    case 'SUCCESS':
      return { 
        ...state, 
        result: action.result, 
        loading: false,
        nextRetryAt: undefined as number | undefined
      }
    case 'RETRY_SCHEDULED':
      return {
        ...state,
        nextRetryAt: action.nextRetryAt,
        retryCount: action.retryCount
      }
    case 'CIRCUIT_STATE_CHANGED':
      return {
        ...state,
        circuitState: action.state
      }
    case 'RESET':
      return { 
        result: undefined, 
        loading: false, 
        retryCount: 0,
        nextRetryAt: undefined as number | undefined,
        circuitState: undefined as CircuitState | undefined
      }
    default:
      return state
  }
}

/**
 * React hook for handling async operations with resilience policies.
 * 
 * @example
 * ```tsx
 * import { RetryPolicy, CircuitBreakerPolicy } from '@zerothrow/resilience'
 * 
 * const policy = RetryPolicy.exponential({ maxRetries: 3 })
 *   .chain(CircuitBreakerPolicy.create({ 
 *     failureThreshold: 5,
 *     resetTimeout: 30000 
 *   }))
 * 
 * const { result, loading, retryCount, nextRetryAt } = useResilientResult(
 *   async () => {
 *     const response = await fetch('/api/flaky-endpoint')
 *     if (!response.ok) throw new Error('Request failed')
 *     return response.json()
 *   },
 *   policy,
 *   { deps: [userId] }
 * )
 * 
 * if (loading) {
 *   return nextRetryAt 
 *     ? <div>Retrying in {timeUntil(nextRetryAt)}...</div>
 *     : <Spinner />
 * }
 * 
 * return result?.match({
 *   ok: data => <DataView {...data} />,
 *   err: error => <ErrorView error={error} retries={retryCount} />
 * }) ?? null
 * ```
 */
export function useResilientResult<T, E extends Error = Error>(
  fn: () => Promise<T>,
  policy: any, // TODO: Fix when resilience exports proper types
  options: UseResilientResultOptions = {}
): UseResilientResultReturn<T, E> {
  const { immediate = true, deps = [] } = options
  
  const [state, dispatch] = useReducer(reducer<T, E>, {
    result: undefined,
    loading: immediate,
    retryCount: 0,
    nextRetryAt: undefined,
    circuitState: undefined
  })
  
  const isMountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController>()
  const retryTimeoutRef = useRef<NodeJS.Timeout>()
  
  const execute = useCallback(async () => {
    // Cancel any in-flight request or scheduled retry
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = undefined
    }
    
    dispatch({ type: 'LOADING' })
    
    // Create a wrapped version that tracks retry metadata
    const wrappedPolicy = policy.onRetry((attempt: number, _error: unknown, delay: number) => {
      if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
        dispatch({ 
          type: 'RETRY_SCHEDULED', 
          nextRetryAt: Date.now() + delay,
          retryCount: attempt 
        })
      }
    })
    
    // If policy has circuit breaker, track its state
    if ('onCircuitStateChange' in wrappedPolicy) {
      (wrappedPolicy as any).onCircuitStateChange((state: CircuitState) => {
        if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          dispatch({ type: 'CIRCUIT_STATE_CHANGED', state })
        }
      })
    }
    
    try {
      const result = await wrappedPolicy.execute(fn)
      
      if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
        dispatch({ type: 'SUCCESS', result })
      }
    } catch (error) {
      // This should rarely happen with policies, but handle it gracefully
      if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
        const errorResult = ZT.err(
          error instanceof Error ? error : new Error(String(error))
        ) as Result<T, any>
        dispatch({ type: 'SUCCESS', result: errorResult })
      }
    }
  }, [fn, policy, ...deps])
  
  const reset = useCallback(() => {
    abortControllerRef.current?.abort()
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = undefined
    }
    dispatch({ type: 'RESET' })
  }, [])
  
  useEffect(() => {
    if (immediate) {
      execute()
    }
    
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [execute, immediate])
  
  return {
    result: state.result,
    loading: state.loading,
    retryCount: state.retryCount,
    nextRetryAt: state.nextRetryAt,
    circuitState: state.circuitState,
    reload: execute,
    reset,
  }
}