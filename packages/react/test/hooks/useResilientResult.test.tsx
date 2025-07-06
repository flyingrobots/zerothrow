import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ZT } from '@zerothrow/core'
import { RetryPolicy, CircuitBreakerPolicy, TimeoutPolicy } from '@zerothrow/resilience'
import { useResilientResult } from '../../src/hooks/useResilientResult'

describe('useResilientResult', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  describe('with RetryPolicy', () => {
    it('should retry on failure with exponential backoff', async () => {
      let attempt = 0
      const fn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt < 3) {
          throw new Error(`Attempt ${attempt} failed`)
        }
        return 'success'
      })
      
      const policy = RetryPolicy.exponential({ maxRetries: 3 })
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      expect(result.current.loading).toBe(true)
      expect(result.current.retryCount).toBe(0)
      
      // First attempt fails
      await waitFor(() => {
        expect(fn).toHaveBeenCalledTimes(1)
      })
      
      // Should schedule retry
      expect(result.current.nextRetryAt).toBeDefined()
      expect(result.current.retryCount).toBe(1)
      
      // Fast forward to retry
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      
      // Second attempt fails
      await waitFor(() => {
        expect(fn).toHaveBeenCalledTimes(2)
        expect(result.current.retryCount).toBe(2)
      })
      
      // Fast forward to final retry
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      
      // Third attempt succeeds
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(true)
        expect(result.current.result?.value).toBe('success')
        expect(result.current.nextRetryAt).toBeUndefined()
      })
    })
    
    it('should stop retrying after max attempts', async () => {
      const error = new Error('Persistent failure')
      const fn = vi.fn().mockRejectedValue(error)
      
      const policy = RetryPolicy.fixed({ 
        maxRetries: 2, 
        delay: 100 
      })
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      // Initial attempt
      await waitFor(() => {
        expect(fn).toHaveBeenCalledTimes(1)
      })
      
      // First retry
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(fn).toHaveBeenCalledTimes(2)
      })
      
      // Second retry
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(fn).toHaveBeenCalledTimes(3)
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(false)
        expect(result.current.result?.error).toBe(error)
        expect(result.current.retryCount).toBe(2)
      })
    })
  })
  
  describe('with CircuitBreakerPolicy', () => {
    it('should open circuit after failure threshold', async () => {
      const error = new Error('Service unavailable')
      const fn = vi.fn().mockRejectedValue(error)
      
      const policy = CircuitBreakerPolicy.create({
        failureThreshold: 3,
        resetTimeout: 5000
      })
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })
        
        act(() => {
          result.current.reload()
        })
        
        await waitFor(() => {
          expect(fn).toHaveBeenCalledTimes(i + 1)
        })
      }
      
      expect(result.current.circuitState).toBe('open')
      
      // Circuit is open, calls should fail immediately
      act(() => {
        result.current.reload()
      })
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(false)
        expect(fn).toHaveBeenCalledTimes(3) // No new calls
      })
    })
    
    it('should transition to half-open after reset timeout', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockResolvedValue('success')
      
      const policy = CircuitBreakerPolicy.create({
        failureThreshold: 3,
        resetTimeout: 1000
      })
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await waitFor(() => {
          expect(result.current.loading).toBe(false)
        })
        
        if (i < 2) {
          act(() => {
            result.current.reload()
          })
        }
      }
      
      expect(result.current.circuitState).toBe('open')
      
      // Wait for reset timeout
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      
      // Circuit should allow one test call
      act(() => {
        result.current.reload()
      })
      
      await waitFor(() => {
        expect(result.current.circuitState).toBe('closed')
        expect(result.current.result?.ok).toBe(true)
        expect(result.current.result?.value).toBe('success')
      })
    })
  })
  
  describe('with TimeoutPolicy', () => {
    it('should timeout long-running operations', async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 2000))
      )
      
      const policy = TimeoutPolicy.create({ timeout: 1000 })
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      expect(result.current.loading).toBe(true)
      
      // Fast forward past timeout
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(false)
        expect(result.current.result?.error?.message).toContain('timeout')
      })
    })
  })
  
  describe('with chained policies', () => {
    it('should apply policies in order', async () => {
      let attempt = 0
      const fn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt === 1) {
          // First call times out
          return new Promise(resolve => setTimeout(() => resolve('never'), 2000))
        } else {
          // Retry succeeds
          return 'success'
        }
      })
      
      const policy = TimeoutPolicy.create({ timeout: 500 })
        .chain(RetryPolicy.fixed({ maxRetries: 1, delay: 100 }))
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      // First attempt should timeout
      act(() => {
        vi.advanceTimersByTime(500)
      })
      
      await waitFor(() => {
        expect(result.current.retryCount).toBe(1)
      })
      
      // Retry should succeed
      act(() => {
        vi.advanceTimersByTime(100)
      })
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(true)
        expect(result.current.result?.value).toBe('success')
      })
    })
  })
  
  describe('lifecycle management', () => {
    it('should cancel retries on unmount', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Fail'))
      const policy = RetryPolicy.fixed({ maxRetries: 5, delay: 1000 })
      
      const { result, unmount } = renderHook(() => useResilientResult(fn, policy))
      
      await waitFor(() => {
        expect(result.current.retryCount).toBe(1)
      })
      
      unmount()
      
      // Fast forward - no more retries should occur
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      
      expect(fn).toHaveBeenCalledTimes(1)
    })
    
    it('should reset state properly', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const policy = RetryPolicy.fixed({ maxRetries: 3 })
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      await waitFor(() => {
        expect(result.current.result?.value).toBe('success')
      })
      
      act(() => {
        result.current.reset()
      })
      
      expect(result.current.loading).toBe(false)
      expect(result.current.result).toBeUndefined()
      expect(result.current.retryCount).toBe(0)
      expect(result.current.nextRetryAt).toBeUndefined()
    })
  })
})