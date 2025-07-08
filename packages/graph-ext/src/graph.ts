/**
 * @file State graph structure - pure data representation
 */

import { EdgeBase } from './edge.js'

/**
 * Node in the state graph
 */
export interface Node<TState extends number> {
  state: TState
  metadata?: Record<string, any> | undefined
  onEnter?: (() => void) | undefined
  onExit?: (() => void) | undefined
}

/**
 * Pure state graph structure using semantic edges
 * Represents states as nodes and transitions as semantic edges
 */
export class StateGraph<TState extends number, TEvent extends number, TContext = any> {
  private nodes = new Map<TState, Node<TState>>()
  private edges = new Map<TState, EdgeBase<TState, TEvent, TContext>[]>()
  private edgeIndex = new Map<string, EdgeBase<TState, TEvent, TContext>[]>()
  
  /**
   * Add a node to the graph
   */
  addNode(state: TState, metadata?: Record<string, any>, onEnter?: () => void, onExit?: () => void): this {
    this.nodes.set(state, { state, metadata, onEnter, onExit })
    if (!this.edges.has(state)) {
      this.edges.set(state, [])
    }
    return this
  }
  
  /**
   * Add a semantic edge to the graph
   */
  addEdge(edge: EdgeBase<TState, TEvent, TContext>): this {
    // Ensure nodes exist
    if (!this.nodes.has(edge.from)) {
      this.addNode(edge.from)
    }
    if (!this.nodes.has(edge.to)) {
      this.addNode(edge.to)
    }
    
    // Add to adjacency list
    if (!this.edges.has(edge.from)) {
      this.edges.set(edge.from, [])
    }
    this.edges.get(edge.from)!.push(edge)
    
    // Add to event index for fast lookup
    const key = `${edge.from}:${edge.event}`
    if (!this.edgeIndex.has(key)) {
      this.edgeIndex.set(key, [])
    }
    this.edgeIndex.get(key)!.push(edge)
    
    return this
  }
  
  /**
   * Get all edges from a state
   */
  getEdgesFrom(state: TState): EdgeBase<TState, TEvent, TContext>[] {
    return this.edges.get(state) || []
  }
  
  /**
   * Get edges from a state for a specific event
   */
  getEdgesForEvent(state: TState, event: TEvent): EdgeBase<TState, TEvent, TContext>[] {
    const key = `${state}:${event}`
    return this.edgeIndex.get(key) || []
  }
  
  /**
   * Get edges by type
   */
  getEdgesByType<T extends EdgeBase<TState, TEvent, TContext>>(
    edgeClass: new (...args: any[]) => T
  ): T[] {
    const result: T[] = []
    for (const edges of this.edges.values()) {
      for (const edge of edges) {
        if (edge instanceof edgeClass) {
          result.push(edge as T)
        }
      }
    }
    return result
  }
  
  /**
   * Get node
   */
  getNode(state: TState): Node<TState> | undefined {
    return this.nodes.get(state)
  }
  
  /**
   * Check if graph has a state
   */
  hasNode(state: TState): boolean {
    return this.nodes.has(state)
  }
  
  /**
   * Get all nodes
   */
  getAllNodes(): Node<TState>[] {
    return Array.from(this.nodes.values())
  }
  
  /**
   * Get all edges
   */
  getAllEdges(): EdgeBase<TState, TEvent, TContext>[] {
    const allEdges: EdgeBase<TState, TEvent, TContext>[] = []
    for (const edges of this.edges.values()) {
      allEdges.push(...edges)
    }
    return allEdges
  }
  
  /**
   * Find paths between two states (BFS)
   */
  findPaths(from: TState, to: TState, maxLength = 10): TState[][] {
    const paths: TState[][] = []
    const queue: { path: TState[], state: TState }[] = [{ path: [from], state: from }]
    
    while (queue.length > 0) {
      const { path, state } = queue.shift()!
      
      if (path.length > maxLength) continue
      
      if (state === to) {
        paths.push(path)
        continue
      }
      
      const edges = this.getEdgesFrom(state)
      for (const edge of edges) {
        if (!path.includes(edge.to)) {
          queue.push({
            path: [...path, edge.to],
            state: edge.to
          })
        }
      }
    }
    
    return paths
  }
  
  /**
   * Check if graph has cycles
   */
  hasCycles(): boolean {
    const visited = new Set<TState>()
    const recursionStack = new Set<TState>()
    
    const hasCycleDFS = (state: TState): boolean => {
      visited.add(state)
      recursionStack.add(state)
      
      const edges = this.getEdgesFrom(state)
      for (const edge of edges) {
        if (!visited.has(edge.to)) {
          if (hasCycleDFS(edge.to)) return true
        } else if (recursionStack.has(edge.to)) {
          return true
        }
      }
      
      recursionStack.delete(state)
      return false
    }
    
    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        if (hasCycleDFS(node)) return true
      }
    }
    
    return false
  }
  
  /**
   * Get graph statistics
   */
  getStats(): {
    nodeCount: number
    edgeCount: number
    edgeTypes: Record<string, number>
    avgOutDegree: number
    hasCycles: boolean
  } {
    const edgeTypes: Record<string, number> = {}
    let totalEdges = 0
    
    for (const edges of this.edges.values()) {
      totalEdges += edges.length
      for (const edge of edges) {
        const type = edge.constructor.name
        edgeTypes[type] = (edgeTypes[type] || 0) + 1
      }
    }
    
    return {
      nodeCount: this.nodes.size,
      edgeCount: totalEdges,
      edgeTypes,
      avgOutDegree: totalEdges / Math.max(1, this.nodes.size),
      hasCycles: this.hasCycles()
    }
  }
  
  /**
   * Export to DOT format for visualization
   */
  toDot(): string {
    const lines: string[] = ['digraph StateMachine {']
    
    // Add nodes
    for (const [state, node] of this.nodes) {
      const label = node.metadata?.['label'] || `State ${state}`
      lines.push(`  ${state} [label="${label}"];`)
    }
    
    // Add edges
    for (const edges of this.edges.values()) {
      for (const edge of edges) {
        const metadata = edge.getMetadata()
        const label = metadata['type'] || 'Edge'
        lines.push(`  ${edge.from} -> ${edge.to} [label="${label}"];`)
      }
    }
    
    lines.push('}')
    return lines.join('\n')
  }
}