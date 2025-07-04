# Getting Started with ZeroThrow

Learn how to use ZeroThrow for robust error handling in TypeScript.

## Prerequisites

- Node.js 16.14 or later
- TypeScript 4.5 or later
- Basic understanding of TypeScript

## Installation

```bash
npm install @zerothrow/zerothrow
```

## Your First Result

The core concept in ZeroThrow is the `Result` type, which represents either success (`Ok`) or failure (`Err`).

```typescript
import { ok, err, Result } from '@zerothrow/zerothrow';

// A function that can fail
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Cannot divide by zero');
  }
  return ok(a / b);
}

// Using the result
const result = divide(10, 2);

if (result.isOk) {
  console.log(`Success: ${result.value}`); // Success: 5
} else {
  console.log(`Error: ${result.error}`);
}
```

## Why Result Types?

Traditional error handling with try/catch has several problems:

```typescript
// Problems with try/catch:
function riskyOperation() {
  if (Math.random() > 0.5) {
    throw new Error('Random failure');
  }
  return 'success';
}

// Caller must remember to handle errors
try {
  const value = riskyOperation(); // Could throw!
  console.log(value);
} catch (error) {
  // Easy to forget error handling
}
```

With Result types, errors are explicit:

```typescript
import { Result, ok, err } from '@zerothrow/zerothrow';

function riskyOperation(): Result<string, Error> {
  if (Math.random() > 0.5) {
    return err(new Error('Random failure'));
  }
  return ok('success');
}

// TypeScript forces you to handle both cases
const result = riskyOperation();
if (result.isOk) {
  console.log(result.value); // TypeScript knows this is safe
} else {
  console.log(result.error.message); // TypeScript knows error exists
}
```

## Basic Patterns

### Creating Results

```typescript
import { ok, err } from '@zerothrow/zerothrow';

// Success values
const goodNumber = ok(42);
const goodString = ok('hello');
const goodObject = ok({ name: 'Alice', age: 30 });

// Error values
const stringError = err('Something went wrong');
const objectError = err({ code: 'INVALID_INPUT', field: 'email' });
const errorInstance = err(new Error('Network failed'));
```

### Type Safety

TypeScript automatically narrows types based on the `isOk` property:

```typescript
function processUser(id: string): Result<User, string> {
  // ... implementation
}

const result = processUser('123');

// Before checking, TypeScript doesn't know what's in result
// result.value; // Error: Property 'value' does not exist
// result.error; // Error: Property 'error' does not exist

if (result.isOk) {
  // Inside this block, TypeScript knows result has 'value'
  console.log(result.value.name); // Safe!
  // result.error; // Error: Property 'error' does not exist
} else {
  // Inside this block, TypeScript knows result has 'error'
  console.log(result.error); // Safe!
  // result.value; // Error: Property 'value' does not exist
}
```

### Early Returns

A common pattern is to return early on errors:

```typescript
function processOrder(order: OrderInput): Result<Order, string> {
  // Validate order
  if (!order.items || order.items.length === 0) {
    return err('Order must have at least one item');
  }

  // Check inventory
  for (const item of order.items) {
    if (!checkInventory(item)) {
      return err(`Item ${item.id} is out of stock`);
    }
  }

  // Calculate total
  const total = calculateTotal(order.items);
  if (total <= 0) {
    return err('Order total must be positive');
  }

  // Create order
  const processedOrder = {
    id: generateId(),
    items: order.items,
    total,
    status: 'pending'
  };

  return ok(processedOrder);
}
```

## Working with Async Code

Use `tryR` to convert throwing async functions into Results:

```typescript
import { tryR, Result } from '@zerothrow/zerothrow';

// Converting a throwing async function
async function fetchUser(id: string): Promise<Result<User, Error>> {
  return tryR(async () => {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<User>;
  });
}

// Using the result
const userResult = await fetchUser('123');
if (userResult.isOk) {
  console.log(`Welcome, ${userResult.value.name}!`);
} else {
  console.error(`Failed to fetch user: ${userResult.error.message}`);
}
```

## Enhanced Error Information

Use `ZeroError` for structured error information:

```typescript
import { ZeroError, wrap, err } from '@zerothrow/zerothrow';

function validateEmail(email: string): Result<string, ZeroError> {
  if (!email) {
    return err(new ZeroError(
      'MISSING_EMAIL',
      'Email is required',
      undefined,
      { field: 'email' }
    ));
  }

  if (!email.includes('@')) {
    return err(new ZeroError(
      'INVALID_EMAIL',
      'Email must contain @',
      undefined,
      { field: 'email', value: email }
    ));
  }

  return ok(email);
}

// Wrapping existing errors
async function saveUser(user: User): Promise<Result<User, ZeroError>> {
  return tryR(
    async () => {
      const savedUser = await db.save(user);
      return savedUser;
    },
    (error) => wrap(
      error,
      'SAVE_USER_FAILED',
      'Failed to save user to database',
      { userId: user.id, operation: 'save' }
    )
  );
}
```

## Chaining Operations

Use combinators to chain operations elegantly:

```typescript
import { ok, err, andThen, map } from '@zerothrow/zerothrow';

// Chain operations that can fail
function parseNumber(str: string): Result<number, string> {
  const num = Number(str);
  return isNaN(num) ? err('Not a number') : ok(num);
}

function checkPositive(num: number): Result<number, string> {
  return num > 0 ? ok(num) : err('Must be positive');
}

const result = andThen(
  parseNumber('42'),
  checkPositive
); // Ok(42)

// Transform success values
const doubled = map(result, n => n * 2); // Ok(84)
```

## React Integration

Use the `useResult` hook for async operations in React:

```typescript
import { useResult } from '@zerothrow/zerothrow/react';

function UserProfile({ userId }: { userId: string }) {
  const { data, error, loading } = useResult(
    () => fetchUser(userId),
    [userId]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h1>{data.name}</h1>
      <p>Email: {data.email}</p>
    </div>
  );
}
```

## Next Steps

Now that you understand the basics:

1. Learn about [advanced patterns](./02-advanced-patterns.md)
2. Explore [error handling strategies](./03-error-handling.md)
3. Master [functional combinators](./04-functional-programming.md)
4. See [real-world examples](../examples/)

## Quick Reference

```typescript
import { 
  ok,           // Create success Result
  err,          // Create error Result
  tryR,         // Convert throwing function to Result
  wrap,         // Wrap error with context
  Result,       // Result type
  ZeroError,    // Enhanced error class
  andThen,      // Chain operations
  map,          // Transform success value
  mapErr,       // Transform error value
  unwrapOr      // Extract value or default
} from '@zerothrow/zerothrow';

// React hook
import { useResult } from '@zerothrow/zerothrow/react';
```