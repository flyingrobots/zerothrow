import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultBoundary } from '../../src/components/ResultBoundary'
import { Result } from '@zerothrow/core'

// Component that throws
function ThrowingComponent({ error }: { error: Error }) {
  throw error
}

// Component that renders normally
function NormalComponent() {
  return <div>Normal content</div>
}

describe('ResultBoundary', () => {
  it('should render children when no error occurs', () => {
    const onError = vi.fn()
    
    render(
      <ResultBoundary
        fallback={(result, reset) => <div>Error: {result.error.message}</div>}
        onError={onError}
      >
        <NormalComponent />
      </ResultBoundary>
    )
    
    expect(screen.getByText('Normal content')).toBeInTheDocument()
    expect(onError).not.toHaveBeenCalled()
  })
  
  it('should catch errors and render fallback with Result', () => {
    const error = new Error('Test error')
    const onError = vi.fn()
    
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <ResultBoundary
        fallback={(result, reset) => {
          expect(result.ok).toBe(false)
          expect(result.error).toBe(error)
          return <div>Error: {result.error.message}</div>
        }}
        onError={onError}
      >
        <ThrowingComponent error={error} />
      </ResultBoundary>
    )
    
    expect(screen.getByText('Error: Test error')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith(error, expect.any(Object))
    
    consoleSpy.mockRestore()
  })
  
  it('should provide working reset function to fallback', () => {
    const error = new Error('Resettable error')
    let shouldThrow = true
    
    function ConditionalThrow() {
      if (shouldThrow) {
        throw error
      }
      return <div>Recovered content</div>
    }
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const { rerender } = render(
      <ResultBoundary
        fallback={(result, reset) => (
          <div>
            <div>Error occurred</div>
            <button onClick={() => {
              shouldThrow = false
              reset()
            }}>Reset</button>
          </div>
        )}
      >
        <ConditionalThrow />
      </ResultBoundary>
    )
    
    expect(screen.getByText('Error occurred')).toBeInTheDocument()
    
    // Click reset
    screen.getByText('Reset').click()
    
    // Force re-render
    rerender(
      <ResultBoundary
        fallback={(result, reset) => (
          <div>
            <div>Error occurred</div>
            <button onClick={reset}>Reset</button>
          </div>
        )}
      >
        <ConditionalThrow />
      </ResultBoundary>
    )
    
    expect(screen.getByText('Recovered content')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })
  
  it('should handle errors without onError callback', () => {
    const error = new Error('No callback error')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(
        <ResultBoundary
          fallback={(result, reset) => <div>Fallback UI</div>}
        >
          <ThrowingComponent error={error} />
        </ResultBoundary>
      )
    }).not.toThrow()
    
    expect(screen.getByText('Fallback UI')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })
  
  it('should handle multiple sequential errors', () => {
    const error1 = new Error('First error')
    const error2 = new Error('Second error')
    let currentError = error1
    
    function DynamicThrow() {
      throw currentError
    }
    
    const onError = vi.fn()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    const { rerender } = render(
      <ResultBoundary
        fallback={(result, reset) => <div>Error: {result.error.message}</div>}
        onError={onError}
      >
        <DynamicThrow />
      </ResultBoundary>
    )
    
    expect(screen.getByText('Error: First error')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(error1, expect.any(Object))
    
    // Change error and re-render
    currentError = error2
    rerender(
      <ResultBoundary
        fallback={(result, reset) => <div>Error: {result.error.message}</div>}
        onError={onError}
      >
        <DynamicThrow />
      </ResultBoundary>
    )
    
    expect(screen.getByText('Error: Second error')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenLastCalledWith(error2, expect.any(Object))
    
    consoleSpy.mockRestore()
  })
  
  it('should preserve error info for telemetry', () => {
    const error = new Error('Telemetry test')
    const errorInfo = { componentStack: '' }
    const onError = vi.fn()
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(
      <ResultBoundary
        fallback={(result, reset) => <div>Error boundary triggered</div>}
        onError={onError}
      >
        <ThrowingComponent error={error} />
      </ResultBoundary>
    )
    
    expect(onError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
    
    consoleSpy.mockRestore()
  })
})