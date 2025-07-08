/**
 * @file Fluent builder API for state machines
 */

import { StateMachine, ObservableStateMachine, type TransitionMap } from './index.js'
import { EnhancedStateMachine } from './enhanced.js'
import { TransitionTrigger, TriggerCollection } from './trigger.js'

import type { TransitionTarget, ConditionalTransition, TransitionMap } from './index.js'

export type GuardFunction<TContext = any, TEvent extends number = number> = (context: TContext, event: TEvent) => boolean

/**
 * Fluent builder for state machines
 * 
 * @example
 * enum State { Idle, Loading, Success, Error }
 * enum Event { Start, Complete, Fail, Retry }
 * 
 * const machine = createStateMachine<State, Event>()
 *   .initialState(State.Idle)
 *   .addTransition(Event.Start)
 *     .from(State.Idle)
 *     .to(State.Loading)
 *   .addTransition(Event.Complete)
 *     .from(State.Loading)
 *     .to(State.Success)
 *   .addTransition(Event.Fail)
 *     .from(State.Loading)
 *     .to(State.Error)
 *   .addConditionalTransition(Event.Retry)
 *     .from(State.Error)
 *     .to(State.Loading)
 *     .when((context) => context.retryCount < 3)
 *   .addTransition(Event.Retry)
 *     .from(State.Error)
 *     .to(State.Error) // Stay in error if condition fails
 *   .build()
 */
export type TransitionListener<TState extends number, TEvent extends number> = (from: TState, to: TState, event: TEvent) => void
export type TransitionKey = `${number}->${number}` // "from->to"

export interface BuildResult<TState extends number, TEvent extends number> {
  machine: StateMachine<TState, TEvent> | EnhancedStateMachine<TState, TEvent>
  triggers: TriggerCollection<TState, TEvent>
}

export class StateMachineBuilder<TState extends number, TEvent extends number, TContext = any> {
  private initial?: TState
  private initialContext?: TContext
  private transitions: TransitionMap<TState, TEvent, TContext> = {} as any
  private currentTransition?: {
    event: TEvent
    from?: TState
    targets: Array<{ to: TState, guard?: GuardFunction<TContext, TEvent> }>
  }
  
  // Observable hooks
  private globalListeners: TransitionListener<TState, TEvent>[] = []
  private transitionListeners: Map<TransitionKey, TransitionListener<TState, TEvent>[]> = new Map()
  private beforeTransitionListeners: Map<TransitionKey, TransitionListener<TState, TEvent>[]> = new Map()
  private afterTransitionListeners: Map<TransitionKey, TransitionListener<TState, TEvent>[]> = new Map()
  
  // Triggers to create
  private triggerDefinitions: Array<{name: string, from: TState, to: TState, event: TEvent}> = []

  /**
   * Set the initial state
   */
  initialState(state: TState): this {
    this.initial = state
    return this
  }

  /**
   * Set the initial context
   */
  withContext(context: TContext): this {
    this.initialContext = context
    return this
  }

  /**
   * Start defining a transition
   */
  addTransition(event: TEvent): this {
    this.finalizeCurrentTransition()
    this.currentTransition = { event, targets: [] }
    return this
  }

  /**
   * Define the source state
   */
  from(state: TState): this {
    if (!this.currentTransition) {
      throw new Error('Call addTransition() or addConditionalTransition() first')
    }
    this.currentTransition.from = state
    return this
  }

  /**
   * Define a target state (can be called multiple times for multiple targets)
   */
  to(state: TState): this {
    if (!this.currentTransition) {
      throw new Error('Call addTransition() first')
    }
    this.currentTransition.targets.push({ to: state })
    return this
  }

  /**
   * Add a conditional target with guard
   */
  toWhen(state: TState, guard: GuardFunction<TContext, TEvent>): this {
    if (!this.currentTransition) {
      throw new Error('Call addTransition() first')
    }
    this.currentTransition.targets.push({ to: state, guard })
    return this
  }

  /**
   * Add a guard to the last target
   */
  when(guard: GuardFunction<TContext, TEvent>): this {
    if (!this.currentTransition || this.currentTransition.targets.length === 0) {
      throw new Error('Call to() first')
    }
    const lastTarget = this.currentTransition.targets[this.currentTransition.targets.length - 1]
    lastTarget.guard = guard
    return this
  }

  /**
   * Add a global transition listener (fires for any transition)
   */
  onAnyTransition(listener: TransitionListener<TState, TEvent>): this {
    this.globalListeners.push(listener)
    return this
  }

  /**
   * Add a listener for a specific transition
   * @example
   * .onTransition(State.Loading, State.Success, (from, to, event) => {
   *   console.log('Loading completed successfully!')
   * })
   */
  onTransition(from: TState, to: TState, listener: TransitionListener<TState, TEvent>): this {
    const key: TransitionKey = `${from}->${to}`
    if (!this.transitionListeners.has(key)) {
      this.transitionListeners.set(key, [])
    }
    this.transitionListeners.get(key)!.push(listener)
    return this
  }

