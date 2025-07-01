# Functional Programming with Results

Master functional programming patterns using ZeroThrow's Result types.

## Table of Contents

- [Functor Laws](#functor-laws)
- [Monad Patterns](#monad-patterns)
- [Composition Techniques](#composition-techniques)
- [Functional Pipelines](#functional-pipelines)
- [Lazy Evaluation](#lazy-evaluation)
- [Type-Safe Transformations](#type-safe-transformations)

## Functor Laws

Results follow the functor laws, making them composable and predictable.

### Identity Law

```typescript
import { ok, map } from '@flyingrobots/zerothrow';

// map(id) === id
const identity = <T>(x: T): T => x;

const result = ok(42);
const mapped = map(result, identity);

console.assert(mapped.value === result.value); // true
```

### Composition Law

```typescript
// map(f ∘ g) === map(f) ∘ map(g)
const double = (n: number) => n * 2;
const toString = (n: number) => n.toString();

const result = ok(10);

// Compose then map
const composed = map(result, (n) => toString(double(n)));

// Map then map
const mapped = map(map(result, double), toString);

console.assert(composed.value === mapped.value); // "20" === "20"
```

## Monad Patterns

Results implement the monad pattern through `andThen` (flatMap).

### Monad Laws

```typescript
import { ok, andThen } from '@flyingrobots/zerothrow';

// Left Identity: return a >>= f === f a
const value = 42;
const f = (n: number) => ok(n * 2);

const result1 = andThen(ok(value), f);
const result2 = f(value);
console.assert(result1.value === result2.value);

// Right Identity: m >>= return === m
const m = ok(42);
const result3 = andThen(m, ok);
console.assert(result3.value === m.value);

// Associativity: (m >>= f) >>= g === m >>= (λx. f x >>= g)
const g = (n: number) => ok(n + 10);
const result4 = andThen(andThen(m, f), g);
const result5 = andThen(m, (x) => andThen(f(x), g));
console.assert(result4.value === result5.value);
```

### Do-Notation Pattern

```typescript
// Simulate do-notation with async/await
async function doNotation<T, E>(
  computation: () => AsyncGenerator<Result<any, E>, T, any>
): Promise<Result<T, E>> {
  const gen = computation();
  
  async function step(value?: any): Promise<Result<T, E>> {
    const { done, value: result } = await gen.next(value);
    
    if (done) {
      return ok(result);
    }
    
    if (result.isErr) {
      return result;
    }
    
    return step(result.value);
  }
  
  return step();
}

// Usage - similar to Haskell's do-notation
const result = await doNotation(async function* () {
  const a = yield await fetchNumber();
  const b = yield await fetchNumber();
  const c = yield validate(a + b);
  return c * 2;
});
```

## Composition Techniques

### Function Composition

```typescript
// Compose Result-returning functions
function compose<A, B, C, E>(
  f: (b: B) => Result<C, E>,
  g: (a: A) => Result<B, E>
): (a: A) => Result<C, E> {
  return (a: A) => andThen(g(a), f);
}

// Kleisli composition
function kleisli<A, B, C, E>(
  f: (b: B) => Result<C, E>,
  g: (a: A) => Result<B, E>
): (a: A) => Result<C, E> {
  return (a: A) => andThen(g(a), f);
}

// Usage
const parseNumber = (s: string): Result<number, string> =>
  isNaN(Number(s)) ? err('Not a number') : ok(Number(s));

const checkPositive = (n: number): Result<number, string> =>
  n > 0 ? ok(n) : err('Must be positive');

const parsePositive = compose(checkPositive, parseNumber);
```

### Applicative Patterns

```typescript
// Apply a function inside a Result to a value inside a Result
function ap<A, B, E>(
  fnResult: Result<(a: A) => B, E>,
  valueResult: Result<A, E>
): Result<B, E> {
  return andThen(fnResult, (fn) =>
    map(valueResult, (value) => fn(value))
  );
}

// Lift a function to work with Results
function liftA2<A, B, C, E>(
  fn: (a: A, b: B) => C,
  ra: Result<A, E>,
  rb: Result<B, E>
): Result<C, E> {
  return andThen(ra, (a) =>
    map(rb, (b) => fn(a, b))
  );
}

// Usage
const add = (a: number, b: number) => a + b;
const result1 = ok(10);
const result2 = ok(20);
const sum = liftA2(add, result1, result2); // Ok(30)
```

## Functional Pipelines

### Pipe Operator

```typescript
// Create a pipe function for Results
function pipeResults<T, E>(...fns: Array<(value: any) => Result<any, E>>) {
  return (initial: T): Result<any, E> => {
    return fns.reduce(
      (result, fn) => andThen(result, fn),
      ok(initial) as Result<any, E>
    );
  };
}

// Usage
const pipeline = pipeResults(
  parseNumber,
  checkPositive,
  (n) => ok(Math.sqrt(n)),
  (n) => ok(n.toFixed(2))
);

const result = pipeline("16"); // Ok("4.00")
```

### Railway-Oriented Programming

```typescript
// Create a railway with multiple tracks
class Railway<T, E> {
  constructor(private result: Result<T, E>) {}
  
  static of<T>(value: T): Railway<T, never> {
    return new Railway(ok(value));
  }
  
  map<U>(fn: (value: T) => U): Railway<U, E> {
    return new Railway(map(this.result, fn));
  }
  
  flatMap<U>(fn: (value: T) => Result<U, E>): Railway<U, E> {
    return new Railway(andThen(this.result, fn));
  }
  
  mapError<F>(fn: (error: E) => F): Railway<T, F> {
    return new Railway(mapErr(this.result, fn));
  }
  
  tee(fn: (value: T) => void): Railway<T, E> {
    if (this.result.isOk) {
      fn(this.result.value);
    }
    return this;
  }
  
  validate(predicate: (value: T) => boolean, error: E): Railway<T, E> {
    return this.flatMap(value =>
      predicate(value) ? ok(value) : err(error)
    );
  }
  
  recover(fn: (error: E) => Result<T, E>): Railway<T, E> {
    return new Railway(orElse(this.result, fn));
  }
  
  get(): Result<T, E> {
    return this.result;
  }
}

// Usage
const result = Railway.of("10")
  .flatMap(parseNumber)
  .validate(n => n > 0, "Must be positive")
  .map(n => n * 2)
  .tee(n => console.log(`Doubled: ${n}`))
  .map(n => n.toString())
  .get();
```

## Lazy Evaluation

### Lazy Results

```typescript
// Defer computation until needed
class LazyResult<T, E> {
  private cached?: Result<T, E>;
  
  constructor(private computation: () => Result<T, E>) {}
  
  static of<T>(value: T): LazyResult<T, never> {
    return new LazyResult(() => ok(value));
  }
  
  static defer<T, E>(computation: () => Result<T, E>): LazyResult<T, E> {
    return new LazyResult(computation);
  }
  
  map<U>(fn: (value: T) => U): LazyResult<U, E> {
    return new LazyResult(() => {
      const result = this.force();
      return map(result, fn);
    });
  }
  
  flatMap<U>(fn: (value: T) => Result<U, E>): LazyResult<U, E> {
    return new LazyResult(() => {
      const result = this.force();
      return andThen(result, fn);
    });
  }
  
  force(): Result<T, E> {
    if (!this.cached) {
      this.cached = this.computation();
    }
    return this.cached;
  }
}

// Usage
const expensive = LazyResult.defer(() => {
  console.log('Computing...');
  return ok(expensiveComputation());
});

// Computation hasn't run yet
const transformed = expensive
  .map(n => n * 2)
  .map(n => n + 1);

// Computation runs here
const result = transformed.force();
```

### Stream Processing

```typescript
// Process streams of Results
class ResultStream<T, E> {
  constructor(private source: AsyncIterable<Result<T, E>>) {}
  
  async *map<U>(fn: (value: T) => U): AsyncIterable<Result<U, E>> {
    for await (const result of this.source) {
      yield map(result, fn);
    }
  }
  
  async *filter(predicate: (value: T) => boolean): AsyncIterable<Result<T, E>> {
    for await (const result of this.source) {
      if (result.isOk && predicate(result.value)) {
        yield result;
      } else if (result.isErr) {
        yield result;
      }
    }
  }
  
  async *flatMap<U>(
    fn: (value: T) => AsyncIterable<Result<U, E>>
  ): AsyncIterable<Result<U, E>> {
    for await (const result of this.source) {
      if (result.isOk) {
        yield* fn(result.value);
      } else {
        yield result as any;
      }
    }
  }
  
  async collect(): Promise<Result<T[], E>> {
    const values: T[] = [];
    
    for await (const result of this.source) {
      if (result.isErr) {
        return result as any;
      }
      values.push(result.value);
    }
    
    return ok(values);
  }
}

// Usage
async function* fetchPages(): AsyncIterable<Result<Page, Error>> {
  let page = 1;
  while (page <= 10) {
    yield await tryR(() => fetchPage(page));
    page++;
  }
}

const stream = new ResultStream(fetchPages());
const processed = await stream
  .map(page => page.data)
  .filter(data => data.length > 0)
  .collect();
```

## Type-Safe Transformations

### Phantom Types

```typescript
// Use phantom types for compile-time guarantees
interface Validated<T> {
  _validated: never;
  value: T;
}

interface Sanitized<T> {
  _sanitized: never;
  value: T;
}

function validate<T>(value: T): Result<Validated<T>, string> {
  // Validation logic
  return ok({ value } as Validated<T>);
}

function sanitize<T>(validated: Validated<T>): Result<Sanitized<T>, string> {
  // Can only sanitize validated data
  return ok({ value: validated.value } as Sanitized<T>);
}

// Type-safe pipeline
const pipeline = (input: string) =>
  andThen(
    validate(input),
    sanitize
  );
```

### Tagged Types

```typescript
// Tag Results with type-level information
type Tagged<T, Tag extends string> = T & { _tag: Tag };

function tag<T, Tag extends string>(
  value: T,
  _tag: Tag
): Tagged<T, Tag> {
  return value as Tagged<T, Tag>;
}

// Domain-specific Results
type UserData = Tagged<{ id: string; name: string }, 'user'>;
type PostData = Tagged<{ id: string; title: string }, 'post'>;

function fetchUser(id: string): Result<UserData, Error> {
  return ok(tag({ id, name: 'John' }, 'user'));
}

function fetchPost(id: string): Result<PostData, Error> {
  return ok(tag({ id, title: 'Hello' }, 'post'));
}

// Type-safe processing
function processUser(data: UserData): string {
  return `User: ${data.name}`;
}

function processPost(data: PostData): string {
  return `Post: ${data.title}`;
}
```

### Advanced Type Inference

```typescript
// Infer types through transformations
type InferSuccess<R> = R extends Result<infer T, any> ? T : never;
type InferError<R> = R extends Result<any, infer E> ? E : never;

// Transform tuple of Results to Result of tuple
type TupleToResult<T extends readonly Result<any, any>[]> = 
  Result<
    { [K in keyof T]: InferSuccess<T[K]> },
    InferError<T[number]>
  >;

function sequence<T extends readonly Result<any, any>[]>(
  ...results: T
): TupleToResult<T> {
  const values = [];
  
  for (const result of results) {
    if (result.isErr) {
      return result as any;
    }
    values.push(result.value);
  }
  
  return ok(values) as any;
}

// Usage with type inference
const r1 = ok(42);
const r2 = ok('hello');
const r3 = ok(true);

const combined = sequence(r1, r2, r3);
// Type: Result<[number, string, boolean], never>
```

## Next Steps

- Learn [testing strategies](./05-testing.md)
- Explore [migration from other libraries](../guides/migration-guide.md)
- Study [performance optimization](../guides/performance.md)
- See [advanced examples](../examples/)