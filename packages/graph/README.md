# @zerothrow/graph

Ultra-lean directed graph traversal for TypeScript. ~1KB minified, zero dependencies.

## Installation

```bash
pnpm add @zerothrow/graph
```

## Usage

```typescript
import { Graph, GraphIterator } from '@zerothrow/graph'

// Define your nodes and edges as enums
enum State {
  Idle,
  Loading,
  Success,
  Error
}

enum Event {
  Start,
  Complete,
  Fail,
  Reset
}

// Create a graph
const graph = new Graph<State, Event>()
  .addEdge(State.Idle, State.Loading, Event.Start)
  .addEdge(State.Loading, State.Success, Event.Complete)
  .addEdge(State.Loading, State.Error, Event.Fail)
  .addEdge(State.Success, State.Idle, Event.Reset)
  .addEdge(State.Error, State.Idle, Event.Reset)

// Create an iterator
const iter = new GraphIterator(graph, State.Idle)

// Traverse the graph
iter.go(Event.Start)     // State.Loading
iter.current             // State.Loading
iter.can(Event.Complete) // true
iter.go(Event.Complete)  // State.Success
iter.go(Event.Reset)     // State.Idle
```

## API

### Graph<N, E>
- `addEdge(from: N, to: N, via: E): this` - Add an edge
- `getEdges(from: N, via?: E): Array<{to: N, via: E}>` - Get outgoing edges

### GraphIterator<N, E>
- `current: N` - Current node
- `go(event: E): N | undefined` - Traverse via event
- `can(event: E): boolean` - Check if event is valid

## Extended Features

For advanced features like semantic edges, observable iterators, and state machine builders, see [@zerothrow/graph-ext](../graph-ext).

## License

MIT