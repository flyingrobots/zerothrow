/**
 * @file Ultra-lean state machine implementation
 * 
 * Design principles:
 * - YAGNI: Only essential features
 * - Performance: Enum-based for fast comparisons
 * - Type-safe: Full TypeScript support
 * - Zero dependencies
 * - ~1KB minified
 */

/**
 * A transition can be:
 * - A single target state (simple transition)
 * - An array of conditional transitions (evaluated in order)
 * - A function that returns the target state
 */
export type TransitionTarget<TState extends number, TEvent extends number, TContext = any> = 
  | TState // Simple transition
  | ConditionalTransition<TState, TEvent, TContext>[] // Multiple possible targets
  | ((context: TContext, event: TEvent) => TState | undefined) // Dynamic transition

export interface ConditionalTransition<TState extends number, TEvent extends number, TContext = any> {
  target: TState
  guard?: (context: TContext, event: TEvent) => boolean
}

/**
 * Transition map supporting multiple target states
 * @example
 * {
 *   [State.Idle]: { 
 *     [Event.Start]: State.Loading // Simple
 *   },
 *   [State.Loading]: { 
 *     [Event.Complete]: [ // Multiple targets with guards
 *       { target: State.Success, guard: (ctx) => ctx.hasData },
 *       { target: State.Empty, guard: (ctx) => !ctx.hasData }
 *     ],
 *     [Event.Error]: (ctx, event) => { // Dynamic
 *       if (ctx.retryCount < 3) return State.Retry
 *       return State.Failed
 *     }
 *   }
 * }
 */
export type TransitionMap<TState extends number, TEvent extends number, TContext = any> = 
  Record<TState, Partial<Record<TEvent, TransitionTarget<TState, TEvent, TContext>>>>

/**
 * Ultra-lean finite state machine with support for multiple target states
 */
import { TriggerBuilder } from './trigger.js'

export class StateMachine<TState extends number, TEvent extends number, TContext = any> {
  private state: TState
  private context: TContext
  
  constructor(
    private readonly initial: TState,
    private readonly transitions: TransitionMap<TState, TEvent, TContext>,
    initialContext?: TContext
  ) {
    this.state = initial
    this.context = initialContext ?? {} as TContext
  }
  
  /**
   * Get current state
   */
  getState(): TState {
    return this.state
  }
  
  /**
   * Get current context
   */
  getContext(): TContext {
    return this.context
  }
  
  /**
   * Update context
   */
  setContext(context: TContext): void {
    this.context = context
  }
  
  /**
   * Send an event to transition states
   * Returns the new state if transition was valid, undefined otherwise
   */
  send(event: TEvent, eventContext?: Partial<TContext>): TState | undefined {
    const stateTransitions = this.transitions[this.state]
    const transition = stateTransitions?.[event]
    
    if (transition === undefined) {
      return undefined
    }
    
    // Merge event context if provided
    if (eventContext) {
      this.context = { ...this.context, ...eventContext }
    }
    
    let targetState: TState | undefined
    
    if (typeof transition === 'number') {
      // Simple transition
      targetState = transition
    } else if (Array.isArray(transition)) {
      // Conditional transitions - evaluate guards in order
      for (const conditional of transition) {
        if (!conditional.guard || conditional.guard(this.context, event)) {
          targetState = conditional.target
          break
        }
      }
    } else if (typeof transition === 'function') {
      // Dynamic transition
      targetState = transition(this.context, event)
    }
    
    if (targetState !== undefined) {
      this.state = targetState
      return targetState
    }
    
    return undefined
  }
  
  /**
   * Get all possible target states for an event from current state
   */
  getPossibleTargets(event: TEvent): TState[] {
    const stateTransitions = this.transitions[this.state]
    const transition = stateTransitions?.[event]
    
    if (transition === undefined) {
      return []
    }
    
    if (typeof transition === 'number') {
      return [transition]
    } else if (Array.isArray(transition)) {
      return transition.map(t => t.target)
    } else {
      // For dynamic transitions, we can't know without executing
      return []
    }
  }
  
  /**
   * Check if a transition is valid without executing it
   */
  can(event: TEvent): boolean {
    const stateTransitions = this.transitions[this.state]
    const transition = stateTransitions?.[event]
    
    if (transition === undefined) {
      return false
    }
    
    if (typeof transition === 'number') {
      return true
    } else if (Array.isArray(transition)) {
      // Check if any guard passes
      return transition.some(t => !t.guard || t.guard(this.context, event))
    } else {
      // For functions, we assume it's valid (could return undefined though)
      return true
    }
  }
  
  /**
   * Check if machine is in a specific state
   */
  is(state: TState): boolean {
    return this.state === state
  }
  
  /**
   * Check if machine is in any of the given states
   */
  isAny(...states: TState[]): boolean {
    return states.includes(this.state)
  }
  
  /**
   * Create a trigger builder for this state machine
   */
  createTrigger(): TriggerBuilder<TState, TEvent> {
    return new TriggerBuilder(this)
  }
}

/**
 * Observable state machine - opt-in for those who need it
 */
export class ObservableStateMachine<TState extends number, TEvent extends number, TContext = any> 
  extends StateMachine<TState, TEvent, TContext> {
  
  private listeners = new Set<(state: TState, context: TContext) => void>()
  
  constructor(
    initialState: TState,
    transitions: TransitionMap<TState, TEvent, TContext>,
    initialContext?: TContext
  ) {
    super(initialState, transitions, initialContext)
  }
  
  send(event: TEvent, eventContext?: Partial<TContext>): TState | undefined {
    const previousState = this.getState()
    const result = super.send(event, eventContext)
    
    if (result !== undefined && result !== previousState) {
      this.notify()
    }
    
    return result
  }
  
  subscribe(listener: (state: TState, context: TContext) => void): () => void {
    this.listeners.add(listener)
    listener(this.getState(), this.getContext()) // Notify immediately
    return () => this.listeners.delete(listener)
  }
  
  private notify(): void {
    const state = this.getState()
    const context = this.getContext()
    // Use for...of for better performance than forEach
    for (const listener of this.listeners) {
      listener(state, context)
    }
  }
}

/**
 * Helper to create state checker functions
 */
export function createStateCheckers<TState extends number>(
  machine: StateMachine<TState, any>,
  states: Record<string, TState>
): Record<string, () => boolean> {
  const checkers: Record<string, () => boolean> = {}
  
  for (const [name, state] of Object.entries(states)) {
    checkers[`is${name}`] = () => machine.is(state)
  }
  
  return checkers
}

// Re-export builder API
export { createStateMachine, stateMachine, FluentStateMachineBuilder } from './builder.js'
export type { TransitionListener, TransitionKey } from './builder.js'
export { EnhancedStateMachine } from './enhanced.js'

// New graph-based architecture
export { StateGraph, type Node } from './graph.js'
export { StateIterator, PollingIterator, type StateListener, type EdgeListener } from './iterator.js'
export { EdgeActivator, ActivatorCollection, ActivatorFactory } from './activator.js'
export { GraphStateMachine, PollingStateMachine, GraphMachineBuilder, type StateMachineConfig } from './machine.js'

// Semantic edges
export { 
  EdgeBase,
  SimpleEdge,
  ContextEdge,
  TimedEdge,
  RetryEdge,
  ProbabilisticEdge,
  CompositeEdge,
  EdgeBuilder
} from './edge.js'