---
"@zerothrow/core": patch
"@zerothrow/expect": patch
"@zerothrow/jest": patch
"@zerothrow/vitest": patch
---

Refactor test matcher architecture

- Created new `@zerothrow/expect` package containing shared test matcher logic
- Removed `/matchers` export from `@zerothrow/core` to keep core pure
- Updated `@zerothrow/jest` and `@zerothrow/vitest` to depend on `@zerothrow/expect`
- Cleaned up package structure by removing nested packages directory from core

This is an internal refactoring with no API changes for end users.