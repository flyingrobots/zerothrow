# Changelog

## 0.1.2 - 2025-07-07

### Patch Changes

- Lowered minimum Node.js version from 20.17.0 to 18.17.0
  - Expands compatibility to Node 18 LTS users
  - No features required Node 20 specifically
  - Aligns with monorepo standard
- Added `platform: "node"` to package.json for clarity
- Updated dependencies to latest versions

## 0.1.1

### Patch Changes

- Updated dependency for @zerothrow/core to support v0.2.0
  - Changed from `^0.1.0` to `^0.2.0`
  - Ensures compatibility with the new unified Result API

## 0.1.0

### Initial Release

- ZeroThrow CLI tool for repo-wide workflows
- Commands for package management, validation, and documentation
- Ecosystem visualization and dependency tracking
- Full TypeScript support