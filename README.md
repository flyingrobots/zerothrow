# ZeroThrow

**Stop throwing, start returning.**  
*The ZeroThrow monorepo – type-safe error handling, resilience patterns, and tooling for TypeScript.*

<p align="center">
  <img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-core.webp" alt="ZeroThrow" height="300" />
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@zerothrow/core?label=core" alt="npm">
  <img src="https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg" alt="CI">
  <img src="https://img.shields.io/badge/TypeScript-5.0%2B-blue" alt="TypeScript">
</p>

## Quick Taste

```typescript
import { ZT } from '@zerothrow/core'

// ❌ This explodes somewhere in your call stack
JSON.parse(userInput)

// ✅ This returns an explicit Result<T,E>
const user = ZT.try(() => JSON.parse(userInput))
  .map(validate)
  .andThen(fetchFromDB)
  .unwrapOr(defaultUser)
```

No more invisible errors. No more try/catch pyramids. Just type-safe Results.

## Packages

All packages live under `/packages` — each folder contains its own README, tests, and examples.

| Package | Version | Description | Status |
|---------|---------|-------------|--------|
| **[@zerothrow/core](packages/core)** | ![npm](https://img.shields.io/npm/v/@zerothrow/core) | Core `Result<T,E>` type and combinators | 🟢 Beta |
| **[@zerothrow/resilience](packages/resilience)** | ![npm](https://img.shields.io/npm/v/@zerothrow/resilience) | Retry, timeout, circuit breaker patterns | 🟢 Beta |
| **[@zerothrow/jest](packages/jest)** | ![npm](https://img.shields.io/npm/v/@zerothrow/jest) | Jest matchers for Result types | 🟢 Beta |
| **[@zerothrow/vitest](packages/vitest)** | ![npm](https://img.shields.io/npm/v/@zerothrow/vitest) | Vitest matchers for Result types | 🟢 Beta |
| **[@zerothrow/testing](packages/testing)** | ![npm](https://img.shields.io/npm/v/@zerothrow/testing) | Unified test matchers (Jest + Vitest) | 🟢 Beta |
| **[@zerothrow/expect](packages/expect)** | ![npm](https://img.shields.io/npm/v/@zerothrow/expect) | Shared test matcher logic | 🔧 Internal |
| **[@zerothrow/docker](packages/docker)** | ![npm](https://img.shields.io/npm/v/@zerothrow/docker) | Docker test utilities | 🟢 Beta |
| **[@zerothrow/react](packages/react)** | ![npm](https://img.shields.io/badge/npm-v0.1.1-brightgreen) | React hooks and utilities for Result types | 🟢 Beta |
| **[@zerothrow/zt-cli](packages/zt-cli)** | ![unreleased](https://img.shields.io/badge/npm-unreleased-lightgrey) | CLI tooling | 🔧 Internal |

### In Development

| Package | Description | Status |
|---------|-------------|--------|
| **[@zerothrow/eslint-plugin](packages/eslint-plugin)** | ![unreleased](https://img.shields.io/badge/npm-unreleased-lightgrey) | ESLint rules to enforce no-throw | 🚧 Alpha |

[See full ecosystem roadmap →](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

## Getting Started

### Most developers want:

```bash
# Core functionality
npm install @zerothrow/core

# Add test matchers
npm install --save-dev @zerothrow/jest    # Jest users
npm install --save-dev @zerothrow/vitest  # Vitest users

# Add resilience patterns (recommended for production)
npm install @zerothrow/resilience
```

### Quick Example

```typescript
import { ZT, Result } from '@zerothrow/core'

// Return Results from the start - no throwing!
async function fetchUser(id: string): Promise<Result<User, Error>> {
  const response = await fetch(`/api/users/${id}`)
  
  if (!response.ok) {
    return ZT.err(`USER_FETCH_FAILED`, `HTTP ${response.status}`)
  }
  
  // Only use try for third-party code that might throw
  return ZT.try(() => response.json())
}

// Chain operations without nesting
const displayName = await fetchUser('123')
  .then(r => r
    .map(user => user.name.toUpperCase())
    .unwrapOr('Guest')
  )

console.log(`Welcome, ${displayName}!`)
```

## Why ZeroThrow?

1. **Type-safe** - TypeScript knows about every possible error
2. **Fast** - [93× faster](https://github.com/zerothrow/zerothrow/tree/main/benchmarks) than try/catch on error paths
3. **Composable** - Chain operations without nesting
4. **Explicit** - No hidden control flow

### The Right Mental Model

1. **Write functions that return Results from the beginning** - Don't throw then wrap
2. **Only use `ZT.try` at absolute boundaries** - When interfacing with code you don't control
3. **Results are your primary return type** - Not an afterthought or wrapper

[Learn more →](https://github.com/zerothrow/zerothrow/tree/main/packages/core#why-results-not-throws)

## Development

Requires [pnpm](https://pnpm.io) ≥ 9.0 (`npm install -g pnpm`)

```bash
# Setup
git clone https://github.com/zerothrow/zerothrow.git
cd zerothrow
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run specific package
pnpm --filter @zerothrow/core test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Philosophy

Explicit errors. No hidden control flow. Small, composable packages. [Read more →](https://github.com/zerothrow/zerothrow/tree/main/docs/philosophy.md)

## Documentation

- 📖 **[Core Library Guide](packages/core)** - Start here
- 🏗️ **[Architecture](https://github.com/zerothrow/zerothrow/tree/main/docs/architecture.md)** - How it all fits together
- 📦 **[Package Ecosystem](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)** - All packages explained
- 🔄 **[Migration Guide](https://github.com/zerothrow/zerothrow/blob/main/packages/core/CHANGELOG.md#migration-guide)** - Upgrading from v0.1.x
- 📊 **[Benchmarks](https://github.com/zerothrow/zerothrow/tree/main/benchmarks)** - Performance data (`pnpm benchmark`)

## Community

- 💬 [GitHub Discussions](https://github.com/zerothrow/zerothrow/discussions) - Get help, share patterns
- 🐛 [Issues](https://github.com/zerothrow/zerothrow/issues) - Bug reports
- 🎯 [Roadmap](https://github.com/zerothrow/zerothrow/projects) - What's coming

---

MIT © 2025 [ZeroThrow Contributors](https://github.com/zerothrow/zerothrow/graphs/contributors)