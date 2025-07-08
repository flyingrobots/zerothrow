/**
 * @file Enhanced state machine with lifecycle hooks
 */

import { ObservableStateMachine, type TransitionMap } from './index.js'
import type { TransitionListener, TransitionKey } from './builder.js'

/**
 * Enhanced observable state machine with lifecycle hooks
 */
export class EnhancedStateMachine<TState extends number, TEvent extends number> 
  extends ObservableStateMachine<TState, TEvent> {
  
  private globalListeners: TransitionListener<TState, TEvent>[]
  private transitionListeners: Map<TransitionKey, TransitionListener<TState, TEvent>[]>
  private beforeListeners: Map<TransitionKey, TransitionListener<TState, TEvent>[]>
  private afterListeners: Map<TransitionKey, TransitionListener<TState, TEvent>[]>
  
  constructor(
    initialState: TState,
    transitions: TransitionMap<TState, TEvent>,
    hooks: {
      global?: TransitionListener<TState, TEvent>[]
      transitions?: Map<TransitionKey, TransitionListener<TState, TEvent>[]>
      before?: Map<TransitionKey, TransitionListener<TState, TEvent>[]>
      after?: Map<TransitionKey, TransitionListener<TState, TEvent>[]>
    } = {}
  ) {
    super(initialState, transitions)
    this.globalListeners = hooks.global || []
    this.transitionListeners = hooks.transitions || new Map()
    this.beforeListeners = hooks.before || new Map()
    this.afterListeners = hooks.after || new Map()
  }
  
  send(event: TEvent): boolean {
    const fromState = this.getState()
    
    // Pre-check if transition is valid to call before listeners
    if (this.can(event)) {
      const transitions = (this as any).transitions[fromState]
      const toState = transitions[event] as TState
      const key: TransitionKey = `${fromState}->${toState}`
      
      // Call before transition listeners
      const beforeListeners = this.beforeListeners.get(key)
      if (beforeListeners) {
        for (const listener of beforeListeners) {
          listener(fromState, toState, event)
        }
      }
    }
    
    const result = super.send(event)
    
    if (result) {
      const toState = this.getState()
      const key: TransitionKey = `${fromState}->${toState}`
      
      // Call specific transition listeners
      const transitionListeners = this.transitionListeners.get(key)
      if (transitionListeners) {
        for (const listener of transitionListeners) {
          listener(fromState, toState, event)
        }
      }
      
      // Call global listeners
      for (const listener of this.globalListeners) {
        listener(fromState, toState, event)
      }
      
      // Call after transition listeners
      const afterListeners = this.afterListeners.get(key)
      if (afterListeners) {
        for (const listener of afterListeners) {
          listener(fromState, toState, event)
        }
      }
    }
    
    return result
  }
}