# Changelog

## 0.3.0 - 2025-07-08

### Breaking Changes

- **MAJOR API OVERHAUL**: All policies now accept Result-returning operations instead of throwing operations
  - **Policy execute method**: Changed from `execute<T>(operation: () => Promise<T>)` to `execute<T, E>(operation: () => ZeroThrow.Async<T, E>)`
  - **No more internal ZT.tryAsync()**: Operations are expected to return Results directly
  - **Generic error types**: All error types are now generic over `E extends Error` instead of hardcoded `Error`
  - **Result-first philosophy**: Fully embraces "Stop throwing, start returning" principle

### Migration Guide

**Before (v0.2.x)**:
```typescript
// Operations throw exceptions
const operation = async () => {
  const result = await someApiCall();
  if (result.status !== 'ok') {
    throw new Error('API failed');
  }
  return result.data;
};

const retried = await PolicyFactory.retry(3).execute(operation);
```

**After (v0.3.0)**:
```typescript
// Operations return Results
const operation = async () => {
  const result = await someApiCall();
  if (result.status !== 'ok') {
    return ZT.err(new Error('API failed'));
  }
  return ZT.ok(result.data);
};

const retried = await PolicyFactory.retry(3).execute(operation);
```

### What Changed

- **All policy implementations** (retry, circuit breaker, timeout, bulkhead, hedge) now work with Result-returning operations
- **Error handling** is now type-safe and compositional
- **Policy errors** now wrap original error types instead of always using `Error`
- **Tests updated** to use Result patterns throughout
- **No more exceptions** in the resilience library - everything is Result-based

### Why This Change

The previous implementation violated ZeroThrow's core principle by expecting operations to throw exceptions and then internally wrapping them with `ZT.tryAsync()`. This forced users to write throwing code in a library called "ZeroThrow". The new implementation properly embraces the Result-first philosophy where operations return Results from the beginning.

## 0.2.1 - 2025-07-07

### Patch Changes

- Fixed workspace protocol dependencies for npm compatibility
  - Replaced `workspace:*` with actual version numbers in devDependencies
  - This resolves npm installation issues when packages are published

## 0.2.0 - 2025-07-07

### Breaking Changes

- **Policy hierarchy refactored**: `Policy` is now the base type with specific subtypes:
  - `RetryPolicy`
  - `CircuitBreakerPolicy`
  - `TimeoutPolicy`
- **Policy renamed to PolicyFactory**: The main factory class is now `PolicyFactory`
- **New callback methods added**:
  - `onRetry`: Callback for retry events
  - `onCircuitStateChange`: Callback for circuit breaker state transitions

### Migration Guide
- Replace `Policy.retry()` with `PolicyFactory.retry()`
- Replace `Policy.circuitBreaker()` with `PolicyFactory.circuitBreaker()`
- Replace `Policy.timeout()` with `PolicyFactory.timeout()`
- Update type imports if using specific policy types

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
