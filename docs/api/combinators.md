# Combinators

Powerful functional combinators for composing and transforming Result types.

## Overview

Combinators enable functional programming patterns with Result types, allowing you to chain operations, transform values, and handle errors in a composable way.

## andThen

Chains operations that return Results (flatMap/bind).

### Signature

```typescript
function andThen<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E>
```

### Description

Applies a function to the success value that returns a new Result. If the original Result is an error, it's passed through unchanged.

### Examples

```typescript
import { ok, err, andThen } from '@flyingrobots/zerothrow';

// Basic chaining
const result = ok(5);
const doubled = andThen(result, (n) => ok(n * 2)); // Ok(10)

// Error propagation
const error = err('failed');
const chain = andThen(error, (n) => ok(n * 2)); // Err('failed')

// Validation chain
function validateAge(age: number): Result<number, string> {
  if (age < 0) return err('Age cannot be negative');
  if (age > 150) return err('Age seems unrealistic');
  return ok(age);
}

function validateAdult(age: number): Result<number, string> {
  if (age < 18) return err('Must be 18 or older');
  return ok(age);
}

const ageResult = ok(25);
const validated = andThen(
  andThen(ageResult, validateAge),
  validateAdult
); // Ok(25)
```

### Real-World Example

```typescript
function fetchUser(id: string): Promise<Result<User, ZeroError>> {
  return tryR(() => api.getUser(id));
}

function fetchUserPosts(user: User): Promise<Result<Post[], ZeroError>> {
  return tryR(() => api.getUserPosts(user.id));
}

async function getUserWithPosts(id: string): Promise<Result<UserWithPosts, ZeroError>> {
  const userResult = await fetchUser(id);
  
  const postsResult = await andThen(userResult, async (user) => {
    const posts = await fetchUserPosts(user);
    return posts.isOk 
      ? ok({ ...user, posts: posts.value })
      : posts;
  });
  
  return postsResult;
}
```

## map

Transforms the success value while preserving errors.

### Signature

```typescript
function map<T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E>
```

### Description

Applies a function to transform the success value. If the Result is an error, it's passed through unchanged.

### Examples

```typescript
import { ok, err, map } from '@flyingrobots/zerothrow';

// Transform success
const num = ok(5);
const str = map(num, (n) => n.toString()); // Ok('5')

// Error passthrough
const error = err('failed');
const mapped = map(error, (n) => n * 2); // Err('failed')

// Object transformation
const user = ok({ name: 'Alice', age: 30 });
const userName = map(user, (u) => u.name); // Ok('Alice')

// Chaining maps
const result = ok(10);
const final = map(
  map(
    map(result, (n) => n * 2),
    (n) => n + 1
  ),
  (n) => n.toString()
); // Ok('21')
```

### Practical Examples

```typescript
// DTO transformation
interface UserDTO {
  user_name: string;
  user_age: number;
}

interface User {
  name: string;
  age: number;
}

function toUser(dto: UserDTO): User {
  return {
    name: dto.user_name,
    age: dto.user_age
  };
}

const dtoResult = await tryR(() => fetchUserDTO(id));
const userResult = map(dtoResult, toUser);

// Computed properties
const order = ok({ items: [10, 20, 30], tax: 0.08 });
const withTotal = map(order, (o) => ({
  ...o,
  subtotal: o.items.reduce((a, b) => a + b, 0),
  total: o.items.reduce((a, b) => a + b, 0) * (1 + o.tax)
}));
```

## mapErr

Transforms the error value while preserving success.

### Signature

```typescript
function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F>
```

### Description

Applies a function to transform the error value. If the Result is successful, it's passed through unchanged.

### Examples

```typescript
import { ok, err, mapErr } from '@flyingrobots/zerothrow';

// Transform error
const error = err('network failure');
const enhanced = mapErr(error, (e) => ({
  message: e,
  code: 'NETWORK_ERROR',
  timestamp: Date.now()
}));

// Success passthrough
const success = ok(42);
const unchanged = mapErr(success, (e) => 'transformed'); // Ok(42)

// Error enhancement
const result = err(new Error('Connection timeout'));
const zeroError = mapErr(result, (e) => 
  wrap(e, 'TIMEOUT', 'Operation timed out', { retry: true })
);
```

