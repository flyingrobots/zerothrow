/**
 * @file State iterator - traverses the graph and manages observers
 */

import { StateGraph } from './graph.js'
import { EdgeBase } from './edge.js'

export type StateListener<TState extends number, TContext = any> = (
  from: TState,
  to: TState,
  context: TContext
) => void

export type EdgeListener<TState extends number, TEvent extends number, TContext = any> = (
  edge: EdgeBase<TState, TEvent, TContext>,
  context: TContext
) => void

/**
 * Iterator that traverses a state graph
 * Holds current position and manages observers
 */
export class StateIterator<TState extends number, TEvent extends number, TContext = any> {
  private currentState: TState
  private context: TContext
  private stateListeners = new Set<StateListener<TState, TContext>>()
  private edgeListeners = new Set<EdgeListener<TState, TEvent, TContext>>()
  private visitHistory: Array<{ state: TState, timestamp: number }> = []
  
  constructor(
    private graph: StateGraph<TState, TEvent, TContext>,
    initialState: TState,
    initialContext: TContext
  ) {
    if (!graph.hasNode(initialState)) {
      throw new Error(`Initial state ${initialState} not found in graph`)
    }
    this.currentState = initialState
    this.context = initialContext
    this.recordVisit(initialState)
  }
  
  /**
   * Get current state
   */
  getState(): TState {
    return this.currentState
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
  updateContext(updates: Partial<TContext>): void {
    this.context = { ...this.context, ...updates }
  }
  
  /**
   * Traverse an edge if valid
   */
  traverse(event: TEvent, eventContext?: Partial<TContext>): TState | undefined {
    const edges = this.graph.getEdgesForEvent(this.currentState, event)
    
    // Update context if provided
    if (eventContext) {
      this.updateContext(eventContext)
    }
    
    // Find first valid edge
    for (const edge of edges) {
      if (edge.canTraverse(this.context)) {
        this.executeTransition(edge)
        return edge.to
      }
    }
    
    return undefined
  }
  
  /**
   * Force move to a specific state (bypasses edges)
   */
  jumpTo(state: TState): void {
    if (!this.graph.hasNode(state)) {
      throw new Error(`State ${state} not found in graph`)
    }
    
    const from = this.currentState
    this.currentState = state
    this.recordVisit(state)
    this.notifyStateListeners(from, state)
  }
  
  /**
   * Check if can traverse via event
   */
  canTraverse(event: TEvent): boolean {
    const edges = this.graph.getEdgesForEvent(this.currentState, event)
    return edges.some(edge => edge.canTraverse(this.context))
  }
  
  /**
   * Get possible destinations for an event
   */
  getPossibleDestinations(event: TEvent): TState[] {
    return this.graph.getEdgesForEvent(this.currentState, event)
      .filter(edge => edge.canTraverse(this.context))
      .map(edge => edge.to)
  }
  
  /**
   * Subscribe to state changes
   */
  onStateChange(listener: StateListener<TState, TContext>): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }
  
  /**
   * Subscribe to edge traversals
   */
  onEdgeTraversal(listener: EdgeListener<TState, TEvent, TContext>): () => void {
    this.edgeListeners.add(listener)
    return () => this.edgeListeners.delete(listener)
  }
  
  /**
   * Get visit history
   */
  getHistory(): ReadonlyArray<{ state: TState, timestamp: number }> {
    return this.visitHistory
  }
  
  /**
   * Execute a transition
   */
  private executeTransition(edge: EdgeBase<TState, TEvent, TContext>): void {
    const from = this.currentState
    const fromNode = this.graph.getNode(from)
    const toNode = this.graph.getNode(edge.to)
    
    // Call node exit handler
    if (fromNode?.onExit) {
      fromNode.onExit()
    }
    
    // Update context via edge
    this.context = edge.onTraverse(this.context)
    
    // Update state
    this.currentState = edge.to
    this.recordVisit(edge.to)
    
    // Call node enter handler
    if (toNode?.onEnter) {
      toNode.onEnter()
    }
    
    // Notify listeners
    this.notifyEdgeListeners(edge)
    this.notifyStateListeners(from, edge.to)
  }
  
  /**
   * Record a visit to a state
   */
  private recordVisit(state: TState): void {
    this.visitHistory.push({ state, timestamp: Date.now() })
  }
  
  /**
   * Notify state listeners
   */
  private notifyStateListeners(from: TState, to: TState): void {
    for (const listener of this.stateListeners) {
      listener(from, to, this.context)
    }
  }
  
  /**
   * Notify edge listeners
   */
  private notifyEdgeListeners(edge: EdgeBase<TState, TEvent, TContext>): void {
    for (const listener of this.edgeListeners) {
      listener(edge, this.context)
    }
  }
}

/**
 * Iterator that polls conditions to auto-traverse
 */
export class PollingIterator<TState extends number, TEvent extends number, TContext = any> 
  extends StateIterator<TState, TEvent, TContext> {
  
  private pollInterval?: NodeJS.Timeout | undefined
  private conditions: Array<{
    check: (context: TContext, state: TState) => TEvent | undefined
    priority: number
  }> = []
  
  /**
   * Add a condition to poll
   */
  addCondition(
    check: (context: TContext, state: TState) => TEvent | undefined,
    priority = 0
  ): this {
    this.conditions.push({ check, priority })
    this.conditions.sort((a, b) => b.priority - a.priority)
    return this
  }
  
  /**
   * Start polling
   */
  startPolling(intervalMs: number): void {
    this.stopPolling()
    this.pollInterval = setInterval(() => this.poll(), intervalMs)
  }
  
  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = undefined
    }
  }
  
  /**
   * Manually trigger a poll
   */
  poll(): void {
    for (const { check } of this.conditions) {
      const event = check(this.getContext(), this.getState())
      if (event !== undefined && this.canTraverse(event)) {
        this.traverse(event)
        break
      }
    }
  }
  
  /**
   * Cleanup
   */
  dispose(): void {
    this.stopPolling()
  }
}