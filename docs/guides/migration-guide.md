# Migration Guide

Migrate your codebase to ZeroThrow from try/catch or other error handling libraries.

## Table of Contents

- [From try/catch](#from-trycatch)
- [From neverthrow](#from-neverthrow)
- [From fp-ts](#from-fp-ts)
- [Gradual Migration Strategy](#gradual-migration-strategy)
- [Common Patterns](#common-patterns)

## From try/catch

### Basic Functions

```typescript
// Before: try/catch
function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
}

// After: ZeroThrow
import { Result, ok, err, tryR } from '@flyingrobots/zerothrow';

function parseJson(text: string): Result<any, Error> {
  try {
    return ok(JSON.parse(text));
  } catch (error) {
    return err(new Error(`Failed to parse JSON: ${error.message}`));
  }
}

// Or using tryR
async function parseJsonAsync(text: string): Promise<Result<any, Error>> {
  return tryR(() => JSON.parse(text));
}
```

### Async Functions

```typescript
// Before: try/catch
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
}

// After: ZeroThrow
import { Result, tryR, wrap, ZeroError } from '@flyingrobots/zerothrow';

async function fetchUser(id: string): Promise<Result<User, ZeroError>> {
  return tryR(
    async () => {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    },
    (error) => wrap(error, 'FETCH_USER_FAILED', 'Failed to fetch user', { userId: id })
  );
}
```

### Error Propagation

```typescript
// Before: try/catch
function processData(input: string): ProcessedData {
  const parsed = parseJson(input); // might throw
  const validated = validate(parsed); // might throw
  const transformed = transform(validated); // might throw
  return transformed;
}

// After: ZeroThrow
import { Result, andThen } from '@flyingrobots/zerothrow';

function processData(input: string): Result<ProcessedData, Error> {
  const parsed = parseJson(input);
  if (parsed.isErr) return parsed;
  
  const validated = validate(parsed.value);
  if (validated.isErr) return validated;
  
  const transformed = transform(validated.value);
  return transformed;
}

// Or using andThen
function processDataFunctional(input: string): Result<ProcessedData, Error> {
  return andThen(
    andThen(
      parseJson(input),
      validate
    ),
    transform
  );
}
```

## From neverthrow

ZeroThrow is API-compatible with many neverthrow patterns:

```typescript
// neverthrow
import { Result, ok, err } from 'neverthrow';

const result = ok(42)
  .map(x => x * 2)
  .mapErr(e => `Error: ${e}`);

// ZeroThrow (same API)
import { Result, ok, err, map, mapErr } from '@flyingrobots/zerothrow';

const result = mapErr(
  map(ok(42), x => x * 2),
  e => `Error: ${e}`
);
```

### Key Differences

1. **Error Context**: ZeroThrow uses native Error.cause
```typescript
// neverthrow
const error = err('Something failed');

// ZeroThrow - richer error context
const error = err(new ZeroError(
  'OPERATION_FAILED',
  'Something failed',
  originalError,
  { operation: 'update', id: 123 }
));
```

2. **ESLint Support**: ZeroThrow includes built-in no-throw rule
3. **React Hook**: ZeroThrow provides useResult out of the box

## From fp-ts

### Either to Result

```typescript
// fp-ts
import { Either, right, left, chain, map } from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

const compute = (n: number): Either<string, number> =>
  n > 0 ? right(n * 2) : left('Must be positive');

const result = pipe(
  right(10),
  chain(compute),
  map(x => x + 1)
);

// ZeroThrow
import { Result, ok, err, andThen, map } from '@flyingrobots/zerothrow';

const compute = (n: number): Result<number, string> =>
  n > 0 ? ok(n * 2) : err('Must be positive');

const result = map(
  andThen(ok(10), compute),
  x => x + 1
);
```

### TaskEither to Async Result

```typescript
// fp-ts
import { TaskEither, tryCatch } from 'fp-ts/TaskEither';

const fetchData: TaskEither<Error, Data> = tryCatch(
  () => fetch('/api/data').then(r => r.json()),
  (reason) => new Error(String(reason))
);

// ZeroThrow
import { tryR, Result } from '@flyingrobots/zerothrow';

const fetchData: Promise<Result<Data, Error>> = tryR(
  () => fetch('/api/data').then(r => r.json())
);
```

## Gradual Migration Strategy

### 1. Enable ESLint Rule as Warning

```json
{
  "rules": {
    "@flyingrobots/zerothrow/no-throw": "warn"
  }
}
```

### 2. Create Boundary Functions

```typescript
// Wrap throwing functions at boundaries
export async function safeApiCall<T>(
  unsafeCall: () => Promise<T>
): Promise<Result<T, ZeroError>> {
  return tryR(unsafeCall, (error) => 
    wrap(error, 'API_ERROR', 'API call failed')
  );
}

// Usage
const result = await safeApiCall(() => legacyApi.getUser(id));
```

### 3. Migrate Layer by Layer

Start with leaf functions and work your way up:

```typescript
// Step 1: Migrate utilities
function parseConfig(json: string): Result<Config, Error> {
  return tryR(() => JSON.parse(json));
}

// Step 2: Migrate services
class UserService {
  async getUser(id: string): Promise<Result<User, ZeroError>> {
    const configResult = parseConfig(await loadConfig());
    if (configResult.isErr) return configResult;
    
    // ... use config
  }
}

// Step 3: Migrate controllers
app.get('/user/:id', async (req, res) => {
  const result = await userService.getUser(req.params.id);
  
  if (result.isErr) {
    res.status(500).json({ error: result.error.message });
    return;
  }
  
  res.json(result.value);
});
```

### 4. Convert ESLint to Error

```json
{
  "rules": {
    "@flyingrobots/zerothrow/no-throw": "error"
  }
}
```

## Common Patterns

### Wrapping Node.js APIs

```typescript
import { promises as fs } from 'fs';
import { Result, tryR, wrap } from '@flyingrobots/zerothrow';

export const readFile = (path: string): Promise<Result<string, ZeroError>> =>
  tryR(
    () => fs.readFile(path, 'utf-8'),
    (error) => wrap(error, 'FILE_READ_ERROR', `Failed to read ${path}`, { path })
  );

export const writeFile = (
  path: string, 
  content: string
): Promise<Result<void, ZeroError>> =>
  tryR(
    () => fs.writeFile(path, content),
    (error) => wrap(error, 'FILE_WRITE_ERROR', `Failed to write ${path}`, { path })
  );
```

### Database Operations

```typescript
// Before
async function findUser(id: string): Promise<User | null> {
  try {
    return await db.query('SELECT * FROM users WHERE id = ?', [id]);
  } catch (error) {
    logger.error('Database error:', error);
    throw new Error('Failed to find user');
  }
}

// After
async function findUser(id: string): Promise<Result<User | null, ZeroError>> {
  return tryR(
    () => db.query('SELECT * FROM users WHERE id = ?', [id]),
    (error) => wrap(
      error,
      'DB_QUERY_ERROR',
      'Failed to find user',
      { query: 'findUser', userId: id }
    )
  );
}
```

### Express Middleware

```typescript
// Error handling middleware
const resultHandler = (
  handler: (req: Request, res: Response) => Promise<Result<any, ZeroError>>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await handler(req, res);
    
    if (result.isErr) {
      const error = result.error;
      const status = error.code === 'NOT_FOUND' ? 404 : 500;
      
      res.status(status).json({
        error: error.message,
        code: error.code
      });
      return;
    }
    
    res.json(result.value);
  };
};

// Usage
app.get('/api/users/:id', resultHandler(async (req) => {
  return userService.getUser(req.params.id);
}));
```

## Next Steps

1. Install ZeroThrow: `npm i @flyingrobots/zerothrow`
2. Add ESLint rule as warning
3. Start migrating leaf functions
4. Work your way up to controllers
5. Enable strict no-throw rule
6. Set up git hooks: `npm run githooks`

For more examples, see the [examples directory](../examples/).