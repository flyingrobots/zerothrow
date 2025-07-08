# ZeroThrow Philosophy

> **Stop throwing, start returning.**

This document outlines the core philosophy and design principles that guide the ZeroThrow project. These aren't just technical decisions—they represent a fundamental shift in how we think about error handling in TypeScript.

## The Prime Directive

**Errors are values, not control flow.**

In traditional JavaScript/TypeScript, errors are exceptions—invisible grenades that explode somewhere up the call stack. You can't see them in function signatures. You can't reason about them with types. They break your program's flow and hide failure modes.

ZeroThrow rejects this model entirely. We believe errors deserve first-class treatment as values that flow through your program just like any other data.

## Core Principles

### 1. Zero Exceptions

```typescript
// ❌ The old way: Invisible failure modes
function parseUser(json: string): User {
  return JSON.parse(json); // Might throw. Who knows?
}

// ✅ The ZeroThrow way: Explicit contracts
function parseUser(json: string): Result<User, Error> {
  return ZT.try(() => JSON.parse(json))
    .andThen(data => validateUser(data));
}
```

Every function's failure modes are visible in its type signature. No surprises. No hidden `throw` statements. No defensive `try/catch` "just in case."

### 2. Zero Dependencies

Each package in the ecosystem stands alone with zero runtime dependencies. This isn't just about bundle size—it's about trust. When you adopt ZeroThrow, you're not dragging in someone else's dependency tree. You get exactly what you see: pure TypeScript that works everywhere TypeScript works.

### 3. Zero Overhead

Returning objects is ~93× faster than throwing and catching on error paths. But performance isn't just about speed—it's about predictability. Result creation has consistent performance characteristics whether you're on the happy path or handling errors. No stack unwinding. No hidden costs.

### 4. Explicit Over Implicit

```typescript
// Implicit: What could go wrong?
const user = await fetchUser(id);
const profile = await fetchProfile(user.id);
const settings = await fetchSettings(profile.id);

// Explicit: Every failure point is visible
const settings = await fetchUser(id)
  .andThen(user => fetchProfile(user.id))
  .andThen(profile => fetchSettings(profile.id))
  .unwrapOr(defaultSettings);
```

Make the invisible visible. Every operation that can fail should say so in its type signature.

## The Mental Model

### Results Are Your Primary Return Type

This is the most important shift: **start with Results**. Don't write throwing functions and wrap them later. Don't treat Results as error-handling band-aids. Design your APIs with Result<T, E> from the beginning.

```typescript
// ❌ Don't: Throw then wrap
function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}
const result = ZT.try(() => divide(10, 0)); // Wrapping after the fact

// ✅ Do: Return Results from the start
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return ZT.err('DIV_BY_ZERO', 'Cannot divide by zero');
  return ZT.ok(a / b);
}
```

### Only Use `try` at Boundaries

`ZT.try` exists for one reason: interfacing with code you don't control. Third-party libraries. Browser APIs. Legacy code. That's it.

```typescript
// ✅ Good: Wrapping uncontrolled code
const parsed = ZT.try(() => JSON.parse(userInput)); // JSON.parse throws
const result = ZT.try(() => thirdPartyLib.riskyOperation()); // Who knows?

// ❌ Bad: Wrapping your own code
const result = ZT.try(() => {
  // Why are you throwing in your own function?
  if (!isValid) throw new Error('Invalid');
  return value;
});
```

### Compose, Don't Nest

Traditional error handling leads to deeply nested code:

```typescript
// ❌ The pyramid of doom
try {
  const a = stepOne();
  try {
    const b = stepTwo(a);
    try {
      const c = stepThree(b);
      return c;
    } catch (e3) {
      handleError3(e3);
    }
  } catch (e2) {
    handleError2(e2);
  }
} catch (e1) {
  handleError1(e1);
}
```

Results compose naturally:

```typescript
// ✅ Flat, readable, composable
stepOne()
  .andThen(a => stepTwo(a))
  .andThen(b => stepThree(b))
  .tapErr(error => logError(error))
  .unwrapOr(fallback);
```

## Design Philosophy

### Errors Deserve Respect

Errors aren't second-class citizens to be swept under the rug with `try/catch`. They're legitimate values that deserve thoughtful handling. Give them structure. Give them types. Give them context.

