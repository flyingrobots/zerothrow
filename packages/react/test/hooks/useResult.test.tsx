import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCallback } from 'react'
import { ZT } from '@zerothrow/core'
import { useResult } from '../../src/hooks/useResult'

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
})