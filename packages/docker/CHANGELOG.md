# Changelog

## 0.1.2 - 2025-07-07

### Patch Changes

- Lowered minimum Node.js version from 20.17.0 to 18.17.0
  - Expands compatibility to Node 18 LTS users
  - No features required Node 20 specifically
  - Aligns with monorepo standard
- Added `platform: "node"` to package.json for clarity

## 0.1.1

### Patch Changes

- Updated peer dependency for @zerothrow/core to support v0.2.0
  - Changed from `^0.1.0` to `>=0.1.0`
  - This allows the package to work with core v0.2.0 without warnings
- Updated devDependency to use @zerothrow/core@^0.2.0

## 0.1.0

### Initial Release

- Docker utilities for testing and container management
- CLI tool for docker operations
- Full TypeScript support
- Zero dependencies on @zerothrow/core runtime (peer dependency only)