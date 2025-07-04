# @zerothrow/expect

## 0.0.1

### Patch Changes

- 04a2556: Refactor test matcher architecture
  - Created new `@zerothrow/expect` package containing shared test matcher logic
  - Removed `/matchers` export from `@zerothrow/core` to keep core pure
  - Updated `@zerothrow/jest` and `@zerothrow/vitest` to depend on `@zerothrow/expect`
  - Cleaned up package structure by removing nested packages directory from core

  This is an internal refactoring with no API changes for end users.
