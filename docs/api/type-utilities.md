# Type Utilities

Advanced TypeScript type utilities for working with Result types.

## Type Extraction

### ResultValue<T>

Extracts the success value type from a Result.

```typescript
type ResultValue<T> = T extends Result<infer V, any> ? V : never;

// Examples
type R1 = Result<string, Error>;
type V1 = ResultValue<R1>; // string

type R2 = Result<{ id: number; name: string }, ValidationError>;
type V2 = ResultValue<R2>; // { id: number; name: string }

// Usage
function processResult<R extends Result<any, any>>(
  result: R
): ResultValue<R> | null {
  return result.isOk ? result.value : null;
}
```

### ResultError<T>

Extracts the error type from a Result.

```typescript
type ResultError<T> = T extends Result<any, infer E> ? E : never;

// Examples
type R1 = Result<string, Error>;
type E1 = ResultError<R1>; // Error

type R2 = Result<User, ZeroError<{ field: string }>>;
type E2 = ResultError<R2>; // ZeroError<{ field: string }>

// Usage
function getErrorCode<R extends Result<any, ZeroError>>(
  result: R
): ErrorCode | undefined {
  return result.isErr ? result.error.code : undefined;
}
```

## Type Guards

### Custom Type Guards

```typescript
// Check if value is a Result
function isResult<T = unknown, E = unknown>(
  value: unknown
): value is Result<T, E> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'isOk' in value &&
    'isErr' in value &&
    ((value as any).isOk === true || (value as any).isErr === true)
  );
}

// Check if Result contains specific value type
function isResultOf<T>(
  value: unknown,
  guard: (v: unknown) => v is T
): value is Result<T, unknown> {
  return isResult(value) && value.isOk && guard(value.value);
}

// Usage
const result: unknown = await fetchData();

if (isResult(result)) {
  // TypeScript knows it's a Result
  if (result.isOk) {
    console.log(result.value);
  }
}

// With specific type guard
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value;
}

if (isResultOf(result, isUser)) {
  // TypeScript knows it's Result<User, unknown> and isOk
  console.log(result.value.id); // Safe access
}
```

### Error Type Guards

```typescript
// Check for specific error types
function hasErrorCode<C extends ErrorCode>(
  error: unknown,
  code: C
): error is ZeroError<any> & { code: C } {
  return error instanceof ZeroError && error.code === code;
}

// Check for error context shape
function hasErrorContext<C extends ErrorContext>(
  error: unknown,
  check: (ctx: unknown) => ctx is C
): error is ZeroError<C> {
  return (
    error instanceof ZeroError &&
    error.context !== undefined &&
    check(error.context)
  );
}

// Usage
const result = await tryOperation();

if (result.isErr && hasErrorCode(result.error, 'VALIDATION_ERROR')) {
  // TypeScript knows error.code is 'VALIDATION_ERROR'
  handleValidationError(result.error);
}
```

## Utility Types

### AsyncResult<T, E>

Type alias for Promise of Result.

```typescript
type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Usage
function fetchData(): AsyncResult<Data, NetworkError> {
  return tryR(
    () => api.getData(),
    (e) => new NetworkError(e)
  );
}

// With function signatures
interface DataService {
  getUser(id: string): AsyncResult<User>;
  updateUser(id: string, data: Partial<User>): AsyncResult<User>;
  deleteUser(id: string): AsyncResult<void>;
}
```

### ResultFromPromise<P>

Converts a Promise type to a Result type.

```typescript
type ResultFromPromise<P> = P extends Promise<infer T>
  ? Result<T, Error>
  : never;

// Examples
type P1 = Promise<string>;
type R1 = ResultFromPromise<P1>; // Result<string, Error>

type P2 = Promise<User | null>;
type R2 = ResultFromPromise<P2>; // Result<User | null, Error>

// Usage with tryR
async function wrapPromise<P extends Promise<any>>(
  promise: P
): Promise<ResultFromPromise<P>> {
  return tryR(() => promise) as Promise<ResultFromPromise<P>>;
}
```

### UnwrapResult<R>

Recursively unwraps nested Results.

```typescript
type UnwrapResult<R> = R extends Result<infer T, infer E>
  ? T extends Result<any, any>
    ? UnwrapResult<T>
    : Result<T, E>
  : R;

// Examples
type Nested = Result<Result<Result<string, Error>, Error>, Error>;
type Unwrapped = UnwrapResult<Nested>; // Result<string, Error>

// Utility function
function flatten<R extends Result<any, any>>(
  result: R
): UnwrapResult<R> {
  if (!result.isOk) return result as any;
  
  let current = result.value;
  while (isResult(current) && current.isOk) {
    current = current.value;
  }
  
  return isResult(current) ? current : ok(current);
}
```

## Mapped Types

### ResultRecord<K, V, E>

Record where all values are Results.

```typescript
type ResultRecord<K extends PropertyKey, V, E = Error> = {
  [P in K]: Result<V, E>;
};

// Usage
type ValidationResults = ResultRecord<
  'email' | 'password' | 'username',
  string,
  ValidationError
>;

const results: ValidationResults = {
  email: validateEmail(data.email),
  password: validatePassword(data.password),
  username: validateUsername(data.username)
};
```

### PartialResult<T, E>

Makes all properties of T optional Results.

```typescript
type PartialResult<T, E = Error> = {
  [P in keyof T]?: Result<T[P], E>;
};

// Usage
interface User {
  id: number;
  name: string;
  email: string;
}

type UserUpdate = PartialResult<User, ValidationError>;

const updates: UserUpdate = {
  name: validateName(input.name),
  email: input.email ? validateEmail(input.email) : undefined
};
```

## Conditional Types

