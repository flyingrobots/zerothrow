import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createContext } from 'react'
import { useResultContext, useResultContextNullable, createResultContext, ContextError } from '../src/hooks/useResultContext'

describe('useResultContext', () => {
  it('should return Ok result when context value is available', () => {
    const TestContext = createContext<string | undefined>('test-value')
    
    const { result } = renderHook(() => useResultContext(TestContext))
    
    expect(result.current.ok).toBe(true)
    expect(result.current.value).toBe('test-value')
  })
  
  it('should return Err result when context value is undefined', () => {
    const TestContext = createContext<string | undefined>(undefined)
    
    const { result } = renderHook(() => useResultContext(TestContext))
    
    expect(result.current.ok).toBe(false)
    const error = result.current.error as ContextError
    expect(error.code).toBe('CONTEXT_NOT_FOUND')
    expect(error.contextName).toBe('Unknown')
    expect(error.message).toContain('Unknown')
  })
  
  it('should return Err result when context value is null using nullable version', () => {
    const TestContext = createContext<string | null>(null)
    
    const { result } = renderHook(() => useResultContextNullable(TestContext))
    
    expect(result.current.ok).toBe(false)
    expect((result.current.error as ContextError).code).toBe('CONTEXT_NOT_FOUND')
  })
  
  it('should use custom context name in error', () => {
    const TestContext = createContext<string | undefined>(undefined)
    
    const { result } = renderHook(() => 
      useResultContext(TestContext, { contextName: 'Theme' })
    )
    
    expect(result.current.ok).toBe(false)
    const error = result.current.error as ContextError
    expect(error.code).toBe('CONTEXT_NOT_FOUND')
    expect(error.contextName).toBe('Theme')
    expect(error.message).toContain('Theme')
  })
  
  it('should use displayName from context if available', () => {
    const TestContext = createContext<string | undefined>(undefined)
    TestContext.displayName = 'TestDisplay'
    
    const { result } = renderHook(() => useResultContext(TestContext))
    
    expect(result.current.ok).toBe(false)
    const error = result.current.error as ContextError
    expect(error.code).toBe('CONTEXT_NOT_FOUND')
    expect(error.contextName).toBe('TestDisplay')
  })
  
  it('should work with Provider wrapper', () => {
    const TestContext = createContext<number | undefined>(undefined)
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestContext.Provider value={42}>
        {children}
      </TestContext.Provider>
    )
    
    const { result } = renderHook(() => useResultContext(TestContext), { wrapper })
    
    expect(result.current.ok).toBe(true)
    expect(result.current.value).toBe(42)
  })
})

describe('createResultContext', () => {
  it('should create a working context with Result-based hook', () => {
    const { Provider, useContext } = createResultContext<string>('TestContext')
    
    // Without provider
    const { result: withoutProvider } = renderHook(() => useContext())
    expect(!withoutProvider.current.ok).toBe(true)
    expect((withoutProvider.current.error as ContextError).contextName).toBe('TestContext')
    
    // With provider
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider value="hello">
        {children}
      </Provider>
    )
    
    const { result: withProvider } = renderHook(() => useContext(), { wrapper })
    expect(withProvider.current.ok).toBe(true)
    expect(withProvider.current.value).toBe('hello')
  })
  
  it('should set displayName on created context', () => {
    const { Context } = createResultContext<number>('MyContext')
    expect(Context.displayName).toBe('MyContext')
  })
})