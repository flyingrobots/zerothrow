# Changelog

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