# Test Coverage Report

Generated: 2025-01-06

## Overall Coverage: 64.62%

### Coverage Breakdown

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| **All files** | 64.62% | 75.51% | 76.92% | 64.62% |
| src/index.ts | 100% | 100% | 100% | 100% |
| src/react-entry.ts | 100% | 100% | 100% | 100% |
| src/react-hooks.ts | 7.89% | 100% | 0% | 7.89% |
| src/components/ResultBoundary.tsx | 100% | 100% | 100% | 100% |
| src/hooks/useResult.ts | 98.41% | 88.88% | 100% | 98.41% |
| src/hooks/useResilientResult.ts | 69.1% | 57.89% | 100% | 69.1% |

### Coverage Gaps

1. **react-hooks.ts (7.89%)**: Legacy hook implementation, deprecated in favor of new hooks
   - Lines 16-57 uncovered
   - This file exports the old `useResult` API for backward compatibility

2. **useResilientResult.ts (69.1%)**:
   - Missing coverage for retry scheduling logic (lines 196-208)
   - Circuit breaker state transitions (lines 216-218)
   - Error cleanup handlers (lines 231-232)

3. **useResult.ts (98.41%)**:
   - Single line uncovered (line 59) - edge case in error handling

### Notes

- Config files (tsup.config.ts, vitest.config.ts) are excluded from meaningful coverage
- Core functionality has good coverage (>69% for all active hooks)
- ResultBoundary component has full coverage
- Main exports are fully covered

### Recommendations

1. Add tests for resilient result edge cases:
   - Retry scheduling with different backoff strategies
   - Circuit breaker state machine transitions
   - Cleanup on component unmount during active retries

2. Consider removing or deprecating react-hooks.ts if no longer needed

3. Target coverage goal: 90% for active source files