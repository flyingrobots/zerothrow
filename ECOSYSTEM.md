# ZeroThrow Ecosystem

The ZeroThrow monorepo contains multiple packages that work together to provide a complete error handling solution for TypeScript.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@zerothrow/core](./packages/core) | 0.1.0 | Core ZeroThrow functionality - Rust-style Result<T,E> for TypeScript |
| [@zerothrow/expect](./packages/expect) | 0.1.0 | Shared test matcher logic for ZeroThrow Result types |
| [@zerothrow/jest](./packages/jest) | 1.0.0 | Jest matchers for ZeroThrow Result types |
| [@zerothrow/resilience](./packages/resilience) | 0.1.0 | Production-grade resilience patterns for ZeroThrow |
| [@zerothrow/test-package](./packages/test-package) | 0.1.0 | Test package for demonstration |
| [@zerothrow/testing](./packages/testing) | 1.0.0 | Unified test matchers for ZeroThrow Result types - supports Jest and Vitest |
| [@zerothrow/vitest](./packages/vitest) | 1.0.0 | Vitest matchers for ZeroThrow Result types |
| [@zerothrow/zt-cli](./packages/zt-cli) | 0.1.0 | ZeroThrow CLI tool for repo-wide workflows |

## Peer Dependencies

This chart shows which packages depend on which other packages:

| Package | Peer Dependencies |
|---------|-------------------|
| @zerothrow/core | none |
| @zerothrow/expect | @zerothrow/core |
| @zerothrow/jest | @jest/globals, @zerothrow/core, @zerothrow/expect, jest |
| @zerothrow/resilience | @zerothrow/core |
| @zerothrow/test-package | @zerothrow/core |
| @zerothrow/testing | @zerothrow/core, @zerothrow/jest, @zerothrow/vitest, jest, vitest |
| @zerothrow/vitest | @zerothrow/core, @zerothrow/expect, vitest |
| @zerothrow/zt-cli | none |

## Installation

### Core Package
```bash
npm install @zerothrow/core
```

### With Testing Support
```bash
npm install @zerothrow/core @zerothrow/jest
# or
npm install @zerothrow/core @zerothrow/vitest
```

### With Resilience Patterns
```bash
npm install @zerothrow/core @zerothrow/resilience
```

## Development

All packages follow the same development workflow:

```bash
# Build all packages
npm run build

# Run tests
npm run test

# Check types
npm run type-check

# Lint
npm run lint
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT © J. Kirby Ross
