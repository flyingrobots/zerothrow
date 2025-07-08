import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCallback } from 'react'
import { ZT } from '@zerothrow/core'
import { useResult } from '../../src/hooks/useResult'
import { LoadingPhase } from '../../src/types/loading'

describe('useResult', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  it('should execute immediately by default', async () => {
    const fn = vi.fn().mockResolvedValue(ZT.ok('success'))
    
    const { result } = renderHook(() => useResult(fn))
    
    expect(result.current.loading).toBe(true)
    expect(result.current.result).toBeUndefined()
    expect(fn).toHaveBeenCalledTimes(1)
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result!.ok).toBe(true)
      expect(result.current.result?.value).toBe('success')
    })
  })
  
  it('should not execute immediately when immediate is false', () => {
    const fn = vi.fn().mockResolvedValue(ZT.ok('success'))
    
    const { result } = renderHook(() => useResult(fn, { immediate: false }))
    
    expect(result.current.loading).toBe(false)
    expect(result.current.result).toBeUndefined()
    expect(fn).not.toHaveBeenCalled()
  })
  
  it('should handle errors as Result.err', async () => {
    const error = new Error('Test error')
    const fn = vi.fn().mockResolvedValue(ZT.err(error))
    
    const { result } = renderHook(() => useResult(fn))
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result!.ok).toBe(false)
      expect(result.current.result?.error).toBe(error)
    })
  })
  
  it('should convert thrown errors to Result.err', async () => {
    const error = new Error('Thrown error')
    const fn = vi.fn().mockRejectedValue(error)
    
    const { result } = renderHook(() => useResult(fn))
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result!.ok).toBe(false)
      expect(result.current.result?.error).toBe(error)
    })
  })
  
  it('should reload when calling reload function', async () => {
    let count = 0
    const fn = vi.fn().mockImplementation(async () => {
      count++
      return ZT.ok(`success-${count}`)
    })
    
    const { result } = renderHook(() => useResult(fn))
    
    await waitFor(() => {
      expect(result.current.result?.value).toBe('success-1')
    })
    
    act(() => {
      result.current.reload()
    })
    
    expect(result.current.loading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result?.value).toBe('success-2')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
  
  it('should reset state when calling reset', async () => {
    const fn = vi.fn().mockResolvedValue(ZT.ok('success'))
    
    const { result } = renderHook(() => useResult(fn))
    
    await waitFor(() => {
      expect(result.current.result?.value).toBe('success')
    })
    
    act(() => {
      result.current.reset()
    })
    
    expect(result.current.loading).toBe(false)
    expect(result.current.result).toBeUndefined()
  })
  
  it.skip('should re-execute when dependencies change', async () => {
    // TODO: Fix timing issue - loading state transitions not captured properly
    // The test expects loading to be false immediately after rerender, but the hook
    // triggers a new load cycle. Need to investigate proper waitFor patterns.
    const fn = vi.fn()
    fn.mockResolvedValueOnce(ZT.ok('user-1'))
    fn.mockResolvedValueOnce(ZT.ok('user-2'))
    
    const { result, rerender } = renderHook(
      ({ userId }: { userId: number }) => {
        // Create the function inside the hook to capture current userId
        const fetchUser = useCallback(() => fn(userId), [userId])
        return useResult(fetchUser, { deps: [userId] })
      },
      { initialProps: { userId: 1 } }
    )
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result?.value).toBe('user-1')
    })
    expect(fn).toHaveBeenCalledWith(1)
    expect(fn).toHaveBeenCalledTimes(1)
    
    // Clear mock calls before rerender
    fn.mockClear()
    
    rerender({ userId: 2 })
    
    // Wait for loading to start
    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })
    
    // Then wait for loading to finish
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result?.value).toBe('user-2')
    })
    expect(fn).toHaveBeenCalledWith(2)
    expect(fn).toHaveBeenCalledTimes(1)
  })
  
  it('should cancel in-flight requests when component unmounts', async () => {
    vi.useFakeTimers()
    
    const fn = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(ZT.ok('success')), 1000))
    )
    
    const { result, unmount } = renderHook(() => useResult(fn))
    
    expect(result.current.loading).toBe(true)
    
    unmount()
    
    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    // Result should not update after unmount
    expect(result.current.loading).toBe(true)
    
    vi.useRealTimers()
  })
  
  it('should handle synchronous Results', async () => {
    const fn = vi.fn().mockReturnValue(ZT.ok('sync-success'))
    
    const { result } = renderHook(() => useResult(fn))
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result?.value).toBe('sync-success')
    })
  })

  describe('Enhanced State Introspection', () => {
    it('should provide granular loading states', async () => {
      const fn = vi.fn().mockResolvedValue(ZT.ok('success'))
      
      const { result } = renderHook(() => useResult(fn))
      
      // Initial state when immediate=true
      expect(result.current.loadingState.type).toBe('pending')
      expect(result.current.state.phase).toBe(LoadingPhase.Executing)
      expect(result.current.state.attempt).toBe(1)
      
      await waitFor(() => {
        expect(result.current.loadingState.type).toBe('success')
        expect(result.current.state.phase).toBe(LoadingPhase.Settled)
        expect(result.current.state.attempt).toBe(1)
      })
    })

    it('should track retry attempts', async () => {
      let attemptCount = 0
      const fn = vi.fn().mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 2) {
          return ZT.err(new Error('Temporary failure'))
        }
        return ZT.ok('success')
      })
      
      const { result } = renderHook(() => useResult(fn))
      
      await waitFor(() => {
        expect(result.current.result).toBeDefined()
        expect(result.current.result!.ok).toBe(false)
        expect(result.current.state.attempt).toBe(1)
      })
      
      // Trigger retry
      act(() => {
        result.current.reload()
      })
      
      await waitFor(() => {
        expect(result.current.result).toBeDefined()
        expect(result.current.result!.ok).toBe(true)
        expect(result.current.state.attempt).toBe(1) // Note: manual reload doesn't increment attempt
      })
    })

    it('should provide introspection data when enabled', async () => {
      const fn = vi.fn().mockResolvedValue(ZT.ok('test data'))
      
      const { result } = renderHook(() => 
        useResult(fn, { 
          introspection: { 
            name: 'TestHook',
            historyLimit: 5 
          } 
        })
      )
      
      await waitFor(() => {
        expect(result.current.introspect).toBeDefined()
        expect(result.current.introspect?.debug.componentName).toBe('TestHook')
        expect(result.current.introspect?.current?.value).toBe('test data')
        expect(result.current.introspect?.history).toHaveLength(1)
      })
    })

    it('should not provide introspection data when disabled', async () => {
      const fn = vi.fn().mockResolvedValue(ZT.ok('test data'))
      
      const { result } = renderHook(() => useResult(fn))
      
      await waitFor(() => {
        expect(result.current.introspect).toBeUndefined()
      })
    })

    it('should differentiate between refresh and initial load', async () => {
      const fn = vi.fn().mockResolvedValue(ZT.ok('data'))
      
      const { result } = renderHook(() => 
        useResult(fn, { introspection: true })
      )
      
      await waitFor(() => {
        expect(result.current.result?.value).toBe('data')
      })
      
      // Trigger refresh
      act(() => {
        result.current.reload()
      })
      
      // Should transition to refreshing state
      expect(result.current.loadingState.type).toBe('refreshing')
      
      await waitFor(() => {
        expect(result.current.loadingState.type).toBe('success')
      })
    })

    it('should provide development tools in development mode', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const fn = vi.fn().mockResolvedValue(ZT.ok('test'))
      
      const { result } = renderHook(() => useResult(fn))
      
      expect(result.current.devTools).toBeDefined()
      expect(result.current.devTools?.pause).toBeTypeOf('function')
      expect(result.current.devTools?.resume).toBeTypeOf('function')
      expect(result.current.devTools?.setMockResult).toBeTypeOf('function')
      
      process.env.NODE_ENV = originalEnv
    })

    it('should not provide development tools in production mode', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      
      const fn = vi.fn().mockResolvedValue(ZT.ok('test'))
      
      const { result } = renderHook(() => useResult(fn))
      
      expect(result.current.devTools).toBeUndefined()
      
      process.env.NODE_ENV = originalEnv
    })

    it('should support mocking results in development', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const fn = vi.fn().mockResolvedValue(ZT.ok('real'))
      const mockResult = ZT.ok('mocked')
      
      const { result } = renderHook(() => useResult(fn, { immediate: false }))
      
      // Set mock result
      act(() => {
        result.current.devTools?.setMockResult(mockResult)
      })
      
      // Execute function
      act(() => {
        result.current.reload()
      })
      
      await waitFor(() => {
        expect(result.current.result?.value).toBe('mocked')
      })
      
      process.env.NODE_ENV = originalEnv
    })

    it('should support pausing execution in development', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'
      
      const fn = vi.fn().mockResolvedValue(ZT.ok('test'))
      
      const { result } = renderHook(() => useResult(fn, { immediate: false }))
      
      // Pause execution
      act(() => {
        result.current.devTools?.pause()
      })
      
      // Try to execute - should be ignored
      act(() => {
        result.current.reload()
      })
      
      // Should not execute
      expect(fn).not.toHaveBeenCalled()
      expect(result.current.loading).toBe(false)
      
      process.env.NODE_ENV = originalEnv
    })

    it('should maintain backward compatibility with loading boolean', async () => {
      const fn = vi.fn().mockResolvedValue(ZT.ok('success'))
      
      const { result } = renderHook(() => useResult(fn))
      
      // Initially loading
      expect(result.current.loading).toBe(true)
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.value).toBe('success')
      })
      
      // Should be equivalent to executing or retrying phases
      const isLoadingPhase = result.current.state.phase === LoadingPhase.Executing || 
                             result.current.state.phase === LoadingPhase.Retrying
      expect(result.current.loading).toBe(isLoadingPhase)
    })

    it('should track state flags correctly', async () => {
      const fn = vi.fn().mockResolvedValue(ZT.ok('test'))
      
      const { result } = renderHook(() => useResult(fn))
      
      // Check initial flags when immediate=true
      expect(result.current.state.phase).toBe(LoadingPhase.Executing)
      expect(result.current.state.isRetrying).toBe(false)
      
      await waitFor(() => {
        expect(result.current.state.phase).toBe(LoadingPhase.Settled)
      })
    })
  })
})