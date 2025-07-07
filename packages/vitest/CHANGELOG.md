# Changelog

## 1.1.0 - 2025-07-07

### Minor Changes

- Raised minimum Node.js version from 16.14 to 18.17.0
  - Node 16 reached end-of-life in September 2023
  - Aligns with core package requirement
  - Enables use of modern Node.js features
- Added `platform: "node"` to package.json for clarity

## 1.0.2

### Patch Changes

- Updated peer dependency for @zerothrow/expect to support wider range
  - Changed from exact version `0.1.0` to range `>=0.1.0 <1.0.0`
  - This provides more flexibility for users while maintaining compatibility
  - Follows semantic versioning best practices for peer dependencies

## 1.0.1

### Patch Changes

- Updated peer dependency for @zerothrow/core to support v0.2.0
  - Changed from `^0.1.0` to `>=0.1.0` (peer deps) or `^0.2.0` (regular deps)
  - This allows the package to work with core v0.2.0 without warnings

# @zerothrow/vitest

## 1.0.0

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

### Patch Changes

- Updated dependencies
  - @zerothrow/core@0.1.0
  - @zerothrow/expect@0.1.0

## 0.1.1-alpha.0

### Patch Changes

- Bump all packages to alpha versions after accidental stable release
  - Restores alpha versioning discipline
  - All packages will now be versioned as X.Y.Z-alpha.N
  - Previous stable versions have been deprecated on npm

- Updated dependencies
  - @zerothrow/core@0.0.3-alpha.0
  - @zerothrow/expect@0.0.2-alpha.0

## 0.1.0

### Minor Changes

- 1d3361e: feat: add Vitest support and extract shared matcher logic
  - Extract shared matcher logic to @zerothrow/core/matchers
  - Update @zerothrow/jest to use shared matchers
  - Add new @zerothrow/vitest package with Vitest support
  - All packages support Result-friendly assertions without throwing

### Patch Changes

- 04a2556: Refactor test matcher architecture
  - Created new `@zerothrow/expect` package containing shared test matcher logic
  - Removed `/matchers` export from `@zerothrow/core` to keep core pure
  - Updated `@zerothrow/jest` and `@zerothrow/vitest` to depend on `@zerothrow/expect`
  - Cleaned up package structure by removing nested packages directory from core

  This is an internal refactoring with no API changes for end users.

- Updated dependencies [04a2556]
- Updated dependencies [1d3361e]
  - @zerothrow/core@0.0.2
  - @zerothrow/expect@0.0.1
