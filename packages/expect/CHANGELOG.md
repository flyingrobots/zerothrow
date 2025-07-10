# @zerothrow/expect

## 0.2.1 - 2025-07-07

### Patch Changes

- Fixed workspace protocol dependencies for npm compatibility
  - Replaced `workspace:*` with actual version numbers in devDependencies
  - This resolves npm installation issues when packages are published

## 0.2.0 - 2025-07-07

### Minor Changes

- Raised minimum Node.js version from 16.14 to 18.17.0
  - Node 16 reached end-of-life in September 2023
  - Aligns with core package requirement
  - Enables use of modern Node.js features
- Added `platform: "universal"` to package.json for clarity

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

## 0.0.2-alpha.0

### Patch Changes

- Bump all packages to alpha versions after accidental stable release
  - Restores alpha versioning discipline
  - All packages will now be versioned as X.Y.Z-alpha.N
  - Previous stable versions have been deprecated on npm

- Updated dependencies
  - @zerothrow/core@0.0.3-alpha.0

## 0.0.1

### Patch Changes

- 04a2556: Refactor test matcher architecture
  - Created new `@zerothrow/expect` package containing shared test matcher logic
  - Removed `/matchers` export from `@zerothrow/core` to keep core pure
  - Updated `@zerothrow/jest` and `@zerothrow/vitest` to depend on `@zerothrow/expect`
  - Cleaned up package structure by removing nested packages directory from core

  This is an internal refactoring with no API changes for end users.
