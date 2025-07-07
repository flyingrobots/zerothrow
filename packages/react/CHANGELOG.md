# @zerothrow/react

## 0.2.0 - 2025-07-07

### Minor Changes

- Add `useResultContext` hook for safe context access (#44)
  - Returns Result instead of throwing when context is unavailable
  - Includes `useResultContextNullable` for null-safe contexts
  - Adds `createResultContext` helper for Result-based contexts
- Add comprehensive developer feedback documentation
- Based on real-world usage in production applications

## 0.1.2 - 2025-07-07

### Patch Changes

- Version bump to align with other package releases

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