### Error Normalization Pattern

```typescript
type AppError = 
  | { type: 'validation'; fields: string[] }
  | { type: 'network'; status?: number }
  | { type: 'unknown'; message: string };

function normalizeError(error: unknown): AppError {
  if (error instanceof ValidationError) {
    return { type: 'validation', fields: error.fields };
  }
  if (error instanceof NetworkError) {
    return { type: 'network', status: error.status };
  }
  return { type: 'unknown', message: String(error) };
}

const result = await tryR(() => riskyOperation());
const normalized = mapErr(result, normalizeError);
```

## orElse

Provides a fallback for error cases.

### Signature

```typescript
function orElse<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F>
```

### Description

If the Result is an error, applies a function that returns a new Result. Useful for recovery strategies.

### Examples

```typescript
import { ok, err, orElse } from '@flyingrobots/zerothrow';

// Fallback value
const error = err('not found');
const withDefault = orElse(error, () => ok('default value')); // Ok('default value')

// Try alternative
async function fetchFromPrimary(): Promise<Result<Data, Error>> {
  return tryR(() => primaryApi.getData());
}

async function fetchFromSecondary(): Promise<Result<Data, Error>> {
  return tryR(() => secondaryApi.getData());
}

const data = await fetchFromPrimary();
const final = await orElse(data, async () => {
  console.log('Primary failed, trying secondary...');
  return fetchFromSecondary();
});

// Retry pattern
function withRetry<T>(
  fn: () => Promise<Result<T, Error>>,
  retries: number
): Promise<Result<T, Error>> {
  return fn().then(result =>
    orElse(result, async (error) => {
      if (retries > 0) {
        console.log(`Retrying... ${retries} attempts left`);
        return withRetry(fn, retries - 1);
      }
      return err(error);
    })
  );
}
```

## unwrapOr

Extracts the value or returns a default.

### Signature

```typescript
function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T
```

### Description

Returns the success value if present, otherwise returns the provided default value.

### Examples

```typescript
import { ok, err, unwrapOr } from '@flyingrobots/zerothrow';

// Success case
const success = ok(42);
const value1 = unwrapOr(success, 0); // 42

// Error case
const error = err('failed');
const value2 = unwrapOr(error, 0); // 0

// With objects
const userResult = err('User not found');
const user = unwrapOr(userResult, { name: 'Guest', id: 0 });

// Configuration pattern
const configResult = await tryR(() => loadConfig());
const config = unwrapOr(configResult, {
  host: 'localhost',
  port: 3000,
  debug: false
});
```

## unwrapOrThrow

Extracts the value or throws an error.

### Signature

```typescript
function unwrapOrThrow<T, E>(result: Result<T, E>): T
```

### Description

Returns the success value if present, otherwise throws the error. Use sparingly at system boundaries.

### Examples

```typescript
import { ok, err, unwrapOrThrow } from '@flyingrobots/zerothrow';

// Success case
const success = ok(42);
const value = unwrapOrThrow(success); // 42

// Error case
const error = err(new Error('Failed'));
try {
  const value = unwrapOrThrow(error); // Throws
} catch (e) {
  console.error('Operation failed:', e);
}

// At system boundaries
app.get('/user/:id', async (req, res) => {
  try {
    const result = await fetchUser(req.params.id);
    const user = unwrapOrThrow(result);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## pipe

Composes multiple operations on Results.

### Signature

```typescript
function pipe<T, E>(
  value: T,
  ...fns: Array<(value: any) => Result<any, E>>
): Result<any, E>
```

### Description

Applies a series of functions in sequence, short-circuiting on the first error.

### Examples

```typescript
import { pipe, ok } from '@flyingrobots/zerothrow';

// Validation pipeline
const validate = pipe(
  { email: 'user@example.com', age: 25 },
  (data) => data.email.includes('@') ? ok(data) : err('Invalid email'),
  (data) => data.age >= 18 ? ok(data) : err('Must be 18+'),
  (data) => ok({ ...data, validated: true })
);

