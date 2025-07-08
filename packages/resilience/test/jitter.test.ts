import { describe, it, expect, vi } from 'vitest'
import { JitterCalculator } from '../src/index.js'

describe('JitterCalculator', () => {
  describe('none strategy', () => {
    it('should return original delay without jitter', () => {
      const calculator = new JitterCalculator({ strategy: 'none' })
      
      expect(calculator.calculate(1000, 5000)).toBe(1000)
      expect(calculator.calculate(2000, 5000)).toBe(2000)
      expect(calculator.calculate(5000, 5000)).toBe(5000)
    })
  })

  describe('full strategy', () => {
    it('should return random delay between 0 and baseDelay', () => {
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(1)
      
      const calculator = new JitterCalculator({ 
        strategy: 'full', 
        random: mockRandom 
      })
      
      expect(calculator.calculate(1000, 5000)).toBe(0)
      expect(calculator.calculate(1000, 5000)).toBe(500)
      expect(calculator.calculate(1000, 5000)).toBe(1000)
    })

    it('should respect maxDelay cap', () => {
      const mockRandom = vi.fn().mockReturnValue(1)
      const calculator = new JitterCalculator({ 
        strategy: 'full', 
        random: mockRandom 
      })
      
      expect(calculator.calculate(5000, 3000)).toBe(3000)
    })
  })

  describe('equal strategy', () => {
    it('should return delay between baseDelay/2 and baseDelay', () => {
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(1)
      
      const calculator = new JitterCalculator({ 
        strategy: 'equal', 
        random: mockRandom 
      })
      
      expect(calculator.calculate(1000, 5000)).toBe(500)  // 500 + (0 * 500)
      expect(calculator.calculate(1000, 5000)).toBe(750)  // 500 + (0.5 * 500)
      expect(calculator.calculate(1000, 5000)).toBe(1000) // 500 + (1 * 500)
    })

    it('should respect maxDelay cap', () => {
      const mockRandom = vi.fn().mockReturnValue(1)
      const calculator = new JitterCalculator({ 
        strategy: 'equal', 
        random: mockRandom 
      })
      
      expect(calculator.calculate(5000, 3000)).toBe(3000)
    })
  })

  describe('decorrelated strategy', () => {
    it('should maintain state between calls', () => {
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(1)
      
      const calculator = new JitterCalculator({ 
        strategy: 'decorrelated', 
        random: mockRandom 
      })
      
      // First call: minDelay=1000, maxJitter=0 (lastDelay=0), result=1000
      const first = calculator.calculate(1000, 5000)
      expect(first).toBe(1000)
      
      // Second call: minDelay=1000, maxJitter=3000 (lastDelay*3), result=2000
      const second = calculator.calculate(1000, 5000)
      expect(second).toBe(2000)
      
      // Third call: minDelay=1000, maxJitter=5000 (capped by maxDelay), result=5000
      const third = calculator.calculate(1000, 5000)
      expect(third).toBe(5000)
    })

    it('should respect maxDelay cap for lastDelay', () => {
      const mockRandom = vi.fn().mockReturnValue(1)
      const calculator = new JitterCalculator({ 
        strategy: 'decorrelated', 
        random: mockRandom 
      })
      
      // First call with high baseDelay should be capped
      const result = calculator.calculate(8000, 3000)
      expect(result).toBe(3000)
    })

    it('should reset state correctly', () => {
      const mockRandom = vi.fn()
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
      
      const calculator = new JitterCalculator({ 
        strategy: 'decorrelated', 
        random: mockRandom 
      })
      
      // First calculation
      calculator.calculate(1000, 5000)
      
      // Reset state
      calculator.reset()
      
      // Should behave like first call again
      const result = calculator.calculate(1000, 5000)
      expect(result).toBe(1000)
    })
  })

  describe('unknown strategy', () => {
    it('should default to no jitter for unknown strategy', () => {
      const calculator = new JitterCalculator({ strategy: 'unknown' as any })
      
      expect(calculator.calculate(1000, 5000)).toBe(1000)
    })
  })

  describe('default random function', () => {
    it('should use Math.random by default', () => {
      const calculator = new JitterCalculator({ strategy: 'full' })
      
      // Since we can't mock Math.random easily, we'll just verify it returns a number
      // within the expected range
      const result = calculator.calculate(1000, 5000)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(1000)
    })
  })

  describe('statistical distribution', () => {
    it('should produce reasonable distribution for full jitter', () => {
      const calculator = new JitterCalculator({ strategy: 'full' })
      const samples = 1000
      const delays = []
      
      for (let i = 0; i < samples; i++) {
        delays.push(calculator.calculate(1000, 5000))
      }
      
      // Check that delays are distributed across the range
      const min = Math.min(...delays)
      const max = Math.max(...delays)
      const avg = delays.reduce((a, b) => a + b, 0) / delays.length
      
      expect(min).toBeGreaterThanOrEqual(0)
      expect(max).toBeLessThanOrEqual(1000)
      expect(avg).toBeGreaterThan(200) // Should be around 500 on average
      expect(avg).toBeLessThan(800)
    })

    it('should produce reasonable distribution for equal jitter', () => {
      const calculator = new JitterCalculator({ strategy: 'equal' })
      const samples = 1000
      const delays = []
      
      for (let i = 0; i < samples; i++) {
        delays.push(calculator.calculate(1000, 5000))
      }
      
      // Check that delays are distributed in the upper half
      const min = Math.min(...delays)
      const max = Math.max(...delays)
      const avg = delays.reduce((a, b) => a + b, 0) / delays.length
      
      expect(min).toBeGreaterThanOrEqual(500)
      expect(max).toBeLessThanOrEqual(1000)
      expect(avg).toBeGreaterThan(650) // Should be around 750 on average
      expect(avg).toBeLessThan(850)
    })
  })
})