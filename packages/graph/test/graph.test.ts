import { describe, it, expect } from 'vitest'
import { Graph, GraphIterator } from '../src/index.js'

enum State {
  Idle = 0,
  Loading = 1,
  Success = 2,
  Error = 3
}

enum Event {
  Start = 0,
  Complete = 1,
  Fail = 2,
  Reset = 3
}

describe('Graph', () => {
  it('should create an empty graph', () => {
    const graph = new Graph<State, Event>()
    expect(graph.getEdges(State.Idle)).toEqual([])
  })

  it('should add edges', () => {
    const graph = new Graph<State, Event>()
      .addEdge(State.Idle, State.Loading, Event.Start)
      .addEdge(State.Loading, State.Success, Event.Complete)
      .addEdge(State.Loading, State.Error, Event.Fail)

    expect(graph.getEdges(State.Idle)).toEqual([
      { to: State.Loading, via: Event.Start }
    ])
    expect(graph.getEdges(State.Loading)).toEqual([
      { to: State.Success, via: Event.Complete },
      { to: State.Error, via: Event.Fail }
    ])
  })

  it('should filter edges by event', () => {
    const graph = new Graph<State, Event>()
      .addEdge(State.Loading, State.Success, Event.Complete)
      .addEdge(State.Loading, State.Error, Event.Fail)
      .addEdge(State.Error, State.Idle, Event.Reset)

    expect(graph.getEdges(State.Loading, Event.Complete)).toEqual([
      { to: State.Success, via: Event.Complete }
    ])
    expect(graph.getEdges(State.Loading, Event.Fail)).toEqual([
      { to: State.Error, via: Event.Fail }
    ])
    expect(graph.getEdges(State.Loading, Event.Reset)).toEqual([])
  })

  it('should return empty array for non-existent states', () => {
    const graph = new Graph<State, Event>()
    expect(graph.getEdges(State.Success)).toEqual([])
    expect(graph.getEdges(State.Success, Event.Reset)).toEqual([])
  })

  it('should support method chaining', () => {
    const graph = new Graph<State, Event>()
      .addEdge(State.Idle, State.Loading, Event.Start)
      .addEdge(State.Loading, State.Success, Event.Complete)
      .addEdge(State.Loading, State.Error, Event.Fail)
      .addEdge(State.Success, State.Idle, Event.Reset)
      .addEdge(State.Error, State.Idle, Event.Reset)

    expect(graph.getEdges(State.Idle)).toHaveLength(1)
    expect(graph.getEdges(State.Loading)).toHaveLength(2)
    expect(graph.getEdges(State.Success)).toHaveLength(1)
    expect(graph.getEdges(State.Error)).toHaveLength(1)
  })
})

describe('GraphIterator', () => {
  let graph: Graph<State, Event>

  beforeEach(() => {
    graph = new Graph<State, Event>()
      .addEdge(State.Idle, State.Loading, Event.Start)
      .addEdge(State.Loading, State.Success, Event.Complete)
      .addEdge(State.Loading, State.Error, Event.Fail)
      .addEdge(State.Success, State.Idle, Event.Reset)
      .addEdge(State.Error, State.Idle, Event.Reset)
      .addEdge(State.Error, State.Loading, Event.Start)
  })

  it('should start at initial state', () => {
    const iterator = new GraphIterator(graph, State.Idle)
    expect(iterator.current).toBe(State.Idle)
  })

  it('should transition to valid states', () => {
    const iterator = new GraphIterator(graph, State.Idle)
    
    const nextState = iterator.go(Event.Start)
    expect(nextState).toBe(State.Loading)
    expect(iterator.current).toBe(State.Loading)
  })

  it('should return undefined for invalid transitions', () => {
    const iterator = new GraphIterator(graph, State.Idle)
    
    const nextState = iterator.go(Event.Complete)
    expect(nextState).toBeUndefined()
    expect(iterator.current).toBe(State.Idle) // Should stay in current state
  })

  it('should check if transitions are possible', () => {
    const iterator = new GraphIterator(graph, State.Idle)
    
    expect(iterator.can(Event.Start)).toBe(true)
    expect(iterator.can(Event.Complete)).toBe(false)
    expect(iterator.can(Event.Fail)).toBe(false)
    expect(iterator.can(Event.Reset)).toBe(false)
  })

  it('should follow a complete state flow', () => {
    const iterator = new GraphIterator(graph, State.Idle)
    
    // Start loading
    expect(iterator.go(Event.Start)).toBe(State.Loading)
    expect(iterator.current).toBe(State.Loading)
    
    // Complete successfully
    expect(iterator.go(Event.Complete)).toBe(State.Success)
    expect(iterator.current).toBe(State.Success)
    
    // Reset to idle
    expect(iterator.go(Event.Reset)).toBe(State.Idle)
    expect(iterator.current).toBe(State.Idle)
  })

  it('should handle error flow with retry', () => {
    const iterator = new GraphIterator(graph, State.Idle)
    
    // Start loading
    iterator.go(Event.Start)
    expect(iterator.current).toBe(State.Loading)
    
    // Fail
    iterator.go(Event.Fail)
    expect(iterator.current).toBe(State.Error)
    
    // Retry (start from error)
    iterator.go(Event.Start)
    expect(iterator.current).toBe(State.Loading)
    
    // This time succeed
    iterator.go(Event.Complete)
    expect(iterator.current).toBe(State.Success)
  })

  it('should handle multiple transitions correctly', () => {
    const iterator = new GraphIterator(graph, State.Loading)
    
    // From loading, we can go to success or error
    expect(iterator.can(Event.Complete)).toBe(true)
    expect(iterator.can(Event.Fail)).toBe(true)
    expect(iterator.can(Event.Start)).toBe(false)
    expect(iterator.can(Event.Reset)).toBe(false)
  })

  it('should take first available edge when multiple exist', () => {
    // Create a graph with multiple edges for the same event
    const multiGraph = new Graph<State, Event>()
      .addEdge(State.Idle, State.Loading, Event.Start)
      .addEdge(State.Idle, State.Error, Event.Start) // Second edge with same event
    
    const iterator = new GraphIterator(multiGraph, State.Idle)
    
    // Should take the first edge (to Loading)
    expect(iterator.go(Event.Start)).toBe(State.Loading)
    expect(iterator.current).toBe(State.Loading)
  })
})