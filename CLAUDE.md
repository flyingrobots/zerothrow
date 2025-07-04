# OPERATION "ZERO-THROW RESILIENCE" 

## 🎯 IMMEDIATE ACTION REQUIRED

**ALPHA RELEASE BLOCKED BY:**
1. **CI failing** - Tests moved to packages but infrastructure incomplete
2. **Core package contaminated** with logger/react/eslint code - IN PROGRESS
3. **Package extraction incomplete** - Need to finish moving code and fix imports

**YOUR NEXT MISSION:** Complete Phase 4 - Package Extraction
- Extract code to proper packages
- Fix all imports and dependencies
- Get CI passing
- Merge PR #10

---

## 📊 CURRENT STATUS

**Branch:** `feat/zt-surface-lift` → **Target:** `main`
**PR:** #10 (pending CI fixes)

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ COMPLETE | Operational readiness |
| 1 | ✅ COMPLETE | Fast fixes (build, types, DB tests) |
| 2 | ✅ COMPLETE | Monorepo skeleton |
| 3 | ✅ COMPLETE | ZT Surface Lift (all P0-P7 done) |
| **4** | **⏳ IN PROGRESS** | **Package extraction & CI fixes** |
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
- [x] P4: PURGED `tryR` FROM ALL FILES
- [x] P5: Updated tests & examples to use new API
- [x] P6: Added ESLint rule to ban old names
- [x] P7: Created PR #10

---

## 📋 PHASE 4: PACKAGE EXTRACTION (Current Focus)

**Status:** IN PROGRESS - Fixing CI by setting up package infrastructure

### Tasks
- [ ] **Create package structure**
  - [x] Create package directories
  - [x] Move tests to respective packages
  - [x] Create package.json for each package
  - [ ] Create src directories and move code
  - [ ] Update imports and dependencies
- [ ] **Fix CI**
  - [ ] Update test scripts to run all package tests
  - [ ] Update build scripts for all packages
  - [ ] Ensure all tests pass in CI

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

## 📝 HOW TO UPDATE CLAUDE.md

When updating this file:
1. **Keep IMMEDIATE ACTION REQUIRED section current** - Remove completed blockers
2. **Update CURRENT STATUS table** - Mark phases complete, update current phase
3. **Remove outdated information** - Delete completed TODOs, old instructions
4. **Update mission objectives** - Keep YOUR NEXT MISSION current
5. **Always include SITREP at bottom** - Replace existing one with current status

---

## 📊 SITREP (2025-07-03 19:30 PST)

**SITUATION:**
- Phase 3 COMPLETE - All `tryR` references purged, new API in place
- PR #10 created but CI failing due to moved tests
- Currently extracting packages to fix CI

**COMPLETED TODAY:**
- ✅ Purged all 24 `tryR` references 
- ✅ Updated all tests/examples to new API
- ✅ Added ESLint rule banning old names
- ✅ Created PR #10
- ✅ Moved tests to future package homes
- ✅ Started package extraction

**BLOCKERS:**
- ❌ CI failing - tests looking for moved files
- ❌ Package infrastructure incomplete

**NEXT ACTIONS:**
1. Finish moving source code to packages
2. Update imports and dependencies
3. Fix test/build scripts
4. Get CI green
5. Merge PR #10

**HOO-RAH!** 🎖️