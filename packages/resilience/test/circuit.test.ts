import { describe, it, expect, vi } from 'vitest'
import { CircuitBreakerPolicy, CircuitOpenError, TestClock } from '../src/index.js'

describe('CircuitBreakerPolicy', () => {
  it('should allow successful operations through', async () => {
    const policy = new CircuitBreakerPolicy({ threshold: 3, duration: 1000 })
    const operation = vi.fn().mockResolvedValue('success')
    
    const result = await policy.execute(operation)
    
    expect(result.ok).toBe(true)
    expect(result.value).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('should open circuit after threshold failures', async () => {
    const onOpen = vi.fn()
    const policy = new CircuitBreakerPolicy({ 
      threshold: 2, 
      duration: 1000,
      onOpen 
    })
    
    const operation = vi.fn().mockRejectedValue(new Error('fail'))
    
    // First two failures count towards threshold
    await policy.execute(operation)
    const result2 = await policy.execute(operation)
    
    expect(result2.ok).toBe(false)
    expect(result2.error).toBeInstanceOf(CircuitOpenError)
    expect(onOpen).toHaveBeenCalledOnce()
    expect(operation).toHaveBeenCalledTimes(2)
    
    // Circuit is open, operation should not be called
    const result3 = await policy.execute(operation)
    expect(result3.ok).toBe(false)
    expect(result3.error).toBeInstanceOf(CircuitOpenError)
    expect(operation).toHaveBeenCalledTimes(2) // Still 2
  })

  it('should transition to half-open after duration', async () => {
    const clock = new TestClock()
    const onClose = vi.fn()
    const policy = new CircuitBreakerPolicy({ 
      threshold: 1, 
      duration: 1000,
      onClose 
    }, clock)
    
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')
    
    // Open the circuit
    await policy.execute(operation)
    
    // Try immediately - should be rejected
    const result2 = await policy.execute(operation)
    expect(result2.ok).toBe(false)
    expect(result2.error).toBeInstanceOf(CircuitOpenError)
    
    // Advance time past duration
    clock.advance(1001)
    
    // Should transition to half-open and try operation
    const result3 = await policy.execute(operation)
    expect(result3.ok).toBe(true)
    expect(result3.value).toBe('success')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('should reopen circuit if half-open test fails', async () => {
    const clock = new TestClock()
    const policy = new CircuitBreakerPolicy({ 
      threshold: 1, 
      duration: 1000 
    }, clock)
    
    const operation = vi.fn().mockRejectedValue(new Error('always fails'))
    
    // Open the circuit
    await policy.execute(operation)
    
    // Advance time to half-open
    clock.advance(1001)
    
    // Try in half-open state - should fail and reopen
    const result = await policy.execute(operation)
    expect(result.ok).toBe(false)
    expect(result.error).toBeInstanceOf(CircuitOpenError)
    
    // Circuit should be open again
    const result2 = await policy.execute(operation)
    expect(result2.ok).toBe(false)
    expect(result2.error).toBeInstanceOf(CircuitOpenError)
    expect(operation).toHaveBeenCalledTimes(2) // Only tried twice
  })
})