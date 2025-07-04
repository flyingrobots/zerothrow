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