/**
 * @file Extensible edge system for semantic state transitions
 */

/**
 * Base edge class that can be extended with custom semantics
 */
export abstract class EdgeBase<TState extends number, TEvent extends number, TContext = any> {
  constructor(
    public readonly from: TState,
    public readonly to: TState,
    public readonly event: TEvent
  ) {}
  
  /**
   * Check if this edge can be traversed given the context
   */
  abstract canTraverse(context: TContext): boolean
  
  /**
   * Execute any side effects when traversing this edge
   * Return the updated context
   */
  onTraverse(context: TContext): TContext {
    return context
  }
  
  /**
   * Get edge metadata for visualization/debugging
   */
  getMetadata(): Record<string, any> {
    return {
      type: this.constructor.name,
      from: this.from,
      to: this.to,
      event: this.event
    }
  }
  
  /**
   * Clone this edge (useful for edge factories)
   */
  abstract clone(): EdgeBase<TState, TEvent, TContext>
}

/**
 * Simple edge with optional guard function
 */
export class SimpleEdge<TState extends number, TEvent extends number, TContext = any> 
  extends EdgeBase<TState, TEvent, TContext> {
  
  constructor(
    from: TState,
    to: TState,
    event: TEvent,
    private guard?: (context: TContext) => boolean
  ) {
    super(from, to, event)
  }
  
  canTraverse(context: TContext): boolean {
    return !this.guard || this.guard(context)
  }
  
  clone(): SimpleEdge<TState, TEvent, TContext> {
    return new SimpleEdge(this.from, this.to, this.event, this.guard)
  }
}

/**
 * Edge that updates context during traversal
 */
export class ContextEdge<TState extends number, TEvent extends number, TContext = any> 
  extends EdgeBase<TState, TEvent, TContext> {
  
  constructor(
    from: TState,
    to: TState,
    event: TEvent,
    private guard?: (context: TContext) => boolean,
    private action?: (context: TContext) => TContext
  ) {
    super(from, to, event)
  }
  
  canTraverse(context: TContext): boolean {
    return !this.guard || this.guard(context)
  }
  
  onTraverse(context: TContext): TContext {
    return this.action ? this.action(context) : context
  }
  
  clone(): ContextEdge<TState, TEvent, TContext> {
    return new ContextEdge(this.from, this.to, this.event, this.guard, this.action)
  }
}

/**
 * Edge with timing constraints
 */
export class TimedEdge<TState extends number, TEvent extends number, TContext = any> 
  extends EdgeBase<TState, TEvent, TContext> {
  
  private lastTraversed?: number
  
  constructor(
    from: TState,
    to: TState,
    event: TEvent,
    private minDelay: number = 0,
    private maxDelay?: number,
    private guard?: (context: TContext) => boolean
  ) {
    super(from, to, event)
  }
  
  canTraverse(context: TContext): boolean {
    if (this.guard && !this.guard(context)) {
      return false
    }
    
    const now = Date.now()
    
    // Check minimum delay
    if (this.lastTraversed && now - this.lastTraversed < this.minDelay) {
      return false
    }
    
    // Check maximum delay (timeout)
    if (this.maxDelay && this.lastTraversed && now - this.lastTraversed > this.maxDelay) {
      return false
    }
    
    return true
  }
  
  onTraverse(context: TContext): TContext {
    this.lastTraversed = Date.now()
    return context
  }
  
  getMetadata(): Record<string, any> {
    return {
      ...super.getMetadata(),
      minDelay: this.minDelay,
      maxDelay: this.maxDelay,
      lastTraversed: this.lastTraversed
    }
  }
  
  clone(): TimedEdge<TState, TEvent, TContext> {
    return new TimedEdge(this.from, this.to, this.event, this.minDelay, this.maxDelay, this.guard)
  }
}

/**
 * Edge with retry semantics
 */
export class RetryEdge<TState extends number, TEvent extends number, TContext = any> 
  extends EdgeBase<TState, TEvent, TContext> {
  
  private attempts = 0
  
  constructor(
    from: TState,
    to: TState,
    event: TEvent,
    private maxAttempts: number = 3,
    private resetOn?: TEvent[],
    private guard?: (context: TContext) => boolean
  ) {
    super(from, to, event)
  }
  
  canTraverse(context: TContext): boolean {
    if (this.guard && !this.guard(context)) {
      return false
    }
    
    return this.attempts < this.maxAttempts
  }
  
  onTraverse(context: TContext): TContext {
    this.attempts++
    return context
  }
  
  reset(): void {
    this.attempts = 0
  }
  
  getMetadata(): Record<string, any> {
    return {
      ...super.getMetadata(),
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      canRetry: this.attempts < this.maxAttempts
    }
  }
  
  clone(): RetryEdge<TState, TEvent, TContext> {
    return new RetryEdge(this.from, this.to, this.event, this.maxAttempts, this.resetOn, this.guard)
  }
}

