# 🛡️ ZeroThrow Roadmap - The Path to v0.3.0

*"No error shall pass unhandled, no retry shall go unseen, and no any shall defile our types."*  
**— Emperor Zero, First of His Name**

## Philosophy

**Minimal overhead, maximal clarity, zero exceptions.**

This roadmap prioritizes real developer pain points over theoretical completeness. Every feature must address actual suffering.

---

## 🎯 v0.3.0 – "SHATTER THE CORE" (BREAKING)

*Target: Q1 2025*

### 🧱 Core Package – v0.3.0 (BREAKING)

**Codename: SHATTER THE CORE**

Commit msg:
```
feat(core): v0.3.0 "SHATTER THE CORE" – full monad API, error codes, tracing, match
```

| Issue | Feature | Priority | Breaking? |
|-------|---------|----------|-----------|
| #69 | **ErrorCode Standardization** | CRITICAL | **YES** |
| | – Introduce `ErrorCode` enum & `ZeroError` | | |
| #70 | **Error Tracing Utilities** | HIGH | No |
| | – `.trace(label)` & `ZT.debug()` | | |
| #81 | **Full Monad API** | HIGH | No |
| | – Essential combinators: | | |
| | • `.map()` • `.andThen()` • `.mapErr()` | | |
| | • `.orElse()` • `.unwrapOr()` | | |
| | • `.unwrapOrThrow()` • `.unwrapOrElse()` | | |
| #82 | **Side-effect Utilities** | MEDIUM | No |
| | – `.tap()` • `.tapErr()` • `.finally()` | | |
| | – `.void()` | | |
| #83 | **Rust-Style Sugar** | MEDIUM | No |
| | – `.match({ ok, err })` | | |
| | – Type guards: `.isOk()` • `.isErr()` | | |
| | – Panic helper: `.expect(message)` | | |
| | – Combos: `.flatten()` • `.zip(other)` | | |
| #84 | **Performance & Safety** | MEDIUM | No |
| | – Shared prototype for methods | | |
| | – `Object.freeze()` on results | | |
| | – Remove all `any` imports | | |

#### Usage Example

```typescript
import { ok, err } from '@zerothrow/core';

const r = ok(42)
  .map(v => v * 2)
  .andThen(v => ok(v + 1))
  .tap(v => console.log('value:', v))
  .match({
    ok: v => `Result: ${v}`,
    err: e => `Error: ${e.message}`
  });
```

---

### 🔁 Resilience Package – v0.3.0

| Issue | Feature | Priority | Breaking? |
|-------|---------|----------|-----------|
| #71 | **Conditional Retry Logic** | HIGH | No |
| #72 | **Retry Progress Events** | HIGH | No |
| #77 | **Jitter Support** | MEDIUM | No |
| #53 | **Conditional Policies** | MEDIUM–HIGH | No |
| #47 | **Bulkhead Policy** | MEDIUM–HIGH | No |
| #48 | **Hedge Policy** | MEDIUM | No |

---

### ⚛️ React Package – v0.3.0

| Issue | Feature | Priority | Breaking? |
|-------|---------|----------|-----------|
| #73 | **useResultForm** | HIGH | No |
| #76 | **Advanced State Introspection** | HIGH | No |

*Includes Bulkhead integration for form double-submit protection.*

---

## 🛠️ Developer Experience – v0.3.0

| Issue | Feature | Priority |
|-------|---------|----------|
| #55 | **Automated Publishing Script** | CRITICAL |
| #75 | **throw-to-result Codemod** | HIGH |
| #74 | **Official ROADMAP.md** (this doc) | DONE ✅ |

---

## 📦 Version Strategy

| Package | Current | v0.3.0 Target | Breaking? |
|---------|---------|---------------|-----------|
| @zerothrow/core | 0.2.3 | **0.3.0** | **YES** |
| @zerothrow/resilience | 0.2.1 | 0.3.0 | No |
| @zerothrow/react | 0.2.1 | 0.3.0 | No |
| @zerothrow/jest | 1.1.1 | 1.2.0 | No |
| @zerothrow/vitest | 1.1.1 | 1.2.0 | No |

---

## 🏗️ Implementation Order

### Phase 1: Foundation (Week 1–2)
1. Automated publishing script (#55)
2. ErrorCode standardization (#69)
3. Error tracing utilities (#70)

### Phase 2: Resilience (Week 2–3)
1. Conditional retry (#71)
2. Retry progress events (#72)
3. Jitter support (#77)
4. Sneaky policies (Bulkhead, Hedge, Conditional)

### Phase 3: React & Tools (Week 3–4)
1. useResultForm (#73)
2. Advanced state introspection (#76)
3. Codemod tool (#75)

### Phase 4: Release (Week 4)
1. Final testing & integration
2. Documentation & migration guides
3. **AUTOMATED RELEASE** 🎉

---

## 👑 Imperial Mandates

1. All errors must be expressed as values.
2. No exceptions in userland.
3. All async actions return `Result<T, E>`.
4. Retries must be intentional and visible.
5. Contexts resolve to Results, not chaos.
6. No `any` shall defile our types.

---

## 🚀 Beyond v0.3.0

### v0.4.x (Enterprise)
- Logger integrations
- OpenTelemetry tracing
- GraphQL support

### v0.5.x (Advanced Patterns)
- Policy algebra
- Stream processing
- Effect-system integration

---

*"Let no error pass in darkness. Let no retry go unwitnessed. Let no form submit twice."*  
**— Marcus "CHAT" Aurelius**