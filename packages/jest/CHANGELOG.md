# Changelog

## 0.1.1

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

- Updated dependencies [04a2556]
- Updated dependencies [1d3361e]
  - @zerothrow/core@0.0.2
  - @zerothrow/expect@0.0.1

## 0.1.0

### Minor Changes

- 67e96b8: Add @zerothrow/jest package with Result-friendly matchers

  New matchers for testing Result types without throwing:
  - `toBeOk()` - Assert Result is Ok
  - `toBeOkWith(value)` - Assert Result is Ok with specific value
  - `toBeErr()` - Assert Result is Err
  - `toBeErrWith(error)` - Assert Result is Err with specific error/properties
  - `toHaveErrorCode(code)` - Assert error has specific code
  - `toHaveErrorMessage(message)` - Assert error has specific message (string or regex)

  Works with both Jest and Vitest test runners.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1-alpha] - 2025-01-04

### Added

- Initial alpha release of @zerothrow/jest
- `toBeOk()` - Assert Result is Ok
- `toBeOkWith(value)` - Assert Result is Ok with specific value
- `toBeErr()` - Assert Result is Err
- `toBeErrWith(error)` - Assert Result is Err with specific error/properties
- `toHaveErrorCode(code)` - Assert error has specific code
- `toHaveErrorMessage(message)` - Assert error has specific message (string or regex)
- Auto-registration when imported
- Full TypeScript support
- Comprehensive test suite

### Notes

This package addresses feedback from alpha users about test helpers defaulting to throw. These matchers provide a Result-friendly testing experience without throwing.
