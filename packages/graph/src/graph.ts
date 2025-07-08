/**
 * @file Minimal graph implementation - actually ultra-lean
 */

/**
 * Minimal directed graph - ~50 lines
 */
export class Graph<N extends number, E extends number> {
  private edges = new Map<N, Array<{to: N, via: E}>>()
  
  addEdge(from: N, to: N, via: E): this {
    const list = this.edges.get(from) || []
    list.push({to, via})
    this.edges.set(from, list)
    return this
  }
  
  getEdges(from: N, via?: E): Array<{to: N, via: E}> {
    const edges = this.edges.get(from) || []
    return via === undefined ? edges : edges.filter(e => e.via === via)
  }
}

/**
 * Minimal iterator - ~30 lines
 */
export class GraphIterator<N extends number, E extends number> {
  constructor(
    private graph: Graph<N, E>,
    private node: N
  ) {}
  
  get current(): N {
    return this.node
  }
  
  go(event: E): N | undefined {
    const edges = this.graph.getEdges(this.node, event)
    const firstEdge = edges[0]
    if (firstEdge) {
      this.node = firstEdge.to
      return this.node
    }
    return undefined
  }
  
  can(event: E): boolean {
    return this.graph.getEdges(this.node, event).length > 0
  }
}

/**
 * Usage:
 * 
 * const graph = new Graph<States, Events>()
 *   .addEdge(States.Idle, States.Loading, Events.Start)
 *   .addEdge(States.Loading, States.Done, Events.Complete)
 * 
 * const iter = new GraphIterator(graph, States.Idle)
 * iter.go(Events.Start) // States.Loading
 * iter.go(Events.Complete) // States.Done
 */