# ZeroThrow Project Guide

This guide contains essential information about the ZeroThrow monorepo for AI assistants.

## Project Overview

ZeroThrow is a TypeScript error handling library that replaces exceptions with type-safe Result types. The core philosophy: **Stop throwing, start returning.**

### Key Mental Model
1. **Write functions that return Results from the beginning** - Don't throw then wrap
2. **Only use `ZT.try` at absolute boundaries** - When interfacing with code you don't control
3. **Results are your primary return type** - Not an afterthought or wrapper

## Repository Structure

```
zerothrow/
├── packages/
│   ├── core/           # Core Result<T,E> type (v0.2.3)
│   ├── resilience/     # Retry, circuit breaker, timeout (v0.2.1)
│   ├── jest/           # Jest matchers (v1.1.1)
│   ├── vitest/         # Vitest matchers (v1.1.1)
│   ├── testing/        # Unified test package (v1.1.1)
│   ├── expect/         # Shared matcher logic (v0.2.1)
│   ├── docker/         # Docker utilities (v0.1.3)
│   ├── zt-cli/         # CLI tooling (v0.1.3)
│   ├── eslint-plugin/  # ESLint rules (unpublished)
│   └── react/          # React hooks (v0.1.2)
├── docs-src/           # Source for transcluded documentation
├── scripts/            # Build and release scripts
├── README.md           # Monorepo control tower
└── ECOSYSTEM.md        # Complete package listing
```

## Development Workflow

### Prerequisites
- Node.js 18+
- pnpm 9+ (`npm install -g pnpm`)
- Docker (optional, for full test matrix)

### Common Commands
```bash
# Setup
pnpm install

# Development
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm lint               # Lint check
pnpm run ci:local       # Full CI simulation

# Package-specific
pnpm --filter @zerothrow/core test
pnpm --filter @zerothrow/core build
```

### Git Workflow
```bash
# Feature development
git checkout -b feat/feature-name
git checkout -b fix/issue-name

# Create PR
gh pr create
```

## Commit Guidelines

### Format
```
[{package}] {type}: {subject}

{body}

(optional) BREAKING CHANGE: {details}
```

> [!important] If you can't find a package name that describes your commit, you're probably committing too much at once. Target packages with your commits: one commit affecting one package.

### Examples
```
[core] feat: add Result.tap method for side effects
[jest] fix: handle undefined values in toBeOkWith matcher
[resilience] docs: add circuit breaker examples
```

### Rules
- **One package per commit** - Keep changes focused
- **Atomic commits** - Each commit should be independently valid
- **Test with code** - Include tests in the same commit as features
- **Build before commit** - Ensure packages build successfully

## Documentation System

We use markdown-transclusion for modular documentation:

```bash
# Generate docs from templates
pnpm zt docs generate

# Templates live in docs-src/
# Shared components in docs-src/shared/
```

## Release Process

### 1. Version Bump
```bash
# Update package.json versions
# Update CHANGELOG.md
# Update README/ECOSYSTEM versions
```

### 2. Commit and Push
```bash
git add -A
git commit -m "chore: release v{version}"
git push
```

### 3. Publish to npm
```bash
cd packages/{package}
npm publish --otp={otp}
```

### Publishing Order (respect dependencies)
1. Core first
2. Packages that depend on core (resilience, expect)
3. Test packages last (jest, vitest, testing)

## Testing Philosophy

- **Write behavior tests, not implementation tests**
- **Test the public API, not internals**
- **Use Result matchers for clean assertions**
- **No try/catch in tests - use Result patterns**

## Key Design Decisions

### Zero Dependencies
All packages aim for zero runtime dependencies. This ensures:
- Small bundle sizes
- No dependency conflicts
- Predictable behavior

### Modular Architecture
- Small, focused packages that do one thing well
- Compose packages for complex use cases
- Each package has its own README and tests

### Result-First API
- Functions return Results, not throw exceptions
- Errors are values, not control flow
- Composable error handling with combinators

## Common Patterns

### Creating Results
```typescript
// Your functions
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return ZT.err('DIV_BY_ZERO');
  return ZT.ok(a / b);
}

// Third-party code
const parsed = ZT.try(() => JSON.parse(input));
```

### Chaining Operations
```typescript
userResult
  .map(user => user.name)
  .andThen(name => validateName(name))
  .tap(name => console.log('Valid name:', name))
  .unwrapOr('Anonymous')
```

## Memory Integration

When starting work:
```
mcp__basic-memory__search "zerothrow"
```

After significant changes, create a SITREP using POSIX timestamp:
```
mcp__basic-memory__write_note
  title: "ZeroThrow SITREP $(date +%s)_{subject}"
  folder: "projects/zerothrow/sitreps"
  content: {summary of changes}
  tags: ["#zerothrow", "#sitrep"]
```

### SITREP File Naming Convention
- Use POSIX timestamps to avoid date/timezone confusion
- Format: `{timestamp}_{subject}.md`
- Example: `1736219729_release-v0.2.3-preparation.md`
- This ensures chronological sorting and unique filenames

## Important Notes

- **Check package versions** before releasing
- **Update documentation** when APIs change
- **Run tests locally** before pushing
- **Use pnpm** for all package operations
- **Follow Result-first patterns** in all examples

## Resources

- [API Documentation](packages/core/docs/api.md)
- [Ecosystem Overview](ECOSYSTEM.md)
- [Contributing Guide](CONTRIBUTING.md)
- [GitHub Discussions](https://github.com/zerothrow/zerothrow/discussions)