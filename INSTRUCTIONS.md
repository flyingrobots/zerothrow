# Strike Team Echo: Rust-Style Sugar (#83)

## Mission: Ergonomic Pattern Matching for v0.3.0

You are Strike Team Echo for ZeroThrow v0.3.0 "SHATTER THE CORE".

### Your Mission
Implement Rust-Style Sugar (Issue #83) - Add ergonomic methods inspired by Rust's Result type: `.match()`, type guards (`.isOk()`, `.isErr()`), `.expect()`, `.flatten()`, and `.zip()`.

### Working Directory
You are in: `/Users/james/git/feat-83-rusty`
Your branch: `feat/#83-sugar` (already created and checked out)

### Specifications from ROADMAP

From the official v0.3.0 roadmap:
- **Rust-Style Sugar:**
  - `.match({ ok, err })` - Pattern matching
  - Type guards: `.isOk()` • `.isErr()`
  - Panic helper: `.expect(message)`
  - Combos: `.flatten()` • `.zip(other)`
- Priority: MEDIUM
- Non-breaking addition

### Detailed Implementation Plan

1. **Pattern Matching** (`packages/core/src/result.ts`)
   ```typescript
   // Match on Result state
   match<U>(cases: {
     ok: (value: T) => U;
     err: (error: E) => U;
   }): U;
   
   // Usage example
   const message = result.match({
     ok: (value) => `Success: ${value}`,
     err: (error) => `Failed: ${error.message}`
   });
   ```

2. **Type Guards** (`packages/core/src/result.ts`)
   ```typescript
   // Type predicate methods
   isOk(): this is Ok<T, E>;
   isErr(): this is Err<T, E>;
   
   // Enable type narrowing
   if (result.isOk()) {
     // TypeScript knows result.value exists here
     console.log(result.value);
   }
   ```

3. **Expect Method** (`packages/core/src/result.ts`)
   ```typescript
   // Panic with custom message on error
   expect(message: string): T;
   
   // Implementation throws with context
   expect(message: string): T {
     if (this.isErr()) {
       throw new Error(`${message}: ${this.error}`);
     }
     return this.value;
   }
   ```

4. **Flatten Method** (`packages/core/src/result.ts`)
   ```typescript
   // Flatten nested Results
   flatten<U, F>(this: Result<Result<U, F>, E>): Result<U, E | F>;
   
   // Usage: Result<Result<T, E1>, E2> -> Result<T, E1 | E2>
   const flattened = nestedResult.flatten();
   ```

5. **Zip Method** (`packages/core/src/result.ts`)
   ```typescript
   // Combine two Results into tuple
   zip<U>(other: Result<U, E>): Result<[T, U], E>;
   
   // Short-circuits on first error
   const combined = resultA.zip(resultB); // Result<[A, B], E>
   ```

6. **Additional Rust-inspired Helpers**
   ```typescript
   // Convert to Option-like (nullable)
   ok(): T | null;
   err(): E | null;
   
   // Rust-style unwrap (alias for unwrapOrThrow)
   unwrap(): T;
   
   // Contains checks
   contains(value: T): boolean;
   containsErr(error: E): boolean;
   ```

7. **Comprehensive Testing**
   - Test pattern matching with all types
   - Test type guard narrowing
   - Test expect panic behavior
   - Test flatten with nested Results
   - Test zip combination logic
   - Verify Rust-like ergonomics

### Commands to Execute

```bash
# 1. Implement the feature (you'll use Edit/Write tools)

# 2. After implementation, validate your work:
pnpm --filter @zerothrow/core build
pnpm --filter @zerothrow/core lint
pnpm --filter @zerothrow/core test

# 3. Run specific sugar tests
pnpm --filter @zerothrow/core test match guard expect flatten zip

# 4. Commit your changes
git add .
git commit -m "[core] feat: rust-style sugar (#83)

- Adds .match() for elegant pattern matching
- Adds .isOk() and .isErr() type guards with narrowing
- Adds .expect() for panic with custom message
- Adds .flatten() for nested Result unwrapping
- Adds .zip() for combining Results into tuples
- Inspired by Rust's Result<T,E> ergonomics

Closes #83"

# 5. Push your branch
git push -u origin feat/#83-sugar

# 6. Create the PR
gh pr create \
  --title "feat(core): Rust-Style Sugar (#83)" \
  --body "## 🦀 Ergonomic Pattern Matching for v0.3.0

Implements Rust-inspired ergonomic methods per the v0.3.0 roadmap.

### Features
- ✅ \`.match({ ok, err })\` - Elegant pattern matching
- ✅ \`.isOk()\` / \`.isErr()\` - Type guards with narrowing
- ✅ \`.expect(msg)\` - Panic with custom message
- ✅ \`.flatten()\` - Unwrap nested Results
- ✅ \`.zip(other)\` - Combine Results into tuples

### Usage Examples
\`\`\`typescript
// Pattern matching
const message = parseUser(input).match({
  ok: user => \`Welcome, \${user.name}!\`,
  err: error => \`Invalid user data: \${error.message}\`
});

// Type guards with narrowing
if (result.isOk()) {
  // TypeScript knows result has .value here
  console.log(result.value);
} else {
  // TypeScript knows result has .error here
  handleError(result.error);
}

// Expect for critical failures
const config = loadConfig()
  .expect('Configuration file is required');

// Flatten nested Results
const userData = fetchUser(id)
  .andThen(user => parseProfile(user.profile))
  .flatten(); // Result<Profile, Error>

// Combine Results
const combined = nameResult.zip(emailResult)
  .map(([name, email]) => ({ name, email }));
\`\`\`

### Rust Inspiration
These methods bring Rust's excellent Result ergonomics to TypeScript:
- Pattern matching instead of if/else chains
- Type guards that actually narrow types
- Panic helpers for \"this should never fail\" cases
- Combinators for working with multiple Results

### Testing
- Comprehensive tests for all methods
- Type narrowing verified with TypeScript
- Edge cases and error propagation tested
- Performance remains excellent

Closes #83" \
  --base release/v0.3.0
```

### Success Criteria
- [ ] .match() provides clean pattern matching
- [ ] Type guards properly narrow types in TypeScript
- [ ] .expect() panics with helpful messages
- [ ] .flatten() correctly unwraps nested Results
- [ ] .zip() combines Results following short-circuit rules
- [ ] All methods have Rust-like ergonomics
- [ ] Full test coverage with type tests
- [ ] PR is created targeting release/v0.3.0
- [ ] CI is green

### Important Notes
- **DO NOT MERGE** - Only create the PR
- Study Rust's Result<T,E> API for inspiration
- Ensure type guards work with TypeScript's control flow
- These methods should feel natural to Rust developers
- Report back with PR URL when complete

---

## FULL AGENT PROMPT

You are Strike Team Echo working on ZeroThrow v0.3.0 "SHATTER THE CORE". Your mission is to implement Rust-Style Sugar (Issue #83), adding ergonomic methods inspired by Rust's Result type.

You are working in the worktree at `/Users/james/git/feat-83-rusty` on branch `feat/#83-sugar`.

Your task is to:
1. Implement `.match({ ok, err })` for pattern matching on Result state
2. Implement `.isOk()` and `.isErr()` type guards with proper type narrowing
3. Implement `.expect(message)` that panics with a custom message on error
4. Implement `.flatten()` to unwrap nested Result<Result<T,E>,F> types
5. Implement `.zip(other)` to combine two Results into a tuple Result
6. Ensure all methods have Rust-like ergonomics and feel natural
7. Create comprehensive tests including TypeScript type tests

Key implementation details:
- Update `packages/core/src/result.ts` with all Rust-style methods
- Type guards must use TypeScript's type predicate feature
- Pattern matching should be exhaustive and type-safe
- Consider adding other Rust-inspired helpers if they fit
- Maintain consistency with existing API design

After implementation:
1. Run `pnpm --filter @zerothrow/core build && pnpm --filter @zerothrow/core lint && pnpm --filter @zerothrow/core test`
2. Commit with message: `[core] feat: rust-style sugar (#83)` including feature list
3. Push to origin: `git push -u origin feat/#83-sugar`
4. Create PR with `gh pr create` targeting the release/v0.3.0 branch

DO NOT merge the PR. Report back with the PR URL when complete.

Remember: These methods should make TypeScript developers jealous of Rust's Result type. Focus on ergonomics, type safety, and developer happiness.