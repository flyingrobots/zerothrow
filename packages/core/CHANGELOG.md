# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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