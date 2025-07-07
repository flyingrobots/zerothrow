# @zerothrow/react

## 0.1.1 - 2025-07-07

### Patch Changes

- Fixed workspace protocol dependencies for npm compatibility
  - Replaced `workspace:*` with actual version numbers in both dependencies and devDependencies
  - This resolves npm installation issues when packages are published
  - Now correctly depends on `@zerothrow/core@^0.2.3`
- Updated dependency on @zerothrow/resilience to ^0.2.0 to support new Policy hierarchy

## 0.1.0 - 2025-07-07

### Minor Changes

- Initial release of @zerothrow/react
- Add `useResult` hook for async operations with Result types
- Add `useResilientResult` hook with Policy integration from @zerothrow/resilience
- Add `ResultBoundary` component for converting thrown errors to Results
- Full TypeScript support with proper type inference
- Comprehensive test coverage
- Zero runtime dependencies (only peer dep on React)