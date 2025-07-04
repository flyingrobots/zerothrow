# @zerothrow/core &nbsp; ![npm](https://img.shields.io/npm/v/@zerothrow/core?color=blue&label=npm%20@alpha) ![build](https://img.shields.io/github/actions/workflow/status/zerothrow/zerothrow/ci.yml?label=CI)

> **ZeroThrow** brings Rust-style `Result<T, E>` to TypeScript – no hidden `throw`, 100% static visibility of every error path.

> **Status:** _Early **alpha** preview._ API *should* stay source-compatible inside `core`, but anything else may shift without notice until `v0.5.0`.

## What's New in v0.0.2-alpha 🎉

- **`ZT.tryAsync()`** - Explicit async handling that returns `Promise<Result<T,E>>`
- **String error shortcuts** - `ZT.err('CODE')` and `ZT.err('CODE', 'message')`
- **Better type exports** - Import `Result`, `ZeroError` directly from package root
- **DX improvements** based on real alpha user feedback

[See full changelog](./CHANGELOG.md)

---

## Quick Start

```bash
npm install @zerothrow/core@alpha
```

```typescript
import { ZT, Result, ZeroError } from '@zerothrow/core';

// Simple error handling with string shortcuts (NEW in v0.0.2!)
function divide(a: number, b: number): Result<number> {
  return b === 0 ? ZT.err('DIV_ZERO') : ZT.ok(a / b);
}

// Async made easy (NEW in v0.0.2!)
const data = await ZT.tryAsync(async () => {
  const response = await fetch('/api/data');
  return response.json();
});

// Chain operations
const result = divide(10, 2)
  .andThen(x => divide(x, 0))
  .map(x => x * 2);

result.match({
  ok:  v => console.log('✅', v),
  err: e => console.error('❌', e.message)  // -> DIV_ZERO
});
```

**Requirements:** Node.js ≥18.17.0, TypeScript ≥5.2

## What's Stable in Core

| Area | Guarantee |
|------|-----------|
| Result, Ok, Err types | 🟢 Semver-stable |
| ZT.ok / err / try helpers | 🟢 Semver-stable |
| Basic combinators – map, mapErr, andThen, match, unwrap* | 🟢 Semver-stable |
| ZeroError class (+ cause, context) | 🟡 Shape stable; extra helpers may land |

The rest of the monorepo is still incubating and may change without minor-version bumps until we publish beta.

*Note: We're using this in production projects, but the broader ecosystem is still evolving.*

## Companion Packages 🛠️

Extend ZeroThrow with production-ready patterns:

### [@zerothrow/resilience](../resilience) - Fault Tolerance Patterns
```typescript
import { Policy } from '@zerothrow/resilience';

// Compose retry + circuit breaker + timeout
const api = Policy.compose(
  Policy.retry(3, { backoff: 'exponential' }),
  Policy.circuitBreaker({ threshold: 5, duration: 60000 }),
  Policy.timeout(5000)
);

const result = await api.execute(() => fetch('/api/data'));
```

**Features:**
- 🔄 **Retry** with configurable backoff strategies
- 🚦 **Circuit Breaker** to prevent cascading failures
- ⏱️ **Timeout** enforcement for async operations
- 🔗 **Policy composition** for complex scenarios
- 📊 Zero runtime dependencies, ~11KB packed

### [@zerothrow/jest](../jest) & [@zerothrow/vitest](../vitest) - Test Matchers
```typescript
expect(result).toBeOk();
expect(result).toBeErr('VALIDATION_ERROR');
expect(result).toHaveValue(42);
```

**More packages coming soon:** React hooks, ESLint plugin, logger integrations

## Monorepo Layout 🚧

```
zerothrow/
├── @zerothrow/core          ← this package (alpha, usable)
├── @zerothrow/resilience    ← retry, circuit breaker, timeout (alpha)
├── @zerothrow/jest          ← test matchers (published)
├── @zerothrow/vitest        ← test matchers (published)
├── @zerothrow/react         ← hooks for suspense & error-boundaries  
├── @zerothrow/eslint-plugin ← `no-throw` rule + autofix
├── @zerothrow/logger-pino   ← JSON serializers
├── @zerothrow/logger-winston
├── @zerothrow/cli           ← codemod & project opt-in wizard
└── @zerothrow/benchmarks    ← perf harness & dataset
```

**Planned—but not published yet:**
- `@zerothrow/async` – Promise helpers & cancellation tokens
- `@zerothrow/deno` – import-map shim, native test utils

## Roadmap to β

1. **Finish React / logger integrations** (internal deadline 2025-08)
2. **Ship ESLint plugin & codemod** for turnkey adoption  
3. **Hit ≥95% coverage on core**; lock public API (0.5.0)
4. **Publish docs site & interactive playground**

## Contributing / Feedback

Alpha means breaking things fast – we want your **bug reports & API pain points**.

- 🐛 [File issues or discussions](https://github.com/zerothrow/zerothrow)
- 💬 Ping @flyingrobots on GitHub discussions  
- ⭐ Star the repo to follow progress

PRs welcome once the CONTRIBUTING.md lands (tracked in [issue #42](https://github.com/zerothrow/zerothrow/issues/42)).

## 📄 License

MIT © 2025 [J. Kirby Ross](https://github.com/flyingrobots)

---

**Note**: This package replaces our internal error handling patterns that have been battle-tested in production. We're excited to share this approach with the TypeScript community!