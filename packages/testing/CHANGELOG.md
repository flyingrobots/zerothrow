# Changelog

## 1.1.1 - 2025-07-07

### Patch Changes

- Fixed workspace protocol dependencies for npm compatibility
  - Replaced `workspace:*` with actual version numbers in regular dependencies
  - This resolves npm installation issues when packages are published
  - Now correctly depends on `@zerothrow/jest@^1.1.0` and `@zerothrow/vitest@^1.1.0`

## 1.1.0 - 2025-07-07

### Minor Changes

- Added minimum Node.js version requirement of 18.17.0
  - Previously had no explicit engine requirement
  - Aligns with core package and test framework requirements
  - Node 16 reached end-of-life in September 2023
- Added `platform: "node"` to package.json for clarity

## 1.0.1

### Patch Changes

- Updated peer dependency for @zerothrow/core to support v0.2.0
  - Changed from `^0.1.0` to `>=0.1.0` (peer deps) or `^0.2.0` (regular deps)
  - This allows the package to work with core v0.2.0 without warnings

# @zerothrow/testing

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

## 0.0.2-alpha.0

### Patch Changes

- Bump all packages to alpha versions after accidental stable release
  - Restores alpha versioning discipline
  - All packages will now be versioned as X.Y.Z-alpha.N
  - Previous stable versions have been deprecated on npm

- Updated dependencies
  - @zerothrow/core@0.0.3-alpha.0
  - @zerothrow/jest@0.1.2-alpha.0
  - @zerothrow/vitest@0.1.1-alpha.0

## 0.0.1

### Patch Changes

- Updated dependencies [04a2556]
- Updated dependencies [1d3361e]
  - @zerothrow/core@0.0.2
