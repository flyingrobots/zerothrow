# ZeroThrow

> __Rust-grade `Result<T,E>` for TypeScript—banish `throw` to the Phantom Zone.__

![CI](https://img.shields.io/badge/throws-0%25-teal?style=flat)  ![npm](https://img.shields.io/npm/v/@flyingrobots/zerothrow?color=blue)  ![license](https://img.shields.io/github/license/flyingrobots/zerothrow)

- [Overview](#overview)
- [Installation](#installation)
- [Quick start](#quick-start)
- [API surface](#api-surface)
- [React hook (alpha)](#react-hook-alpha)
- [Throw-ban in 60 seconds](#throw-ban-in-60-seconds)
  - [1. Add the rule](#1-add-the-rule)
  - [2. Hook into CI](#2-hook-into-ci)
- [Git Hooks Setup](#git-hooks-setup)
- [Competitive landscape — why ZeroThrow?](#competitive-landscape--why-zerothrow)
- [ROADMAP](#roadmap)
  - [Stretch targets](#stretch-targets)
- [Contributing](#contributing)
- [License](#license)

---
## Overview

__ZeroThrow__ delivers a __chainable, code-tagged error model__ plus the _guard-rails_ (ESLint rule, codemod, VS Code linting) that make "never-throw" discipline stick across an entire team.

| ✅ Focus                                          | ❌ Out of scope                              |
| ------------------------------------------------ | ------------------------------------------- |
| Migration & enforcement                          | Re-implementing `fp-ts` / `effect-ts` maths |
| Tiny (< `4 kB` gzip) core                        | Kitchen-sink runtime / fantasy monads       |
| Real-world tolerance (`Error.cause`, stack kept) | Academic purity that breaks Node APIs       |

---
## Installation

```bash
npm i @flyingrobots/zerothrow # core library
npm i -D eslint @flyingrobots/zerothrow/eslint # throw-ban rule

# Optional (unit-test coverage)
npm i -D vitest @vitest/coverage-v8
```

---
## Quick start

```typescript
import { tryR, wrap, ok, Result } from "@flyingrobots/zerothrow";

async function handler(id: string): Promise<Result<User>> {
    const r = await tryR(
        () => db.getUser(id), 
        e => wrap(e, "DB_ERR", "failed to load user", { id })
    );
    
    if (!r.ok) return r; // propagate Err
    
    return ok(transform(r.value));
}
```

No `try`/`catch`, no hidden `throw`s—every caller sees the failure path.

---
## API surface

```typescript
// Helpers
ok(value) // Ok<T>
err(error) // Err<E>
tryR(fn [, map]) // Promise<Result<T,ZeroError>>
wrap(cause, code, msg[,ctx]) // ZeroError

// Result types
type Ok<T>;
type Err<E>;
type Result<T,E> = Ok<T> | Err<E>;

// Error class
class ZeroError extends Error {
    code: string | number | symbol;
    context?: Record<string, unknown>;
    cause?: Error; // native Error.cause
}
```

---
## Documentation

- **[API Reference](docs/api/)** - Complete API documentation with TypeScript types
- **[Tutorials](docs/tutorials/)** - Step-by-step guides from basics to advanced patterns
- **[Examples](docs/examples/)** - Real-world code examples (Express, React, file processing)
- **[Migration Guide](docs/guides/migration-guide.md)** - Migrate from try/catch or other libraries

---
## React hook (alpha)

```typescript
import { useResult } from "@flyingrobots/zerothrow/react";

function Profile({ id }: { id: string }) {
    const { state, data, error } = useResult(
        () => api.fetchProfile(id), [id]
    );

    if (state === "loading") return <Spinner />;
    
    if (state === "err") return <ErrorView code={error!.code} />;
    
    return <ProfileCard user={data!} />;
}
```

---
## Throw-ban in 60 seconds

### 1. Add the rule

```json
// .eslintrc
{
    "plugins": ["@flyingrobots/zerothrow/eslint"],
    "rules": { "zerothrow/no-throw": "error" }
}
``` 

### 2. Hook into CI

```bash
npm run lint && npm test && npm run build
```  

---
## Git Hooks Setup

Prevent `throw` statements from ever being committed with our automated git hooks setup:

```bash
npm run githooks
```

This intelligent script will:
- 🔍 Detect your package manager (npm/yarn/pnpm)
- 🤝 Respect existing git hooks
- 📦 Install missing dependencies
- ⚙️ Configure ESLint if needed

For manual setup or more options, see [docs/githooks.md](docs/githooks.md).

---
## Competitive landscape — why __ZeroThrow__?
 
| Feature | ZeroThrow | neverthrow | oxide.ts | effect-ts |
|---|---|---|---|---|
| ESLint “ban-throw” plugin | ✅ | built-in | ❌ | ❌ | ❌ |
| Codemod migration | ✅ ships v0.2 | ❌ | ❌ | ❌ |
| useResult React hook | ✅ | 🟡 community | 🟡 | 🟢 via Effect |
| Native Error.cause chain | ✅ | ❌ (string only)| ✅ | ✅ |
| Tree-shakable ≤ 4 kB | ✅ | ✅ | ✅ | ❌ (heavy) |
| Logging serializers (Pino/Winston) | ✅ | ❌ | ❌ | 🟡 |
| Proxy boundary wrapper | ✅ | roadmap | ❌ | ❌ | 🟢 (ZIO-style, 100 kB) |

__Differentiator:__ ZeroThrow tackles migration & enforcement head-on.

The others give you a type, pat you on the back, and wish you luck.

---
## ROADMAP

| Version | ETA (2025) | Highlights                                                                    |
| ------- | ---------- | ----------------------------------------------------------------------------- |
| 0.1.0   | (alpha)    | Now Core API, ESLint throw-ban, Vitest support, `README`                      |
| 0.2.0   | Jul 22     | useResult React hook, codemod CLI (`throw` → `err`)                           |
| 0.3.0   | Aug 15     | Fluent combinators (`andThen`, `mapErr`), pipeline helper, safeBoundary proxy |
| 0.4.0   | Sep        | VSCode extension (squiggles + quick-fix), docs site                           |
| 1.0.0   | Q1 2026    | API freeze, TS transformer sugar (`unwrap()`), full benchmark suite           |
### Stretch targets

• TS Playground embed + interactive docs
• Deno & Bun native bundles
• Babel/ts-morph codemod for postfix unwrap syntax

---
## Contributing

```bash
git clone https://github.com/flyingrobots/zerothrow
cd zerothrow
npm i
npm test # must stay green
```  

1. Open an issue if it’s a breaking change.
2. Follow Conventional Commits (`feat:`, `fix:`, `etc.`).
3. Run `npm run lint && npm test` before pushing.

---
## License

MIT © 2025 J. Kirby Ross • http://github.com/flyingrobots/ • james@flyingrobots.dev
