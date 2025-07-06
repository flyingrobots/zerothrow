import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { Result, ZT } from '@zerothrow/core'
import { useResult } from '../../src/hooks/useResult'

describe('useResult', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  
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
      expect(result.current.result?.ok).toBe(true)
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
      expect(result.current.result?.ok).toBe(false)
      expect(result.current.result?.error).toBe(error)
    })
  })
  
  it('should convert thrown errors to Result.err', async () => {
    const error = new Error('Thrown error')
    const fn = vi.fn().mockRejectedValue(error)
    
    const { result } = renderHook(() => useResult(fn))
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.result?.ok).toBe(false)
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
  
  it('should re-execute when dependencies change', async () => {
    const fn = vi.fn().mockImplementation(async (id: number) => ZT.ok(`user-${id}`))
    let userId = 1
    
    const { result, rerender } = renderHook(
      () => useResult(() => fn(userId), { deps: [userId] }),
      { initialProps: { userId } }
    )
    
    await waitFor(() => {
      expect(result.current.result?.value).toBe('user-1')
    })
    
    userId = 2
    rerender({ userId })
    
    await waitFor(() => {
      expect(result.current.result?.value).toBe('user-2')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
  
  it('should cancel in-flight requests when component unmounts', async () => {
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