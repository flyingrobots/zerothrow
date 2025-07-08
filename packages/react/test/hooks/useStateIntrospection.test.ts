/**
 * @file Tests for useStateIntrospection hook
 */

import { renderHook, act } from '@testing-library/react'
import { ZT } from '@zerothrow/core'
import type { Result } from '@zerothrow/core'
import { useStateIntrospection } from '../useStateIntrospection.js'
import type { LoadingState } from '../../types/loading.js'

describe('useStateIntrospection', () => {
  beforeEach(() => {
    // Reset global DevTools registry
    if (typeof window !== 'undefined') {
      delete (window as any).__ZEROTHROW_DEVTOOLS__
    }
  })

  it('should initialize with default values', () => {
    const { result } = renderHook(() =>
      useStateIntrospection(null, { type: 'idle' })
    )

    expect(result.current.introspection.current).toBeNull()
    expect(result.current.introspection.loading.type).toBe('idle')
    expect(result.current.introspection.history).toHaveLength(0)
    expect(result.current.introspection.metrics.totalRequests).toBe(0)
    expect(result.current.introspection.debug.hookName).toBe('useStateIntrospection')
  })

  it('should track state history when results change', () => {
    const successResult = ZT.ok('test data')
    const { result, rerender } = renderHook(
      ({ resultValue, loadingState }) =>
        useStateIntrospection(resultValue, loadingState),
      {
        initialProps: {
          resultValue: null as Result<string, Error> | null,
          loadingState: { type: 'idle' } as LoadingState
        }
      }
    )

    expect(result.current.introspection.history).toHaveLength(0)

    // Simulate successful result
    act(() => {
      rerender({
        resultValue: successResult,
        loadingState: {
          type: 'success',
          completedAt: Date.now(),
          duration: 500
        }
      })
    })

    expect(result.current.introspection.history).toHaveLength(1)
    expect(result.current.introspection.history[0].state).toBe(successResult)
    expect(result.current.introspection.history[0].trigger).toBe('manual')
    expect(result.current.introspection.metrics.totalRequests).toBe(1)
    expect(result.current.introspection.metrics.successCount).toBe(1)
  })

  it('should calculate metrics correctly', () => {
    const successResult = ZT.ok('success')
    const errorResult = ZT.err(new Error('test error'))
    
    const { result, rerender } = renderHook(
      ({ resultValue, loadingState }) =>
        useStateIntrospection(resultValue, loadingState),
      {
        initialProps: {
          resultValue: null as Result<string, Error> | null,
          loadingState: { type: 'idle' } as LoadingState
        }
      }
    )

    // Add successful result
    act(() => {
      rerender({
        resultValue: successResult,
        loadingState: {
          type: 'success',
          completedAt: Date.now(),
          duration: 100
        }
      })
    })

    // Add error result
    act(() => {
      rerender({
        resultValue: errorResult,
        loadingState: {
          type: 'error',
          failedAt: Date.now(),
          error: new Error('test error'),
          canRetry: true,
          duration: 200
        }
      })
    })

    const metrics = result.current.introspection.metrics
    expect(metrics.totalRequests).toBe(2)
    expect(metrics.successCount).toBe(1)
    expect(metrics.errorCount).toBe(1)
    expect(metrics.successRate).toBe(0.5)
    expect(metrics.averageDuration).toBe(150)
    expect(metrics.lastError).toBeDefined()
    expect(metrics.lastError?.error).toBeInstanceOf(Error)
  })

  it('should respect history limit', () => {
    const { result, rerender } = renderHook(() =>
      useStateIntrospection(null, { type: 'idle' }, { historyLimit: 2 })
    )

    // Add 3 results (exceeds limit of 2)
    for (let i = 0; i < 3; i++) {
      act(() => {
        rerender()
      })
      
      const testResult = ZT.ok(`data ${i}`)
      act(() => {
        useStateIntrospection(testResult, {
          type: 'success',
          completedAt: Date.now(),
          duration: 100
        }, { historyLimit: 2 })
      })
    }

    // Should only keep the last 2 entries
    expect(result.current.introspection.history.length).toBeLessThanOrEqual(2)
  })

  it('should clear history when requested', () => {
    const testResult = ZT.ok('test')
    const { result, rerender } = renderHook(
      ({ resultValue, loadingState }) =>
        useStateIntrospection(resultValue, loadingState),
      {
        initialProps: {
          resultValue: null as Result<string, Error> | null,
          loadingState: { type: 'idle' } as LoadingState
        }
      }
    )

    // Add a result
    act(() => {
      rerender({
        resultValue: testResult,
        loadingState: {
          type: 'success',
          completedAt: Date.now(),
          duration: 100
        }
      })
    })

    expect(result.current.introspection.history).toHaveLength(1)

    // Clear history
    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.introspection.history).toHaveLength(0)
    expect(result.current.introspection.metrics.totalRequests).toBe(0)
  })

  it('should export state as JSON', () => {
    const testResult = ZT.ok('test data')
    const { result, rerender } = renderHook(
      ({ resultValue, loadingState }) =>
        useStateIntrospection(resultValue, loadingState, { name: 'TestHook' }),
      {
        initialProps: {
          resultValue: null as Result<string, Error> | null,
          loadingState: { type: 'idle' } as LoadingState
        }
      }
    )

    // Add a result
    act(() => {
      rerender({
        resultValue: testResult,
        loadingState: {
          type: 'success',
          completedAt: Date.now(),
          duration: 100
        }
      })
    })

    const exported = result.current.exportState()
    const parsed = JSON.parse(exported)

    expect(parsed.introspection).toBeDefined()
    expect(parsed.introspection.debug.componentName).toBe('TestHook')
    expect(parsed.exportedAt).toBeTypeOf('number')
    expect(parsed.version).toBe('1.0.0')
  })

  it('should determine trigger types correctly', () => {
    const { result, rerender } = renderHook(
      ({ resultValue, loadingState }) =>
        useStateIntrospection(resultValue, loadingState),
      {
        initialProps: {
          resultValue: null as Result<string, Error> | null,
          loadingState: { type: 'idle' } as LoadingState
        }
      }
    )

    // Test initial load
    act(() => {
      rerender({
        resultValue: ZT.ok('initial'),
        loadingState: {
          type: 'success',
          completedAt: Date.now(),
          duration: 100
        }
      })
    })

    expect(result.current.introspection.history[0].trigger).toBe('manual')

    // Test refresh
    act(() => {
      rerender({
        resultValue: ZT.ok('refreshed'),
        loadingState: {
          type: 'success',
          completedAt: Date.now(),
          duration: 150
        }
      })
    })

    expect(result.current.introspection.history[1].trigger).toBe('manual')
  })

  it('should register with DevTools in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const mockRegister = vi.fn()
    const mockUnregister = vi.fn()

    // Mock global DevTools
    ;(global as any).window = {
      __ZEROTHROW_DEVTOOLS__: {
        register: mockRegister,
        unregister: mockUnregister
      }
    }

    const { unmount } = renderHook(() =>
      useStateIntrospection(null, { type: 'idle' }, { 
        name: 'TestHook',
        enableDevTools: true 
      })
    )

    expect(mockRegister).toHaveBeenCalledWith('TestHook', expect.any(Object))

    unmount()

    expect(mockUnregister).toHaveBeenCalledWith('TestHook')

    // Restore
    process.env.NODE_ENV = originalEnv
    delete (global as any).window
  })

  it('should track render count', () => {
    const { result, rerender } = renderHook(() =>
      useStateIntrospection(null, { type: 'idle' }, { name: 'TestHook' })
    )

    const initialRenderCount = result.current.introspection.debug.renderCount

    rerender()
    rerender()

    expect(result.current.introspection.debug.renderCount).toBeGreaterThan(initialRenderCount)
  })

  it('should provide time travel functionality in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { result } = renderHook(() =>
      useStateIntrospection(null, { type: 'idle' }, { 
        enableDevTools: true 
      })
    )

    // Should not error and should log in development
    act(() => {
      result.current.timeTravel(0)
    })

    // Restore
    process.env.NODE_ENV = originalEnv
    consoleSpy.mockRestore()
  })

  it('should warn about time travel in production', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const { result } = renderHook(() =>
      useStateIntrospection(null, { type: 'idle' }, { 
        enableDevTools: false 
      })
    )

    // Should be a no-op function in production
    act(() => {
      result.current.timeTravel(0)
    })

    // Restore
    process.env.NODE_ENV = originalEnv
  })
})