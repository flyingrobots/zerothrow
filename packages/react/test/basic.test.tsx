import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ZT } from '@zerothrow/core'
import { useResult } from '../src/hooks/useResult'

describe('useResult basic tests', () => {
  it('should handle successful results', async () => {
    const successFn = async () => ZT.ok('success')
    
    const { result } = renderHook(() => useResult(successFn))
    
    // Initial state should be loading
    expect(result.current.loading).toBe(true)
    expect(result.current.result).toBeUndefined()
    
    // Wait for the effect to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    // Should have successful result
    expect(result.current.result).toBeDefined()
    expect(result.current.result!.ok).toBe(true)
    expect(result.current.result!.value).toBe('success')
  })

  it('should handle error results', async () => {
    const errorFn = async () => ZT.err<string>(new Error('test error'))
    
    const { result } = renderHook(() => useResult(errorFn))
    
    // Wait for the effect to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    
    // Should have error result
    expect(result.current.result).toBeDefined()
    expect(result.current.result!.ok).toBe(false)
    expect((result.current.result as any).error.message).toBe('test error')
  })

  it('should allow manual execution', async () => {
    const successFn = async () => ZT.ok('manual')
    
    const { result } = renderHook(() => 
      useResult(successFn, { immediate: false })
    )
    
    // Should not be loading initially
    expect(result.current.loading).toBe(false)
    expect(result.current.result).toBeUndefined()
    
    // Manually execute
    await act(async () => {
      await result.current.reload()
    })
    
    // Should have result
    expect(result.current.result).toBeDefined()
    expect(result.current.result!.ok).toBe(true)
    expect(result.current.result!.value).toBe('manual')
  })
})