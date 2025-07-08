/**
 * @zerothrow/graph-ext - Extended features for graph traversal
 * 
 * Provides semantic edges, observable iterators, state machine builders,
 * and more advanced graph features.
 */

// Re-export core for convenience
export { Graph, GraphIterator } from '@zerothrow/graph'

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

// Extended graph with semantic edges
export { StateGraph, type Node } from './graph.js'

// Advanced iterators
export { StateIterator, PollingIterator, type StateListener, type EdgeListener } from './iterator.js'

// Edge activators
export { EdgeActivator, ActivatorCollection, ActivatorFactory } from './activator.js'

// State machine helpers
export { GraphStateMachine, PollingStateMachine, GraphMachineBuilder, type StateMachineConfig } from './machine.js'

// Builder APIs
export { createStateMachine, stateMachine, FluentStateMachineBuilder } from './builder.js'
export type { TransitionListener, TransitionKey } from './builder.js'
export { EnhancedStateMachine } from './enhanced.js'

// Legacy StateMachine (for backward compatibility)
export { StateMachine, ObservableStateMachine, createStateCheckers } from './legacy.js'