/**
 * Edge with probability (for stochastic state machines)
 */
export class ProbabilisticEdge<TState extends number, TEvent extends number, TContext = any> 
  extends EdgeBase<TState, TEvent, TContext> {
  
  constructor(
    from: TState,
    to: TState,
    event: TEvent,
    private probability: number = 1.0,
    private guard?: (context: TContext) => boolean
  ) {
    super(from, to, event)
    if (probability < 0 || probability > 1) {
      throw new Error('Probability must be between 0 and 1')
    }
  }
  
  canTraverse(context: TContext): boolean {
    if (this.guard && !this.guard(context)) {
      return false
    }
    
    return Math.random() < this.probability
  }
  
  getMetadata(): Record<string, any> {
    return {
      ...super.getMetadata(),
      probability: this.probability
    }
  }
  
  clone(): ProbabilisticEdge<TState, TEvent, TContext> {
    return new ProbabilisticEdge(this.from, this.to, this.event, this.probability, this.guard)
  }
}

/**
 * Composite edge that requires multiple conditions
 */
export class CompositeEdge<TState extends number, TEvent extends number, TContext = any> 
  extends EdgeBase<TState, TEvent, TContext> {
  
  constructor(
    from: TState,
    to: TState,
    event: TEvent,
    private edges: EdgeBase<TState, TEvent, TContext>[],
    private mode: 'all' | 'any' = 'all'
  ) {
    super(from, to, event)
  }
  
  canTraverse(context: TContext): boolean {
    if (this.mode === 'all') {
      return this.edges.every(edge => edge.canTraverse(context))
    } else {
      return this.edges.some(edge => edge.canTraverse(context))
    }
  }
  
  onTraverse(context: TContext): TContext {
    // Apply all edge effects in sequence
    return this.edges.reduce((ctx, edge) => edge.onTraverse(ctx), context)
  }
  
  getMetadata(): Record<string, any> {
    return {
      ...super.getMetadata(),
      mode: this.mode,
      edges: this.edges.map(e => e.getMetadata())
    }
  }
  
  clone(): CompositeEdge<TState, TEvent, TContext> {
    return new CompositeEdge(
      this.from, 
      this.to, 
      this.event, 
      this.edges.map(e => e.clone()),
      this.mode
    )
  }
}

/**
 * Edge factory for creating edges with fluent API
 */
export class EdgeBuilder<TState extends number, TEvent extends number, TContext = any> {
  private from!: TState
  private to!: TState
  private event!: TEvent
  
  setFrom(state: TState): this {
    this.from = state
    return this
  }
  
  setTo(state: TState): this {
    this.to = state
    return this
  }
  
  setEvent(event: TEvent): this {
    this.event = event
    return this
  }
  
  buildSimple(guard?: (context: TContext) => boolean): SimpleEdge<TState, TEvent, TContext> {
    return new SimpleEdge(this.from, this.to, this.event, guard)
  }
  
  buildWithContext(
    guard?: (context: TContext) => boolean,
    action?: (context: TContext) => TContext
  ): ContextEdge<TState, TEvent, TContext> {
    return new ContextEdge(this.from, this.to, this.event, guard, action)
  }
  
  buildTimed(
    minDelay: number,
    maxDelay?: number,
    guard?: (context: TContext) => boolean
  ): TimedEdge<TState, TEvent, TContext> {
    return new TimedEdge(this.from, this.to, this.event, minDelay, maxDelay, guard)
  }
  
  buildRetry(
    maxAttempts: number,
    guard?: (context: TContext) => boolean
  ): RetryEdge<TState, TEvent, TContext> {
    return new RetryEdge(this.from, this.to, this.event, maxAttempts, undefined, guard)
  }
  
  buildProbabilistic(
    probability: number,
    guard?: (context: TContext) => boolean
  ): ProbabilisticEdge<TState, TEvent, TContext> {
    return new ProbabilisticEdge(this.from, this.to, this.event, probability, guard)
  }
}