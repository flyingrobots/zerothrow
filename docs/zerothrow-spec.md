# ZeroThrow

_Full Technical Specification (v0.1-draft, 30 Jun 2025)_   
https://github.com/zerothrow/zerothrow.git

---
## Table of Contents

- [1. Mission statement](#1-mission-statement)
- [2. Guiding principles](#2-guiding-principles)
- [3. Feature matrix](#3-feature-matrix)
- [4. Public API (v0.1)](#4-public-api-v01)
  - [4.1 ZeroError](#41-zeroerror)
  - [4.2 Result](#42-result)
  - [4.3 tryR](#43-tryr)
  - [4.4 wrap](#44-wrap)
- [5. Internal architecture](#5-internal-architecture)
- [6. Tooling & DX](#6-tooling--dx)
  - [6.1 Lint rule (@zerothrow/eslint)](#61-lint-rule-zerothrroweslint)
  - [6.2 TS-aware codemod (v0.2)](#62-ts-aware-codemod-v02)
- [7. Testing strategy](#7-testing-strategy)
- [8. Performance footprint](#8-performance-footprint)
- [9. Security considerations](#9-security-considerations)
- [10. Release & versioning](#10-release--versioning)
- [11. Road-map](#11-road-map)
- [12. Sample usage patterns](#12-sample-usage-patterns)
  - [12.1 Backend service (Express)](#121-backend-service-express)
  - [12.2 React component](#122-react-component)
- [13. Brand assets](#13-brand-assets)
- [14. Open questions / to-be-decided](#14-open-questions--to-be-decided)
- [15. Conclusion](#15-conclusion)

---
## 1. Mission statement

Zero throws in user-land.   
Provide a Rust-grade `Result<T,E>` discipline, rich error metadata, and iron-fisted tooling so a TypeScript code-base can run 100 % exception-free, without losing stack-traces, DX, or tree-shakability.

---
## 2. Guiding principles

1.	__No hidden control-flow:__ `throw` forbidden by linter; every failure is an explicit `Err`.
2.	__Zero friction:__ Ergonomics first: single-line wrappers, no verbose boilerplate, TS intellisense everywhere.
3.	__Preserve context:__ Chainable causes, error codes, structured context payload, original stack retained.
4.	__Runtime-agnostic:__ Works in Node ≥ `16.14`, Deno, Bun, modern browsers; no Node-specific deps.
5.	__Tiny & tree-shakable:__ Shipping budget: ≤ `4 kB` min+gz for browser ESM bundle.
6.	__Open, evolvable API:__ SemVer, typed extension points, no DTO formats frozen into strings.

---
## 3. Feature matrix

| Feature |	Status | 0.1 Notes |
|----|----|----|
| ZeroError class (code/ctx/cause) | ✅ | Preserves native Error semantics.
| `Result<T,E>` tagged union |	✅ |	`Ok` & `Err` helpers. |
| `tryR` adapter | 	✅ |	Promisify or sync. |
| wrap / err factories |	✅ | 	Maintain chain. |
| ESLint plugin zero-throw/no-throw |	✅ |	Blocks throw, allows config exceptions (test files, etc.). |
| CLI codemod (npx zero-throw migrate) |	`⏳ v0.2`	| Converts `throw new Error → return err(...)`. |
| Winston/Pino serializers |	✅	 | Structured logging. |
| Babel/TS transformer (foo! sugar) |	`⏳ v0.3` |	Postfix unwrap. |
| React error boundary hook |	`⏳ v0.3` |	Converts UI exceptions → `Err` results. |
| VSCode snippets / TS playground link |	`⏳ v0.3` |	DX polish. |

---
## 4. Public API (v0.1)

```typescript
// index.ts
// – primary surface – //

export { ZeroError, ErrorCode, ErrorContext } from "./error";
export {
  Result, Ok, Err, ok, err,
  tryR, wrap
} from "./result";
```

### 4.1 `ZeroError`

```typescript
export type ErrorCode = string | number | symbol;
export interface ErrorContext { [k: string]: unknown; }

export class ZeroError<C extends ErrorContext = ErrorContext> extends Error {
  readonly code: ErrorCode;
  readonly context?: C;
  constructor(
    code: ErrorCode,
    message: string,
    opts?: { cause?: Error; context?: C }
  )
}
```

- Prototype chain fixed for TS < ES2022.
- cause leverages native `Error.cause`; chain depth unlimited.
- No subclassing required; use codes to namespace.

### 4.2 `Result`

```typescript
export type Ok<T>               = { ok: true; value: T };
export type Err<E extends Error = ZeroError> = { ok: false; error: E };
export type Result<T,E extends Error = ZeroError> = Ok<T> | Err<E>;

export const ok  = <T>(v: T)                : Ok<T>;
export const err = <E extends Error>(e: E)  : Err<E>;
```

### 4.3 `tryR`

```typescript
export async function tryR<T, Ctx extends ErrorContext = ErrorContext>(
  thunk: () => Promise<T> | T,
  map?: (e: ZeroError<Ctx>) => ZeroError<Ctx>
): Promise<Result<T, ZeroError<Ctx>>>;
```

### 4.4 `wrap`

```typescript
export function wrap<C extends ErrorContext = ErrorContext>(
  cause: Error,
  code: ErrorCode,
  msg: string,
  ctx?: C
): ZeroError<C>;
```

---

## 5. Internal architecture

```
src/
 ├─ error.ts        // ZeroError class
 ├─ types.ts        // Ok / Err / Result helpers
 ├─ result.ts       // ok(), err(), tryR(), wrap()
 ├─ eslint/
 │   └─ noThrowRule.ts
 ├─ log/
 │   ├─ pino.ts
 │   └─ winston.ts
 ├─ index.ts
 └─ utils.ts        // tiny helpers, no external deps
```

- Build tool: `tsup` → ESM + CJS + `d.ts`.
- Target: ES2022 (gets native cause, top-level `await`).
- Polyfill branch for Node 14 if users compile down.

---
## 6. Tooling & DX

### 6.1 Lint rule (`@zerothrow/eslint`)

```typescript
module.exports = {
  meta: { type: "problem" },
  create(ctx) {
    return {
      ThrowStatement(node) {
        ctx.report({ node, message: "Use Result<T,E> instead of throw." });
      }
    };
  }
};
```

- Configurable glob allow-list (`test/**`, `migrations/**`).
- Companion rule require-result (optional) ensures every exported `async` function returns `Result`.

### 6.2 TS-aware `codemod` (v0.2)
- Uses `ts-morph`.
- Pattern: `throw <expr>` → `return err(normalize(<expr>))`.
- Emits `TODO` comments for complex flows.

---
## 7. Testing strategy

| Layer |	Framework |	Coverage goal |
|----|-----|-----|
| Core units (`error`, `result`) | 	Vitest |	100 % lines + branches |
| ESLint rule |	ESLint RuleTester |	All paths |
| Integration (Node/browser) |	Playwright headless	Build loads in browser and catches runtime `throw` |

### Snapshot examples

```typescript
expect(await tryR(() => JSON.parse("{"))).toMatchInlineSnapshot(`
  { ok: false,
    error: ZeroError {
      code: "UNKNOWN_ERR",
      message: "SyntaxError: Unexpected token { in JSON",
      cause: [SyntaxError],
    }
  }
`);
```

---
## 8. Performance footprint
- ZeroError allocation: `~64 B` + message (V8 short-string inlined up to 15 chars).
- `tryR`: adds one `Promise` wrapper when the thunk is `sync`; elided by V8 JIT in async path.
- No heavy regex or reflection.
- Tree-shakes to ≤ `1.9 kB` gz when importing only ZeroError.

---
## 9. Security considerations
- Does NOT stringify context automatically → caller chooses safe log serialization.
- ESLint rule prevents accidental leak of credentials via throw new Error(secret).
- CI mandates `npm audit --production`.
- Supply-chain integrity; `package.json#publishConfig: { provenance: true }.`

---
## 10. Release & versioning
- Conventional commits (`feat:`, `fix:`, `BREAKING:`).
- changeset auto-bumps SemVer.
- GitHub Actions:
    - build + vitest coverage + eslint on every PR.
    - `release.yml` publishes from tagged commit with provenance & signed package.

---
## 11. Road-map

| Version |	Tentative date |	Milestones |
|----|----|---|
| 0.1.0 |	01 Jul 2025	| Core API, ESLint, Pino/Winston serializers. |
| 0.2.0 |	Aug 2025	| Codemod CLI, documentation site (Docusaurus), VSCode snippets. |
| 0.3.0 |	Q4 2025	| TS transformer postfix !, React hook utilities, Deno first-class build. |
| 1.0.0	| Early 2026	| API freeze, RFC process, governance doc, contributor code-of-conduct. |

---
## 12. Sample usage patterns

### 12.1 Backend service (Express)

```typescript
app.get("/user/:id", async (req, res) => {
  const r = await tryR(() => db.getUser(req.params.id),
    e => wrap(e, "DB_ERR", "failed to load user", { id: req.params.id }));

  if (!r.ok) {
    logger.error(r.error);        // serializer keeps chain
    return res.status(500).json({ code: r.error.code });
  }
  res.json(r.value);
});
```

### 12.2 React component

```typescript
function Profile({ id }: { id: string }) {
  const [state, set] = useState<Result<User>>();
  useEffect(() => {
    tryR(() => api.fetchProfile(id)).then(set);
  }, [id]);

  if (!state) return <Spinner />;
  if (!state.ok)  return <ErrorView code={state.error.code} />;

  return <ProfileCard user={state.value} />;
}
```

---
## 13. Brand assets
- Logo (`SVG`/`png`) variants: full color, monochrome, icon-only.
- Favicon (`32×32`), social card (`1200×630`), `npm README badge`.
- Primary palette:
- `--zt-teal:  #00c6ff;`
- `--zt-violet:#b200ff;`
- `--zt-dark:  #0d1117;`

---
## 14. Open questions / to-be-decided

1. Should we adopt Algebraic effects once `TC39` lands → handle error blocks instead of unions?
2. Provide Opaque type wrapper vs. open interface (current design)?
3. Ship a ZeroThrow/strict preset that also bans untyped `Promise<void>` returns?

(Subject to upcoming RFCs.)

---
## 15. Conclusion

__ZeroThrow__ lays down a pragmatic-but-rigorous foundation for never-throw TypeScript.

With a lean core, aggressive tooling, and a clear upgrade path, it lets devs:

- model failure explicitly,
- log with full context,
- ship fewer production `500`s.

Time to add the badge to the `README`: [![ZeroThrow](https://img.shields.io/badge/throws-0%-teal?logo=zerothrow)](https://github.com/zerothrow/zerothrow)

```markdown
[![ZeroThrow](https://img.shields.io/badge/throws-0%-teal?logo=zerothrow)](https://github.com/zerothrow/zerothrow)
```
