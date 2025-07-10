# Changelog

## 0.2.3 - 2025-07-07

### Patch Changes

- Updated minimum Node.js version from 16.14 to 18.17.0
  - Node 16 reached end-of-life in September 2023
  - Enables use of modern Node.js features without polyfills
  - Aligns with ecosystem-wide engine requirements
- Added `platform: "universal"` to package.json for clarity

## 0.2.2

### Patch Changes

- Updated README with Result-first mental model and better examples
- Documentation now emphasizes writing functions that return Results from the beginning
- Fixed misleading examples that showed wrapping throwing code

## 0.2.1

### Patch Changes

- Removed `alpha` tag from publishConfig to ensure future releases publish to `latest` by default
- This fixes the issue where v0.2.0 was accidentally published to the alpha dist-tag

## 0.2.0

### Major Changes

- **BREAKING**: Unified Result API - All Results are now combinable by default

  ## Summary
  
  Eliminated the two-tier Result system. Previously, Results needed to be made combinable via `makeCombinable()`. 
  Now all Results have built-in combinator methods, making the API simpler and more consistent.

  ## BREAKING CHANGES
  
  ### Removed APIs
  - **`makeCombinable()` function** - No longer exists. All Results are combinable by default.
  - **`ResultCombinable` interface** - No longer exists. Use `Result<T, E>` directly.
  
  ### Changed APIs
  - **`firstSuccess()` signature changed**
    - Before: `firstSuccess([result1, result2, result3])`
    - After: `firstSuccess([() => result1, () => result2, () => result3])`
    - Now requires functions that return Results for lazy evaluation
  
  ### TypeScript Breaking Changes
  - **Import changes**
    - `import { makeCombinable } from '@zerothrow/core'` will fail
    - `import type { ResultCombinable } from '@zerothrow/core'` will fail
  - **Type incompatibilities**
    - Functions expecting `ResultCombinable<T, E>` must now accept `Result<T, E>`
    - Direct Result arrays passed to `firstSuccess` will cause type errors
  
  ## Improvements
  
  - `ZT.tryAsync` now correctly returns `Promise<Result<T, E>>` instead of the confusing `Result<Promise<T>, E>`
  - Better TypeScript inference throughout the API
  
  ## Migration Guide
  
  ### 1. Remove all `makeCombinable()` calls
  ```typescript
  // Before
  const result = makeCombinable(ZT.try(() => risky()));
  result.map(x => x * 2);
  
  // After  
  const result = ZT.try(() => risky());
  result.map(x => x * 2);  // Works directly!
  ```
  
  ### 2. Update `firstSuccess()` calls to use functions
  ```typescript
  // Before - firstSuccess with direct Results
  const result = firstSuccess([
    attempt1(),
    attempt2(),
    attempt3()
  ]);
  
  // After - firstSuccess with lazy functions
  const result = firstSuccess([
    () => attempt1(),
    () => attempt2(),
    () => attempt3()
  ]);
  ```
  
  ### 3. Update type annotations
  ```typescript
  // Before
  function processData(result: ResultCombinable<Data, Error>) {
    return result.map(d => d.value);
  }
  
  // After
  function processData(result: Result<Data, Error>) {
    return result.map(d => d.value);
  }
  ```
  
  ### 4. Remove unused imports
  ```typescript
  // Before
  import { ZT, makeCombinable, type ResultCombinable } from '@zerothrow/core';
  
  // After
  import { ZT, type Result } from '@zerothrow/core';
  ```
  
  ## Benefits
  
  - Simpler API - no need to think about "plain" vs "combinable" Results
  - Better ergonomics - all Results work the same way
  - Cleaner internal architecture
  - Consistent behavior across the entire API

## 0.1.0

### Minor Changes

- First stable 0.x release - end of alpha versioning chaos

  ## Summary

  Moving to stable 0.x versions for cleaner npm UX and simpler versioning.
  All packages now use standard semver without prerelease tags.

  ## Features included
  - ZT.tryAsync() for async error handling
  - String overloads for ZT.err()
  - Complete test matcher ecosystem (Jest + Vitest)
  - Exported Result types at package root
  - Full monorepo structure with independent versioning

  ## Breaking changes

  None - this release consolidates all alpha work into stable versions.

## 0.0.3-alpha.0

### Patch Changes

- Bump all packages to alpha versions after accidental stable release
  - Restores alpha versioning discipline
  - All packages will now be versioned as X.Y.Z-alpha.N
  - Previous stable versions have been deprecated on npm

## 0.0.2

### Patch Changes

- 04a2556: Refactor test matcher architecture
  - Created new `@zerothrow/expect` package containing shared test matcher logic
  - Removed `/matchers` export from `@zerothrow/core` to keep core pure
  - Updated `@zerothrow/jest` and `@zerothrow/vitest` to depend on `@zerothrow/expect`
  - Cleaned up package structure by removing nested packages directory from core

  This is an internal refactoring with no API changes for end users.

- 1d3361e: feat: add Vitest support and extract shared matcher logic
  - Extract shared matcher logic to @zerothrow/core/matchers
  - Update @zerothrow/jest to use shared matchers
  - Add new @zerothrow/vitest package with Vitest support
  - All packages support Result-friendly assertions without throwing

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2-alpha] - 2025-01-04

### Added

- `ZT.tryAsync()` for explicit async handling that returns `Promise<Result<T,E>>`
- String overloads for `ZT.err()`:
  - `ZT.err('ERROR_CODE')` creates ZeroError with code
  - `ZT.err('ERROR_CODE', 'message')` for custom messages
- Export `Result`, `Ok`, `Err`, `ZeroError`, `ErrorCode`, `ErrorContext` types at package root
- Comprehensive test suite for new features

### Fixed

- TypeScript error "Module declares 'Result' locally, but it is not exported"
- Async handling confusion by providing explicit `tryAsync` method

### Developer Experience

- Reduced boilerplate for error creation
- Clearer async patterns
- Better type exports for common use cases

## [0.0.1-alpha] - 2025-01-04

### Added

- Initial alpha release of @zerothrow/core
- Core `Result<T, E>` type for type-safe error handling
- `ZT` pocket knife API for simple use cases
  - `ZT.try()` - Wrap potentially throwing functions
  - `ZT.ok()` - Create success results
  - `ZT.err()` - Create error results
- `ZeroThrow` namespace for advanced usage
  - `attempt()` - Advanced try with overloads
  - `wrap()` - Wrap promises
  - `fromAsync()` - Handle async functions
  - `pipe()` - Compose operations
  - `collect()` - Handle multiple results
- Platform abstractions for Node.js and Deno
- Optional dev utilities for error formatting
- Zero runtime dependencies
- Full TypeScript support with comprehensive type inference

### Notes

This is the first alpha release extracted from the ZeroThrow monorepo. The API is stabilizing but may have minor changes before the 1.0 release.