```typescript
// Rich, typed errors with context
class ValidationError extends ZeroError<'VALIDATION_FAILED'> {
  constructor(
    public field: string,
    public value: unknown,
    message: string
  ) {
    super('VALIDATION_FAILED', message, {
      context: { field, value }
    });
  }
}

// Now errors carry meaningful information
function validateAge(age: number): Result<number, ValidationError> {
  if (age < 0 || age > 150) {
    return ZT.err(new ValidationError('age', age, 'Age must be between 0 and 150'));
  }
  return ZT.ok(age);
}
```

### Make Invalid States Unrepresentable

The type system should make it impossible to misuse your APIs:

```typescript
// You can't access the value of an error
const result = someOperation();
if (!result.ok) {
  console.log(result.value); // TypeScript Error! Property 'value' does not exist
}

// You must handle both cases
const value = result.match({
  ok: (val) => val,
  err: (error) => fallback
});
```

### Railway-Oriented Programming

Think of your program as a railway network. Results stay on the success track until they hit an error, then switch to the error track. Operations on the error track pass through unchanged.

```typescript
parseConfig(input)          // Start on success or error track
  .map(normalizeConfig)     // Only runs on success track
  .andThen(validateConfig)  // Only runs on success track, can switch tracks
  .tapErr(logError)         // Only runs on error track
  .map(finalizeConfig)      // Only runs on success track
  .unwrapOr(defaultConfig); // Exit the railway with a value
```

### Fail Fast, Recover Explicitly

When something goes wrong, fail immediately and explicitly. Don't try to soldier on with bad data. But also make recovery explicit and intentional:

```typescript
// Clear failure, explicit recovery
const config = loadFromEnv()
  .orElse(() => loadFromFile('./config.json'))
  .orElse(() => loadFromDefaults())
  .expect('Failed to load configuration from any source');
```

## The Imperial Mandates

These are non-negotiable rules that preserve the integrity of the ZeroThrow philosophy:

1. **All errors must be expressed as values** - No exceptions in userland
2. **No exceptions in userland** - Worth saying twice
3. **All async actions return `Result<T, E>`** - Promises of Results, not throwing Promises
4. **Retries must be intentional and visible** - No silent retry loops
5. **Contexts resolve to Results, not chaos** - Even React contexts follow the pattern
6. **No `any` shall defile our types** - Full type safety, no escape hatches

## Why This Matters

### For Application Code

Your application becomes more reliable. Not because errors happen less (they don't), but because every error is handled explicitly. No more:
- Unhandled promise rejections
- Mysterious crashes in production  
- Defensive try/catch everywhere
- "Cannot read property of undefined"

### For Library Authors

Your APIs become honest. Users know exactly what can fail and how. They can compose your functions with confidence. They can handle errors appropriately for their use case, not yours.

### For Teams

Error handling becomes a first-class design consideration, not an afterthought. Code reviews focus on the happy path *and* error paths. Types document failure modes better than any comment could.

## The ZeroThrow Promise

When you adopt ZeroThrow, you're not just changing how you handle errors. You're joining a movement that believes:

- Software can be more reliable
- Types can encode real guarantees
- Errors deserve thoughtful handling
- Explicit is better than implicit
- Composition beats nesting
- Performance and safety can coexist

## Living the Philosophy

### Start Today

You don't need to rewrite your entire codebase. Start with one function:

```typescript
// Before
async function getUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error('User not found');
  return response.json();
}

// After  
async function getUser(id: string): Promise<Result<User, Error>> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    return ZT.err('USER_NOT_FOUND', `No user with id ${id}`);
  }
  return ZT.try(() => response.json());
}
```

### Spread the Pattern

Once you have one Result-returning function, others follow naturally. Results compose. Your error handling becomes more consistent. Your code becomes more predictable.

### Embrace the Constraints

Zero dependencies is a constraint. Explicit error handling is a constraint. But constraints drive creativity. They force us to find simpler, more elegant solutions.

---

> "In the face of ambiguity, refuse the temptation to guess."  
> — The Zen of Python

Stop guessing about errors. Stop throwing problems at your callers. Stop catching exceptions you didn't expect.

**Stop throwing. Start returning.**

Welcome to ZeroThrow.