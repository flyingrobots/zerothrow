export type JitterStrategy = 'none' | 'full' | 'equal' | 'decorrelated'

export interface JitterOptions {
  strategy: JitterStrategy
  random?: () => number
}

export class JitterCalculator {
  private lastDelay: number = 0
  private readonly random: () => number

  constructor(private readonly options: JitterOptions = { strategy: 'none' }) {
    this.random = options.random || (() => Math.random())
  }

  calculate(baseDelay: number, maxDelay: number): number {
    switch (this.options.strategy) {
      case 'none':
        return baseDelay
      
      case 'full':
        return this.calculateFullJitter(baseDelay, maxDelay)
      
      case 'equal':
        return this.calculateEqualJitter(baseDelay, maxDelay)
      
      case 'decorrelated':
        return this.calculateDecorrelatedJitter(baseDelay, maxDelay)
      
      default:
        return baseDelay
    }
  }

  private calculateFullJitter(baseDelay: number, maxDelay: number): number {
    const jitteredDelay = this.random() * baseDelay
    return Math.min(jitteredDelay, maxDelay)
  }

  private calculateEqualJitter(baseDelay: number, maxDelay: number): number {
    const half = baseDelay / 2
    const jitteredDelay = half + (this.random() * half)
    return Math.min(jitteredDelay, maxDelay)
  }

  private calculateDecorrelatedJitter(baseDelay: number, maxDelay: number): number {
    const minDelay = baseDelay
    const maxJitter = Math.min(maxDelay, Math.max(this.lastDelay * 3, baseDelay))
    const jitteredDelay = minDelay + (this.random() * (maxJitter - minDelay))
    this.lastDelay = Math.min(jitteredDelay, maxDelay)
    return this.lastDelay
  }

  reset(): void {
    this.lastDelay = 0
  }
}