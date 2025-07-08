# @zerothrow/graph-ext

Extended features for [@zerothrow/graph](../graph) including semantic edges, observable iterators, state machine builders, and more.

## Installation

```bash
pnpm add @zerothrow/graph-ext
```

## Features

- 🎯 **Semantic Edges**: Edges that carry behavior (timing, retries, context updates)
- 🔄 **Advanced Iterators**: Observable, polling, and custom traversal strategies
- 🏗️ **Builder APIs**: Multiple ways to construct state machines
- 🎨 **Visualization**: Export graphs to DOT format
- 📊 **Analysis**: Path finding, cycle detection, statistics

## Semantic Edge Types

```typescript
import { 
  SimpleEdge,
  ContextEdge,
  TimedEdge,
  RetryEdge,
  ProbabilisticEdge,
  EdgeBase,
  StateGraph,
  StateIterator
} from '@zerothrow/graph-ext'

// Create a graph with semantic edges
const graph = new StateGraph<State, Event, Context>()

// Simple edge with guard
graph.addEdge(new SimpleEdge(
  State.Login, 
  State.Dashboard, 
  Event.Submit,
  (ctx) => ctx.isAuthenticated
))

// Edge that updates context
graph.addEdge(new ContextEdge(
  State.Counter,
  State.Counter,
  Event.Increment,
  undefined, // no guard
  (ctx) => ({ ...ctx, count: ctx.count + 1 })
))

// Timed edge (rate limiting)
graph.addEdge(new TimedEdge(
  State.Ready,
  State.Loading,
  Event.Call,
  1000, // min 1 second between calls
  5000  // max 5 seconds (timeout)
))

// Custom edge type
class AuthorizedEdge extends EdgeBase<State, Event, Context> {
  canTraverse(context: Context): boolean {
    return context.user?.role === this.requiredRole
  }
  
  onTraverse(context: Context): Context {
    return { ...context, lastAuth: new Date() }
  }
}
```

## State Machine Builders

### Fluent Builder

```typescript
import { createStateMachine } from '@zerothrow/graph-ext'

const { machine, triggers } = createStateMachine<State, Event, Context>()
  .initialState(State.Idle)
  .withContext({ retryCount: 0 })
  .addTransition(Event.Start)
    .from(State.Idle)
    .toWhen(State.Loading, (ctx) => ctx.canLoad)
    .toWhen(State.Error, (ctx) => !ctx.canLoad)
  .onTransition(State.Loading, State.Success, (from, to, event) => {
    console.log('Success!')
  })
  .createTrigger('start', State.Idle, State.Loading, Event.Start)
  .buildWithTriggers()
```

### Natural Language Builder

```typescript
import { stateMachine } from '@zerothrow/graph-ext'

const machine = stateMachine<State, Event>()
  .startingAt(State.Idle)
  .where(State.Idle).on(Event.Start).leadsTo(State.Loading)
  .where(State.Loading).on(Event.Success).leadsTo(State.Done)
  .create()
```

## Observable Iterators

```typescript
const iterator = new StateIterator(graph, State.Idle, { count: 0 })

// Subscribe to state changes
iterator.onStateChange((from, to, context) => {
  console.log(`${from} -> ${to}`, context)
})

// Subscribe to edge traversals
iterator.onEdgeTraversal((edge, context) => {
  console.log(`Traversed ${edge.constructor.name}`)
})

// Polling iterator
const polling = new PollingIterator(graph, State.Idle, {})
polling.addCondition((ctx, state) => {
  if (state === State.Idle && ctx.ready) {
    return Event.Start
  }
})
polling.startPolling(1000) // Check every second
```

## See Also

- [@zerothrow/graph](../graph) - Core graph package
- [@zerothrow/graph-algorithms](../graph-algorithms) - Graph algorithms

## License

MIT