  /**
   * Add a listener that fires before a specific transition
   */
  beforeTransition(from: TState, to: TState, listener: TransitionListener<TState, TEvent>): this {
    const key: TransitionKey = `${from}->${to}`
    if (!this.beforeTransitionListeners.has(key)) {
      this.beforeTransitionListeners.set(key, [])
    }
    this.beforeTransitionListeners.get(key)!.push(listener)
    return this
  }

  /**
   * Add a listener that fires after a specific transition
   */
  afterTransition(from: TState, to: TState, listener: TransitionListener<TState, TEvent>): this {
    const key: TransitionKey = `${from}->${to}`
    if (!this.afterTransitionListeners.has(key)) {
      this.afterTransitionListeners.set(key, [])
    }
    this.afterTransitionListeners.get(key)!.push(listener)
    return this
  }

  /**
   * Add listeners for entering a specific state from any state
   */
  onEnterState(state: TState, listener: (from: TState, event: TEvent) => void): this {
    // This is sugar for onAnyTransition with a filter
    this.globalListeners.push((from, to, event) => {
      if (to === state) {
        listener(from, event)
      }
    })
    return this
  }

  /**
   * Add listeners for exiting a specific state to any state
   */
  onExitState(state: TState, listener: (to: TState, event: TEvent) => void): this {
    // This is sugar for onAnyTransition with a filter
    this.globalListeners.push((from, to, event) => {
      if (from === state) {
        listener(to, event)
      }
    })
    return this
  }
  
  /**
   * Create a named trigger for a transition
   * @example
   * .createTrigger('startLoading')
   *   .from(State.Idle)
   *   .to(State.Loading)
   *   .on(Event.Start)
   */
  createTrigger(name: string): TriggerDefinitionBuilder<TState, TEvent> {
    return new TriggerDefinitionBuilder(name, this.triggerDefinitions)
  }

  /**
   * Finalize any pending transition
   */
  private finalizeCurrentTransition(): void {
    if (!this.currentTransition) return
    
    const { event, from, targets } = this.currentTransition
    
    if (from === undefined || targets.length === 0) {
      throw new Error('Incomplete transition: missing from() or to()')
    }

    // Initialize state transitions if needed
    if (!this.transitions[from]) {
      this.transitions[from] = {}
    }

    // Add the transition
    if (targets.length === 1 && !targets[0].guard) {
      // Simple transition
      this.transitions[from][event] = targets[0].to
    } else {
      // Conditional transitions
      this.transitions[from][event] = targets.map(t => ({
        target: t.to,
        guard: t.guard
      }))
    }

    this.currentTransition = undefined
  }

  /**
   * Build the state machine
   */
  build(): StateMachine<TState, TEvent, TContext> | EnhancedStateMachine<TState, TEvent, TContext> {
    const result = this.buildWithTriggers()
    return result.machine
  }
  
  /**
   * Build the state machine with triggers
   */
  buildWithTriggers(): BuildResult<TState, TEvent> {
    this.finalizeCurrentTransition()
    
    if (this.initial === undefined) {
      throw new Error('Initial state not set. Call initialState() first')
    }

    // Convert to simple transition map (guards handled separately)
    const simpleTransitions: TransitionMap<TState, TEvent> = {} as any
    
    for (const [state, events] of Object.entries(this.transitions) as [string, any][]) {
      const stateNum = Number(state) as TState
      simpleTransitions[stateNum] = {}
      
      for (const [event, transition] of Object.entries(events) as [string, any][]) {
        const eventNum = Number(event) as TEvent
        if (typeof transition === 'number') {
          simpleTransitions[stateNum][eventNum] = transition
        } else {
          // For now, just use the target (guards would need custom machine)
          simpleTransitions[stateNum][eventNum] = transition.target
        }
      }
    }

    // If we have hooks, create enhanced machine
    if (this.globalListeners.length > 0 || 
        this.transitionListeners.size > 0 || 
        this.beforeTransitionListeners.size > 0 ||
        this.afterTransitionListeners.size > 0) {
      return new EnhancedStateMachine(this.initial, simpleTransitions, {
        global: this.globalListeners,
        transitions: this.transitionListeners,
        before: this.beforeTransitionListeners,
        after: this.afterTransitionListeners
      })
    }

    // Build the machine
    let machine: StateMachine<TState, TEvent> | EnhancedStateMachine<TState, TEvent>
    
    // If we have hooks, create enhanced machine
    if (this.globalListeners.length > 0 || 
        this.transitionListeners.size > 0 || 
        this.beforeTransitionListeners.size > 0 ||
        this.afterTransitionListeners.size > 0) {
      machine = new EnhancedStateMachine(this.initial, simpleTransitions, {
        global: this.globalListeners,
        transitions: this.transitionListeners,
        before: this.beforeTransitionListeners,
        after: this.afterTransitionListeners
      })
    } else {
      machine = new StateMachine(this.initial, simpleTransitions)
    }
    
    // Create triggers
    const triggers = new TriggerCollection<TState, TEvent>()
    for (const def of this.triggerDefinitions) {
      const trigger = new TransitionTrigger(machine, def.from, def.to, def.event)
      triggers.add(def.name, trigger)
    }
    
    return { machine, triggers }
  }