// Data processing pipeline
function processOrder(orderData: OrderInput): Result<Order, ZeroError> {
  return pipe(
    orderData,
    validateOrderData,
    calculateTotals,
    applyDiscounts,
    addShipping,
    finalizeOrder
  );
}

// Async pipeline
async function uploadFile(file: File): Promise<Result<UploadResult, Error>> {
  return pipe(
    file,
    validateFile,
    async (f) => tryR(() => compressFile(f)),
    async (f) => tryR(() => uploadToS3(f)),
    async (url) => ok({ url, timestamp: Date.now() })
  );
}
```

## collect

Converts an array of Results into a Result of an array.

### Signature

```typescript
function collect<T, E>(results: Result<T, E>[]): Result<T[], E>
```

### Description

If all Results are successful, returns Ok with an array of values. If any Result is an error, returns the first error.

### Examples

```typescript
import { collect, ok, err } from '@flyingrobots/zerothrow';

// All success
const results1 = [ok(1), ok(2), ok(3)];
const collected1 = collect(results1); // Ok([1, 2, 3])

// Contains error
const results2 = [ok(1), err('failed'), ok(3)];
const collected2 = collect(results2); // Err('failed')

// Parallel operations
async function fetchAllUsers(ids: string[]): Promise<Result<User[], ZeroError>> {
  const results = await Promise.all(
    ids.map(id => fetchUser(id))
  );
  return collect(results);
}

// Validation collection
function validateFields(data: FormData): Result<ValidatedData, ValidationError> {
  const validations = [
    validateEmail(data.email),
    validatePassword(data.password),
    validateAge(data.age)
  ];
  
  return collect(validations).map(([email, password, age]) => ({
    email,
    password,
    age
  }));
}
```

## firstSuccess

Returns the first successful Result from an array.

### Signature

```typescript
function firstSuccess<T, E>(results: Result<T, E>[]): Result<T, E[]>
```

### Description

Tries each Result in order, returning the first success. If all fail, returns an error with all errors.

### Examples

```typescript
import { firstSuccess, ok, err } from '@flyingrobots/zerothrow';

// Has success
const results1 = [err('failed1'), ok(42), err('failed2')];
const first1 = firstSuccess(results1); // Ok(42)

// All failures
const results2 = [err('failed1'), err('failed2'), err('failed3')];
const first2 = firstSuccess(results2); // Err(['failed1', 'failed2', 'failed3'])

// Fallback strategies
async function loadConfig(): Promise<Result<Config, Error>> {
  const strategies = [
    () => tryR(() => loadFromEnv()),
    () => tryR(() => loadFromFile('./config.json')),
    () => tryR(() => loadFromFile('./config.default.json')),
    () => ok(getDefaultConfig())
  ];
  
  const results = await Promise.all(strategies.map(fn => fn()));
  return firstSuccess(results);
}

// API fallbacks
async function fetchDataWithFallbacks(id: string): Promise<Result<Data, Error[]>> {
  const sources = [
    fetchFromCache(id),
    fetchFromPrimary(id),
    fetchFromSecondary(id),
    fetchFromArchive(id)
  ];
  
  return firstSuccess(await Promise.all(sources));
}
```

## Advanced Patterns

### Custom Combinators

```typescript
// Conditional execution
function when<T, E>(
  condition: boolean,
  fn: () => Result<T, E>
): Result<T | undefined, E> {
  return condition ? fn() : ok(undefined);
}

// Timeout wrapper
async function withTimeout<T, E>(
  promise: Promise<Result<T, E>>,
  ms: number
): Promise<Result<T, E | Error>> {
  const timeout = new Promise<Result<T, Error>>(resolve =>
    setTimeout(() => resolve(err(new Error('Timeout'))), ms)
  );
  
  return Promise.race([promise, timeout]);
}

// Memoization
function memoizeResult<T, E>(
  fn: () => Result<T, E>
): () => Result<T, E> {
  let cached: Result<T, E> | undefined;
  
  return () => {
    if (!cached || cached.isErr) {
      cached = fn();
    }
    return cached;
  };
}
```

## Next Steps

- [Explore React integration](./react.md)
- [Configure ESLint rules](./eslint.md)
- [See practical examples](../examples/)