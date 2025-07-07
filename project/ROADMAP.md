# 🛡️ ZeroThrow Roadmap - The Path to v0.3.0

*"No error shall pass unhandled, no retry shall go unseen, and no any shall defile our types."*  
**— Emperor Zero, First of His Name**

## Philosophy

**Minimal overhead, maximal clarity, zero exceptions.**

This roadmap prioritizes solving real developer pain points over theoretical completeness. Every feature must address actual user suffering.

---

## 🎯 v0.3.0 - The Great Standardization (BREAKING)

*Target: Q1 2025*

### 🧱 Core Package - v0.3.0 (BREAKING)

#### ✅ ErrorCode Standardization (#69) **[CRITICAL]**
- **Why**: "Stringly-typed error codes lead to typos and inconsistency"
- **What**: Introduce `ErrorCode` enum and `ZeroError` type
- **Breaking**: Yes - error creation API changes

```typescript
// Before
ZT.err('AUTH_FAILED', 'Invalid credentials')

// After
ZT.err({
  code: ErrorCode.AUTH_FAILED,
  message: 'Invalid credentials',
  meta: { attemptCount: 3 }
})
```

#### ✅ Error Tracing Utilities (#70) **[HIGH]**
- **Why**: "Debugging long andThen() chains is hell"
- **What**: Add `.trace()` method and `ZT.debug()` utility
- **Breaking**: No

```typescript
const result = await fetchUser(id)
  .trace('fetchUser')
  .andThen(validate)
  .trace('validate')
  .tapErr(e => console.error(ZT.debug(e)))
```

### 🔁 Resilience Package - v0.3.0

#### ✅ Conditional Retry Logic (#71) **[HIGH]**
- **Why**: "Not all errors deserve second chances"
- **What**: Add `shouldRetry` predicate to RetryPolicy
- **Breaking**: No

```typescript
RetryPolicy.exponential({
  maxRetries: 3,
  shouldRetry: (e) => e.code !== ErrorCode.AUTH_FAILED
})
```

#### ✅ Retry Progress Events (#72) **[HIGH]**
- **Why**: "Silent retries confuse users"
- **What**: Lifecycle callbacks for visibility
- **Breaking**: No

#### ✅ Jitter Support (#77) **[MEDIUM]**
- **Why**: "Avoid thundering herds"
- **What**: Built-in jitter strategies
- **Breaking**: No

#### 🎭 Sneaky Additions (Solving Real Problems)

##### Conditional Policies (#53) **[MEDIUM-HIGH]**
- **Hidden Need**: Different strategies for different contexts
- **Marketing**: "Smart context-aware retry strategies"

##### Bulkhead Policy (#47) **[MEDIUM-HIGH]**
- **Hidden Need**: Form double-submission, resource exhaustion
- **Marketing**: "Automatic double-submit protection"

##### Hedge Policy (#48) **[MEDIUM]**
- **Hidden Need**: P99 latency reduction
- **Marketing**: "Performance mode - 50% faster API calls"

### ⚛️ React Package - v0.3.0

#### ✅ useResultForm (#73) **[HIGH]**
- **Why**: "Forms are the chaos dimension"
- **What**: Official form handling with Result types
- **Includes**: Bulkhead for double-submit protection!

#### ✅ Advanced State Introspection (#76) **[HIGH]**
- **Why**: "loading: boolean is too coarse"
- **What**: Granular state (`idle`, `executing`, `retrying`, `settled`)

---

## 🛠️ Developer Experience - v0.3.0

### ✅ Automated Publishing Script (#55) **[CRITICAL]**
- **Why**: "jesus we gotta automate that ASAP it's such a pain in the ass"
- **What**: One command to rule them all
- **When**: BEFORE v0.3.0 release!

### ✅ throw-to-result Codemod (#75) **[HIGH]**
- **Why**: Enable migration at scale
- **What**: AST-based transformation tool

### ✅ Official ROADMAP.md (#74) **[DONE]** ✅
- You're reading it!

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

### Phase 1: Foundation (Week 1-2)
1. **Automated publishing script** (#55) - Need this for release!
2. **ErrorCode standardization** (#69) - Core breaking change
3. **Error tracing** (#70) - Developer experience

### Phase 2: Resilience (Week 2-3)
1. **Conditional retry** (#71) - Explicit requirement
2. **Progress events** (#72) - User visibility
3. **Jitter support** (#77) - Production safety
4. **Sneaky patterns** (#47, #48, #53) - Bundle as "features"

### Phase 3: React & Tools (Week 3-4)
1. **useResultForm** (#73) - With Bulkhead!
2. **State introspection** (#76) - Better loading states
3. **Codemod tool** (#75) - Migration support

### Phase 4: Release (Week 4)
1. Final testing and integration
2. Documentation updates
3. Migration guides
4. **AUTOMATED RELEASE** 🎉

---

## 👑 Imperial Mandates

The following are law in the Empire of Zero Exceptions:

1. **All errors must be expressed as values**
2. **No exceptions shall be thrown in userland**
3. **All async actions shall return Result<T, E>**
4. **All retries must be intentional and visible**
5. **All contexts must resolve to Results, not chaos**
6. **No `any` type shall defile our pure types**

---

## 📊 Success Metrics

- **Developer Happiness**: Reduced debugging time, clearer errors
- **Production Stability**: Fewer cascading failures, better resilience
- **Adoption Velocity**: Successful migrations using our tools
- **Performance**: Maintained or improved vs try/catch

---

## 🚀 Beyond v0.3.0

### Phase 3: Enterprise Features (v0.4.x)
- Logger integrations (Winston, Pino)
- OpenTelemetry tracing
- GraphQL integration

### Phase 4: Advanced Patterns (v0.5.x)
- Policy algebra (if requested)
- Stream processing
- Effect system integration

---

*"Let no error pass in darkness. Let no retry go unwitnessed. Let no form submit twice."*

**The road is set. The empire shall rise.** 🛡️