  /**
   * Build an observable state machine
   */
  buildObservable(): ObservableStateMachine<TState, TEvent> {
    this.finalizeCurrentTransition()
    
    if (this.initial === undefined) {
      throw new Error('Initial state not set. Call initialState() first')
    }

    const simpleTransitions: TransitionMap<TState, TEvent> = {} as any
    
    for (const [state, events] of Object.entries(this.transitions) as [string, any][]) {
      const stateNum = Number(state) as TState
      simpleTransitions[stateNum] = {}
      
      for (const [event, transition] of Object.entries(events) as [string, any][]) {
        const eventNum = Number(event) as TEvent
        if (typeof transition === 'number') {
          simpleTransitions[stateNum][eventNum] = transition
        } else {
          simpleTransitions[stateNum][eventNum] = transition.target
        }
      }
    }

    return new ObservableStateMachine(this.initial, simpleTransitions)
  }
}

/**
 * Create a new state machine builder
 */
export function createStateMachine<TState extends number, TEvent extends number>(): StateMachineBuilder<TState, TEvent> {
  return new StateMachineBuilder()
}

/**
 * Alternative builder with more natural syntax
 */
export class FluentStateMachineBuilder<TState extends number, TEvent extends number> {
  private initial?: TState
  private transitions: TransitionMap<TState, TEvent> = {} as any

  static create<S extends number, E extends number>(): FluentStateMachineBuilder<S, E> {
    return new FluentStateMachineBuilder()
  }

  startWith(state: TState): this {
    this.initial = state
    return this
  }

  state(state: TState): StateBuilder<TState, TEvent> {
    return new StateBuilder(state, this.transitions)
  }

  build(): StateMachine<TState, TEvent> {
    if (this.initial === undefined) {
      throw new Error('Initial state not set')
    }
    return new StateMachine(this.initial, this.transitions)
  }
}

class StateBuilder<TState extends number, TEvent extends number> {
  constructor(
    private state: TState,
    private transitions: TransitionMap<TState, TEvent>
  ) {
    if (!this.transitions[state]) {
      this.transitions[state] = {}
    }
  }

  on(event: TEvent): TransitionBuilder<TState, TEvent> {
    return new TransitionBuilder(this.state, event, this.transitions)
  }
}

class TransitionBuilder<TState extends number, TEvent extends number> {
  constructor(
    private fromState: TState,
    private event: TEvent,
    private transitions: TransitionMap<TState, TEvent>
  ) {}

  goTo(state: TState): void {
    this.transitions[this.fromState][this.event] = state
  }

  transitionTo(state: TState): void {
    this.goTo(state)
  }
}

/**
 * Natural language style builder
 * 
 * @example
 * const machine = stateMachine<State, Event>()
 *   .startingAt(State.Idle)
 *   .where(State.Idle).on(Event.Start).leadsTo(State.Loading)
 *   .where(State.Loading).on(Event.Success).leadsTo(State.Done)
 *   .where(State.Loading).on(Event.Error).leadsTo(State.Failed)
 *   .create()
 */
export function stateMachine<TState extends number, TEvent extends number>() {
  return new NaturalStateMachineBuilder<TState, TEvent>()
}

class NaturalStateMachineBuilder<TState extends number, TEvent extends number> {
  private initial?: TState
  private transitions: TransitionMap<TState, TEvent> = {} as any
  private currentState?: TState
  private currentEvent?: TEvent

  startingAt(state: TState): this {
    this.initial = state
    return this
  }

  where(state: TState): this {
    this.currentState = state
    if (!this.transitions[state]) {
      this.transitions[state] = {}
    }
    return this
  }

  on(event: TEvent): this {
    if (this.currentState === undefined) {
      throw new Error('Call where() first')
    }
    this.currentEvent = event
    return this
  }

  leadsTo(state: TState): this {
    if (this.currentState === undefined || this.currentEvent === undefined) {
      throw new Error('Call where() and on() first')
    }
    this.transitions[this.currentState][this.currentEvent] = state
    this.currentEvent = undefined
    return this
  }

  create(): StateMachine<TState, TEvent> {
    if (this.initial === undefined) {
      throw new Error('Call startingAt() first')
    }
    return new StateMachine(this.initial, this.transitions)
  }
}

/**
 * Builder for trigger definitions
 */
class TriggerDefinitionBuilder<TState extends number, TEvent extends number> {
  private from?: TState
  private to?: TState
  private event?: TEvent

  constructor(
    private name: string,
    private definitions: Array<{name: string, from: TState, to: TState, event: TEvent}>
  ) {}

  from(state: TState): this {
    this.from = state
    return this
  }

  to(state: TState): this {
    this.to = state
    return this
  }

  on(event: TEvent): this {
    this.event = event
    if (this.from !== undefined && this.to !== undefined && this.event !== undefined) {
      this.definitions.push({
        name: this.name,
        from: this.from,
        to: this.to,
        event: this.event
      })
    }
    return this
  }
}