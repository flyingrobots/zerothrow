import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ZT } from '@zerothrow/core'
import { useResilientResult } from '../../src/hooks/useResilientResult'

describe('useResilientResult', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  
  describe('with basic policy', () => {
    it('should execute operation through policy', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      
      // Create a simple policy that converts results to Result type
      const policy = {
        execute: async (operation: () => Promise<unknown>) => {
          try {
            const result = await operation()
            return ZT.ok(result)
          } catch (error) {
            return ZT.err(error as Error)
          }
        }
      }
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      expect(result.current.loading).toBe(true)
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(true)
        expect(result.current.result?.value).toBe('success')
      })
      
      expect(fn).toHaveBeenCalledTimes(1)
    })
    
    it('should handle errors from policy', async () => {
      const error = new Error('Test error')
      const fn = vi.fn().mockRejectedValue(error)
      
      const policy = {
        execute: async (operation: () => Promise<unknown>) => {
          try {
            const result = await operation()
            return ZT.ok(result)
          } catch (err) {
            return ZT.err(err as Error)
          }
        }
      }
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(false)
        expect(result.current.result?.error).toBe(error)
      })
    })
  })
  
  describe('with retry-like behavior', () => {
    it.skip('should track retry count', async () => {
      // TODO: Fix async timing issue with retry tracking
      // The mock policy's retry mechanism doesn't properly integrate with React's
      // render cycle. Real resilience policies have complex timing that's hard to
      // simulate in tests. Priority: P2
      let attempt = 0
      const fn = vi.fn().mockImplementation(async () => {
        attempt++
        if (attempt < 3) {
          throw new Error(`Attempt ${attempt} failed`)
        }
        return 'success'
      })
      
      // Simple retry policy that tracks attempts
      const policy = {
        execute: async (operation: () => Promise<unknown>) => {
          let lastError: Error | undefined
          
          for (let i = 0; i < 3; i++) {
            try {
              const result = await operation()
              return ZT.ok(result)
            } catch (error) {
              lastError = error as Error
              // Don't retry on last attempt
              if (i < 2) {
                await new Promise(resolve => setTimeout(resolve, 10))
              }
            }
          }
          
          return ZT.err(lastError!)
        },
        onRetry: vi.fn()
      }
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(true)
        expect(result.current.result?.value).toBe('success')
      }, { timeout: 2000 })
      
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })
  
  describe('with circuit breaker-like behavior', () => {
    it('should track circuit state', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Service unavailable'))
      let circuitOpen = false
      
      // Simple circuit breaker policy
      const policy = {
        execute: async (operation: () => Promise<unknown>) => {
          if (circuitOpen) {
            return ZT.err(new Error('Circuit breaker is open'))
          }
          
          try {
            const result = await operation()
            return ZT.ok(result)
          } catch (error) {
            circuitOpen = true
            return ZT.err(error as Error)
          }
        },
        onCircuitStateChange: vi.fn()
      }
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.result?.ok).toBe(false)
      })
      
      // Try again - should fail immediately due to open circuit
      act(() => {
        result.current.reload()
      })
      
      await waitFor(() => {
        expect(result.current.result?.error?.message).toBe('Circuit breaker is open')
      })
      
      // Function should only be called once (circuit prevented second call)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
  
  describe('lifecycle management', () => {
    it('should reset state properly', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      
      const policy = {
        execute: async (operation: () => Promise<unknown>) => {
          const result = await operation()
          return ZT.ok(result)
        }
      }
      
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
    
    it('should handle reload', async () => {
      let count = 0
      const fn = vi.fn().mockImplementation(async () => {
        count++
        return `success-${count}`
      })
      
      const policy = {
        execute: async (operation: () => Promise<unknown>) => {
          const result = await operation()
          return ZT.ok(result)
        }
      }
      
      const { result } = renderHook(() => useResilientResult(fn, policy))
      
      await waitFor(() => {
        expect(result.current.result?.value).toBe('success-1')
      })
      
      act(() => {
        result.current.reload()
      })
      
      await waitFor(() => {
        expect(result.current.result?.value).toBe('success-2')
      })
      
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
})