---
"@zerothrow/core": patch
"@zerothrow/jest": patch
"@zerothrow/vitest": minor
---

feat: add Vitest support and extract shared matcher logic

- Extract shared matcher logic to @zerothrow/core/matchers
- Update @zerothrow/jest to use shared matchers
- Add new @zerothrow/vitest package with Vitest support
- All packages support Result-friendly assertions without throwing