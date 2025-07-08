/**
 * @file Edge activators - trigger specific edges in the graph
 */

import { StateIterator } from './iterator.js'
import { Edge } from './graph.js'

/**
 * Activates a specific edge in the state graph
 */
export class EdgeActivator<TState extends number, TEvent extends number, TContext = any> {
  private iteratorRef: WeakRef<StateIterator<TState, TEvent, TContext>>
  
  constructor(
    iterator: StateIterator<TState, TEvent, TContext>,
    private edge: Edge<TState, TEvent, TContext>
  ) {
    this.iteratorRef = new WeakRef(iterator)
  }
  
  /**
   * Check if this edge can currently be activated
   */
  canActivate(): boolean {
    const iterator = this.iteratorRef.deref()
    if (!iterator) return false
    
    return iterator.getState() === this.edge.from && 
           iterator.canTraverse(this.edge.event)
  }
  
  /**
   * Activate the edge (traverse it)
   */
  activate(context?: Partial<TContext>): boolean {
    const iterator = this.iteratorRef.deref()
    if (!iterator || !this.canActivate()) {
      return false
    }
    
    const result = iterator.traverse(this.edge.event, context)
    return result === this.edge.to
  }
  
  /**
   * Get edge metadata
   */
  getEdge(): Readonly<Edge<TState, TEvent, TContext>> {
    return this.edge
  }
  
  /**
   * Check if iterator is still alive
   */
  isAlive(): boolean {
    return this.iteratorRef.deref() !== undefined
  }
}

/**
 * Collection of edge activators
 */
export class ActivatorCollection<TState extends number, TEvent extends number, TContext = any> {
  private activators = new Map<string, EdgeActivator<TState, TEvent, TContext>>()
  
  /**
   * Add an activator
   */
  add(name: string, activator: EdgeActivator<TState, TEvent, TContext>): this {
    this.activators.set(name, activator)
    return this
  }
  
  /**
   * Get an activator by name
   */
  get(name: string): EdgeActivator<TState, TEvent, TContext> | undefined {
    return this.activators.get(name)
  }
  
  /**
   * Get all activators that can currently activate
   */
  getAvailable(): Array<[string, EdgeActivator<TState, TEvent, TContext>]> {
    return Array.from(this.activators.entries())
      .filter(([_, activator]) => activator.canActivate())
  }
  
  /**
   * Create a proxy object with activators as methods
   */
  asObject(): Record<string, (context?: Partial<TContext>) => boolean> {
    const obj: Record<string, (context?: Partial<TContext>) => boolean> = {}
    for (const [name, activator] of this.activators) {
      obj[name] = (context) => activator.activate(context)
    }
    return obj
  }
  
  /**
   * Get all activator names
   */
  getNames(): string[] {
    return Array.from(this.activators.keys())
  }
}

/**
 * Factory for creating activators from an iterator
 */
export class ActivatorFactory<TState extends number, TEvent extends number, TContext = any> {
  constructor(private iterator: StateIterator<TState, TEvent, TContext>) {}
  
  /**
   * Create an activator for a specific edge
   */
  createActivator(from: TState, to: TState, event: TEvent): EdgeActivator<TState, TEvent, TContext> {
    const edge: Edge<TState, TEvent, TContext> = { from, to, event }
    return new EdgeActivator(this.iterator, edge)
  }
  
  /**
   * Create a collection of named activators
   */
  createCollection(
    definitions: Array<{ name: string, from: TState, to: TState, event: TEvent }>
  ): ActivatorCollection<TState, TEvent, TContext> {
    const collection = new ActivatorCollection<TState, TEvent, TContext>()
    
    for (const def of definitions) {
      const activator = this.createActivator(def.from, def.to, def.event)
      collection.add(def.name, activator)
    }
    
    return collection
  }
}