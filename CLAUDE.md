# CLAUDE.md - Work Progress Tracker

## Completed Mandates

✅ **MANDATE 1: Enable verbatimModuleSyntax**
- Added `"verbatimModuleSyntax": true` to all tsconfig files
- Fixed trailing newlines for POSIX compliance
- Commits: 
  - `chore(tsconfig): add verbatimModuleSyntax to enable Node16 import behavior`
  - `chore: add trailing newlines to tsconfig files for POSIX compliance`

✅ **MANDATE 2: Fix module and moduleResolution everywhere**
- Verified all tsconfig files already have:
  - `"module": "Node16"`
  - `"moduleResolution": "node16"`
- No changes needed

## Outstanding Mandates

✅ **MANDATE 3: Add .js extensions to relative imports**
- Updated all `./some/path` style imports to `./some/path.js`
- Affected all .ts, .tsx, .test.ts, and .test.tsx files
- Used sed to batch update all files

🔲 **MANDATE 4: Convert all export type lines to combined syntax**
- Change separate export statements to combined syntax
- Example: `export { Foo }; export type { Bar };` → `export { Foo, type Bar };`

🔲 **MANDATE 5: Rip out @eslint/js and use @typescript-eslint**
- Remove @eslint/js from eslint.config.js
- Replace with @typescript-eslint/eslint-plugin and parser

🔲 **MANDATE 6: Update .lintstagedrc.json**
- Ensure Prettier runs after ESLint
- Update to: `["eslint --fix", "prettier --write"]`

🔲 **MANDATE 7: Isolate Prettier formatting pass**
- Run `npx prettier --write .`
- Stage and commit only formatting changes
- NOTE: Must be done AFTER all semantic changes

🔲 **MANDATE 8: Patch Pino and Winston serializers to support Result types**
- Update logger serializer functions to handle Result<T, E> objects

🔲 **MANDATE 9: Patch no-throw ESLint fixer**
- Modify fixer to inject Result<*, *> return types when transforming throw to return err(...)

🔲 **MANDATE 10: Un-ignore tests/** in eslint.config.js**
- Remove or adjust `ignores: ['tests/**']` to allow linting tests

## Important Notes
- NO `git add -A` allowed
- Use `git add -p` for selective staging
- One commit per mandate
- Each mandate must be completed independently