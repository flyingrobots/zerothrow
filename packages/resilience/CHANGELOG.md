# Changelog

## 0.1.1

### Patch Changes

- Updated peer dependency for @zerothrow/core to support v0.2.0
  - Changed from `^0.1.0` to `>=0.1.0` (peer deps) or `^0.2.0` (regular deps)
  - This allows the package to work with core v0.2.0 without warnings

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-04

### Added
- Initial release of @zerothrow/resilience
- RetryPolicy with constant, linear, and exponential backoff strategies
- CircuitBreakerPolicy with closed/open/half-open state machine
- TimeoutPolicy for enforcing time limits on operations
- Policy.compose() for chaining multiple policies
- Policy.wrap() for composing two policies
- TestClock for deterministic testing
- Full TypeScript support with preserved error types
- Zero runtime dependencies
