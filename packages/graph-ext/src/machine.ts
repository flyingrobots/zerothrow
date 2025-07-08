/**
 * @file New state machine API using graph/iterator/activator pattern
 */

import { StateGraph } from './graph.js'
import { StateIterator, PollingIterator, StateListener, EdgeListener } from './iterator.js'
import { EdgeActivator, ActivatorCollection, ActivatorFactory } from './activator.js'

/**
 * State machine configuration
 */
export interface StateMachineConfig<TState extends number, TEvent extends number, TContext = any> {
  initialState: TState
  initialContext?: TContext
  states?: Array<{
    state: TState
    metadata?: Record<string, any>
  }>
  transitions: Array<{
    from: TState
    to: TState
    event: TEvent
    guard?: (context: TContext) => boolean
  }>
}

/**
 * Modern state machine implementation
 * Separates graph structure from traversal logic
 */
export class GraphStateMachine<TState extends number, TEvent extends number, TContext = any> {
  private graph: StateGraph<TState, TEvent, TContext>
  private iterator: StateIterator<TState, TEvent, TContext>
  private activatorFactory: ActivatorFactory<TState, TEvent, TContext>
  
  constructor(config: StateMachineConfig<TState, TEvent, TContext>) {
    // Build the graph
    this.graph = new StateGraph()
    
    // Add states
    if (config.states) {
      for (const { state, metadata } of config.states) {
        this.graph.addNode(state, metadata)
      }
    }
    
    // Add transitions
    for (const transition of config.transitions) {
      // Ensure nodes exist
      if (!this.graph.hasNode(transition.from)) {
        this.graph.addNode(transition.from)
      }
      if (!this.graph.hasNode(transition.to)) {
        this.graph.addNode(transition.to)
      }
      
      // Add edge
      this.graph.addEdge(
        transition.from,
        transition.to,
        transition.event,
        transition.guard
      )
    }
    
    // Create iterator
    this.iterator = new StateIterator(
      this.graph,
      config.initialState,
      config.initialContext ?? {} as TContext
    )
    
    // Create activator factory
    this.activatorFactory = new ActivatorFactory(this.iterator)
  }
  
  /**
   * Get current state
   */
  getState(): TState {
    return this.iterator.getState()
  }
  
  /**
   * Get current context
   */
  getContext(): TContext {
    return this.iterator.getContext()
  }
  
  /**
   * Send an event
   */
  send(event: TEvent, context?: Partial<TContext>): TState | undefined {
    return this.iterator.traverse(event, context)
  }
  
  /**
   * Check if can handle event
   */
  can(event: TEvent): boolean {
    return this.iterator.canTraverse(event)
  }
  
  /**
   * Check current state
   */
  is(state: TState): boolean {
    return this.iterator.getState() === state
  }
  
  /**
   * Get possible next states for an event
   */
  getPossibleTargets(event: TEvent): TState[] {
    return this.iterator.getPossibleDestinations(event)
  }
  
  /**
   * Subscribe to state changes
   */
  onStateChange(listener: StateListener<TState, TContext>): () => void {
    return this.iterator.onStateChange(listener)
  }
  
  /**
   * Subscribe to edge traversals
   */
  onEdgeTraversal(listener: EdgeListener<TState, TEvent, TContext>): () => void {
    return this.iterator.onEdgeTraversal(listener)
  }
  
  /**
   * Create an edge activator
   */
  createActivator(from: TState, to: TState, event: TEvent): EdgeActivator<TState, TEvent, TContext> {
    return this.activatorFactory.createActivator(from, to, event)
  }
  
  /**
   * Create a collection of activators
   */
  createActivators(
    definitions: Array<{ name: string, from: TState, to: TState, event: TEvent }>
  ): ActivatorCollection<TState, TEvent, TContext> {
    return this.activatorFactory.createCollection(definitions)
  }
  
  /**
   * Get the underlying graph
   */
  getGraph(): StateGraph<TState, TEvent, TContext> {
    return this.graph
  }
  
  /**
   * Get the iterator
   */
  getIterator(): StateIterator<TState, TEvent, TContext> {
    return this.iterator
  }
  
  /**
   * Get visit history
   */
  getHistory(): ReadonlyArray<{ state: TState, timestamp: number }> {
    return this.iterator.getHistory()
  }
}

/**
 * Polling state machine that auto-transitions based on conditions
 */
export class PollingStateMachine<TState extends number, TEvent extends number, TContext = any> 
  extends GraphStateMachine<TState, TEvent, TContext> {
  
  private pollingIterator: PollingIterator<TState, TEvent, TContext>
  
  constructor(config: StateMachineConfig<TState, TEvent, TContext>) {
    super(config)
    
    // Replace iterator with polling version
    this.pollingIterator = new PollingIterator(
      this.getGraph(),
      config.initialState,
      config.initialContext ?? {} as TContext
    )
    
    // Update references
    (this as any).iterator = this.pollingIterator
    (this as any).activatorFactory = new ActivatorFactory(this.pollingIterator)
  }
  
  /**
   * Add a polling condition
   */
  addCondition(
    check: (context: TContext, state: TState) => TEvent | undefined,
    priority = 0
  ): this {
    this.pollingIterator.addCondition(check, priority)
    return this
  }
  
  /**
   * Start polling
   */
  startPolling(intervalMs: number): void {
    this.pollingIterator.startPolling(intervalMs)
  }
  
  /**
   * Stop polling
   */
  stopPolling(): void {
    this.pollingIterator.stopPolling()
  }
  
  /**
   * Manually trigger a poll
   */
  poll(): void {
    this.pollingIterator.poll()
  }
  
  /**
   * Cleanup
   */
  dispose(): void {
    this.pollingIterator.dispose()
  }
}

/**
 * Builder for the new graph-based state machine
 */
export class GraphMachineBuilder<TState extends number, TEvent extends number, TContext = any> {
  private config: StateMachineConfig<TState, TEvent, TContext> = {
    initialState: 0 as TState,
    transitions: []
  }
  
  private activatorDefs: Array<{ name: string, from: TState, to: TState, event: TEvent }> = []
  
  initialState(state: TState): this {
    this.config.initialState = state
    return this
  }
  
  withContext(context: TContext): this {
    this.config.initialContext = context
    return this
  }
  
  addState(state: TState, metadata?: Record<string, any>): this {
    if (!this.config.states) {
      this.config.states = []
    }
    this.config.states.push({ state, metadata })
    return this
  }
  
  addTransition(
    from: TState, 
    to: TState, 
    event: TEvent, 
    guard?: (context: TContext) => boolean
  ): this {
    this.config.transitions.push({ from, to, event, guard })
    return this
  }
  
  createActivator(name: string, from: TState, to: TState, event: TEvent): this {
    this.activatorDefs.push({ name, from, to, event })
    return this
  }
  
  build(): {
    machine: GraphStateMachine<TState, TEvent, TContext>
    activators: ActivatorCollection<TState, TEvent, TContext>
  } {
    const machine = new GraphStateMachine(this.config)
    const activators = machine.createActivators(this.activatorDefs)
    return { machine, activators }
  }
  
  buildPolling(): {
    machine: PollingStateMachine<TState, TEvent, TContext>
    activators: ActivatorCollection<TState, TEvent, TContext>
  } {
    const machine = new PollingStateMachine(this.config)
    const activators = machine.createActivators(this.activatorDefs)
    return { machine, activators }
  }
}