# OPERATION "ZERO-THROW RESILIENCE" 

## 🎯 IMMEDIATE ACTION REQUIRED

**ALPHA RELEASE BLOCKED BY:**
1. **24 files still using `tryR`** - MUST BE PURGED
2. **Core package contaminated** with logger/react/eslint code
3. **Unnecessary dependencies** in core package

**YOUR NEXT MISSION:** Complete Phase 3, Tasks P4-P7
- P4: Delete ALL `tryR` references (use `ZT.try` or `ZeroThrow.attempt`)
- P5: Update all tests and examples
- P6: Add ESLint rule to ban old names
- P7: Create PR

---

## 📊 CURRENT STATUS

**Branch:** `dogfood` → **Target:** `main`

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ COMPLETE | Operational readiness |
| 1 | ✅ COMPLETE | Fast fixes (build, types, DB tests) |
| 2 | ✅ COMPLETE | Monorepo skeleton |
| **3** | **⏳ IN PROGRESS** | **ZT Surface Lift (P0-P3 done, P4-P7 TODO)** |
| 4 | ⏳ PENDING | Docker & CI Infrastructure |
| 5 | ⏳ PENDING | Zero-Throw Resilience API |
| 6 | ⏳ PENDING | New helpers & tests |
| 7 | ⏳ PENDING | Final dress rehearsal & PR |

---

## 🚀 THE NEW API (Phase 3)

### Pocket Knife (99% of use cases)
```typescript
import { ZT } from '@zerothrow/zerothrow'

ZT.try(() => risky())     // Replaces tryR
ZT.ok(value)              // Create success
ZT.err(error)             // Create failure
```

### Full Arsenal (advanced usage)
```typescript
import { ZeroThrow } from '@zerothrow/zerothrow'

ZeroThrow.attempt()       // Replaces tryR (with overloads)
ZeroThrow.wrap()          // Replaces promise()
ZeroThrow.fromAsync()     // Replaces async()
ZeroThrow.pipe()          // Combinators
ZeroThrow.collect()       // Batch operations
```

### API Migration Table
| OLD (BANNED) | NEW (USE THIS) |
|--------------|----------------|
| `tryR()` | `ZT.try()` or `ZeroThrow.attempt()` |
| `tryRSync()` | `ZT.try()` or `ZeroThrow.attempt()` |
| `tryRBatch()` | `ZeroThrow.attempt()` |
| `promise()` | `ZeroThrow.wrap()` |
| `async()` | `ZeroThrow.fromAsync()` |
| `OK`, `ERR`, `AnyError` | REMOVED |

---

## 📋 PHASE 3: ZT SURFACE LIFT (Current Focus)

**Status:** P0-P3 COMPLETE, P4-P7 IN PROGRESS

### Completed ✅
- [x] P0: Intel prep - pulled main, green build
- [x] P1: Created `core-exports.ts` with clean names
- [x] P2: Created `zt-pocket-knife.ts` with lean API
- [x] P3: Updated `index.ts` exports

### TODO (MISSION CRITICAL) 🚨
- [ ] **P4: PURGE `tryR` FROM 24 FILES**
  - Run: `grep -r "tryR" packages/` to find them
  - Replace with `ZT.try()` or `ZeroThrow.attempt()`
- [ ] **P5: Update tests & examples**
  - All tests must use new API
  - Update example code
- [ ] **P6: Add ESLint rule**
  - Ban imports of old names
  - Add to `.config/eslint.config.js`
- [ ] **P7: Create PR**
  - Branch: `feat/zt-surface-lift`
  - Target: `main`

---

## 🏗️ ALPHA RELEASE PLAN

### Step 1: Extract Packages (After Phase 3)
```
packages/
├── core/                 # Pure Result<T,E> only
├── logger-winston/       # Winston integration
├── logger-pino/         # Pino integration  
├── eslint-plugin/       # ESLint rules
└── react/               # React hooks
```

### Step 2: Clean Dependencies
- Core: ZERO dependencies
- Each package: minimal deps

### Step 3: Verify & Ship
- Build all packages
- Test in fresh project
- Publish alpha

---

## ⚔️ RULES OF ENGAGEMENT

> [!failure] **NEVER** `git add -A` or stage everything

> [!success] **ALWAYS** tick boxes as you complete TASKS (not phases)

> [!important] **ALWAYS** obey the linter - fix code, not configs

> [!success] **ALWAYS** write behavior tests, not implementation tests

> [!failure] **BANNED:** Mocks, spies, stdout/stderr testing

---

## 🎖️ PROMOTION CRITERIA

**To earn Corporal stripes:**
- [ ] Green PR on first try
- [ ] All checkboxes ticked
- [ ] Zero `throw` statements
- [ ] Zero old API usage

**Fail any = KP duty with lint brush**

---

## 📊 FUTURE PHASES (After Phase 3)

### Phase 4: Docker & CI (30 min)
- Move Docker artifacts to `/tmp`
- Fix port conflicts (only 67 available)
- Re-enable `db-transaction.test.ts`

### Phase 5: Zero-Throw Resilience (2 hr) 🎯
**THE GAME CHANGER** - First retry library with ZERO performance penalty!
- Retry strategies (constant/linear/exponential)
- Circuit breaker
- Timeout handling
- Fluent builder API

### Phase 6: New Helpers (2 hr)
- `ZeroThrow.Async.unwrapOrElse`
- Rewrite flaky tests with resilience
- Maintain 90%+ coverage

### Phase 7: Final Checks (30 min)
- Full CI dress rehearsal
- Update CHANGELOG.md
- Create PR

---

## 📝 QUICK REFERENCE

**Git:**
- Current: `dogfood`
- Target: `main`
- Next PR: `feat/zt-surface-lift`

**Imports:**
```typescript
// Simple (99% of cases)
import { ZT } from '@zerothrow/zerothrow'

// Advanced
import { ZeroThrow } from '@zerothrow/zerothrow'
```

**Commands:**
```bash
turbo run build      # Build all packages
turbo run test       # Run all tests
turbo run lint       # Lint check
npm run ci:local     # Full dress rehearsal
```

---

## 📊 TECH DEBT TRACKER

### Critical (Blocks Alpha)
- [ ] 24 files using `tryR`
- [ ] Logger code in core
- [ ] React code in core
- [ ] ESLint plugin in core

### Known Issues
- [ ] Docker creates files in working dir (should use `/tmp`)
- [ ] Port conflicts (only 67 available)
- [ ] `db-transaction.test.ts` disabled
- [ ] 2 ESLint tests skipped

---

> **"NO THROWS, NO MERCY!"** — Cmdr Chat

**LATEST SITREP:** See `docs/claude/battle-logs/battle-log-2025-07-03.md`

**HOO-RAH!** 🎖️