### ResultOr<T, E, F>

Result that falls back to a different type on error.

```typescript
type ResultOr<T, E, F> = Result<T, E> extends { isOk: true }
  ? T
  : F;

// Helper function
function resultOr<T, E, F>(
  result: Result<T, E>,
  fallback: F
): T | F {
  return result.isOk ? result.value : fallback;
}

// Usage
const config = resultOr(
  await loadConfig(),
  defaultConfig
);
```

### InferResultTypes<F>

Infers Result types from function signatures.

```typescript
type InferResultTypes<F> = F extends (...args: any[]) => Result<infer T, infer E>
  ? { value: T; error: E }
  : F extends (...args: any[]) => Promise<Result<infer T, infer E>>
  ? { value: T; error: E }
  : never;

// Examples
function sync(): Result<string, Error> { /* ... */ }
type SyncTypes = InferResultTypes<typeof sync>; 
// { value: string; error: Error }

async function async(): Promise<Result<number, ValidationError>> { /* ... */ }
type AsyncTypes = InferResultTypes<typeof async>;
// { value: number; error: ValidationError }

// Usage in generic functions
function handleResult<F extends (...args: any[]) => any>(
  fn: F,
  onSuccess: (value: InferResultTypes<F>['value']) => void,
  onError: (error: InferResultTypes<F>['error']) => void
) {
  // Implementation
}
```

## Advanced Patterns

### Result Transformers

```typescript
// Transform between Result types
type ResultTransformer<T1, E1, T2, E2> = (
  result: Result<T1, E1>
) => Result<T2, E2>;

// Bi-directional transformer
interface ResultCodec<T1, E1, T2, E2> {
  encode: ResultTransformer<T1, E1, T2, E2>;
  decode: ResultTransformer<T2, E2, T1, E1>;
}

// Example: JSON codec
const jsonCodec: ResultCodec<any, Error, string, Error> = {
  encode: (result) =>
    result.isOk
      ? tryR(() => JSON.stringify(result.value))
      : err(result.error),
  
  decode: (result) =>
    result.isOk
      ? tryR(() => JSON.parse(result.value))
      : err(result.error)
};
```

### Result Predicates

```typescript
// Type predicate for Result refinement
type ResultPredicate<T, E, U extends T> = (
  result: Result<T, E>
) => result is Result<U, E>;

// Create predicate from value predicate
function resultWhere<T, E, U extends T>(
  predicate: (value: T) => value is U
): ResultPredicate<T, E, U> {
  return (result): result is Result<U, E> =>
    result.isOk && predicate(result.value);
}

// Usage
function isNonEmptyString(s: string): s is string & { length: number } {
  return s.length > 0;
}

const result: Result<string, Error> = ok('hello');

if (resultWhere(isNonEmptyString)(result)) {
  // TypeScript knows result.value has length > 0
  console.log(result.value.charAt(0)); // Safe
}
```

### Tagged Results

```typescript
// Add metadata to Results
interface TaggedResult<T, E, Tag extends string> extends Result<T, E> {
  tag: Tag;
}

function tagResult<T, E, Tag extends string>(
  result: Result<T, E>,
  tag: Tag
): TaggedResult<T, E, Tag> {
  return { ...result, tag };
}

// Usage with discriminated unions
type ApiResult =
  | TaggedResult<User, Error, 'user'>
  | TaggedResult<Post[], Error, 'posts'>
  | TaggedResult<Comment[], Error, 'comments'>;

function handleApiResult(result: ApiResult) {
  switch (result.tag) {
    case 'user':
      // TypeScript knows this is Result<User, Error>
      break;
    case 'posts':
      // TypeScript knows this is Result<Post[], Error>
      break;
    case 'comments':
      // TypeScript knows this is Result<Comment[], Error>
      break;
  }
}
```

## Generic Constraints

### Constraining Result Types

```typescript
// Ensure Result has specific error type
type StrictResult<T, E extends Error = Error> = Result<T, E>;

// Ensure Result value extends base type
type DerivedResult<T extends BaseType, E = Error> = Result<T, E>;

// Mutual constraints
type MappedResult<T extends object, E extends ZeroError> = Result<
  { [K in keyof T]: T[K] },
  E
>;

// Usage in functions
function processStrictResult<T>(
  result: StrictResult<T>
): T | null {
  return result.isOk ? result.value : null;
}

function requireBaseType<T extends BaseType>(
  fn: () => DerivedResult<T>
): DerivedResult<T> {
  return fn();
}
```

## Type-Safe Builders

```typescript
// Result builder with type inference
class ResultBuilder<T = unknown, E = unknown> {
  static ok<T>(value: T): ResultBuilder<T, never> {
    return new ResultBuilder(ok(value));
  }

  static err<E>(error: E): ResultBuilder<never, E> {
    return new ResultBuilder(err(error));
  }

  constructor(private result: Result<T, E>) {}

  map<U>(fn: (value: T) => U): ResultBuilder<U, E> {
    return new ResultBuilder(
      this.result.isOk ? ok(fn(this.result.value)) : this.result
    );
  }

  mapErr<F>(fn: (error: E) => F): ResultBuilder<T, F> {
    return new ResultBuilder(
      this.result.isErr ? err(fn(this.result.error)) : this.result
    );
  }

  build(): Result<T, E> {
    return this.result;
  }
}

// Usage
const result = ResultBuilder
  .ok(42)
  .map(n => n * 2)
  .map(n => n.toString())
  .mapErr(e => new Error(e))
  .build(); // Result<string, Error>
```

## Next Steps

- [Explore tutorials](../tutorials/)
- [Learn migration strategies](../guides/migration-guide.md)
- [See practical examples](../examples/)