# @zerothrow/react

## 0.1.1

### Patch Changes

- Updated dependency on @zerothrow/resilience to ^0.2.0 to support new Policy hierarchy
- No API changes in this package

## 0.1.0

### Minor Changes

- Initial release of @zerothrow/react
- Add `useResult` hook for async operations with Result types
- Add `useResilientResult` hook with Policy integration from @zerothrow/resilience
- Add `ResultBoundary` component for converting thrown errors to Results
- Full TypeScript support with proper type inference
- Comprehensive test coverage
- Zero runtime dependencies (only peer dep on React)