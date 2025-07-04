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
