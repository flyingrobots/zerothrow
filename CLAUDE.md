# ZeroThrow Project Guide

This guide contains essential information about the ZeroThrow monorepo for AI assistants.

## Project Overview

ZeroThrow is a TypeScript error handling library that replaces exceptions with type-safe Result types. The core philosophy: **Stop throwing, start returning.**

### Key Mental Model
1. **Write functions that return Results from the beginning** - Don't throw then wrap
2. **Only use `ZT.try` at absolute boundaries** - When interfacing with code you don't control
3. **Results are your primary return type** - Not an afterthought or wrapper

## Repository Structure

```
zerothrow/
├── packages/
│   ├── core/           # Core Result<T,E> type (v0.2.3)
│   ├── resilience/     # Retry, circuit breaker, timeout (v0.2.1)
│   ├── jest/           # Jest matchers (v1.1.1)
│   ├── vitest/         # Vitest matchers (v1.1.1)
│   ├── testing/        # Unified test package (v1.1.1)
│   ├── expect/         # Shared matcher logic (v0.2.1)
│   ├── docker/         # Docker utilities (v0.1.3)
│   ├── zt-cli/         # CLI tooling (v0.1.3)
│   ├── eslint-plugin/  # ESLint rules (unpublished)
│   └── react/          # React hooks (v0.2.1)
├── docs-src/           # Source for transcluded documentation
├── scripts/            # Build and release scripts
├── README.md           # Monorepo control tower
└── ECOSYSTEM.md        # Complete package listing
```

## Development Workflow

### 🎯 CRITICAL: GitHub Issue-Driven Development

**ALL WORK MUST BE TRACKED THROUGH GITHUB ISSUES!**

1. **Before starting ANY work:**
   - Check if an issue exists: `gh issue list --search "keywords"`
   - If not, create one: `gh issue create --title "feat: description" --label "appropriate-labels"`
   - Assign yourself: `gh issue edit {number} --add-assignee @me`

2. **Project Board Workflow:**
   - New issues → Auto-added to "Backlog"
   - Starting work → Move to "In Progress" (happens when assigned)
   - PR created → Auto-moves to "In Review"
   - PR merged → Auto-moves to "Done" + closes issue

3. **Issue Status Commands:**
   ```bash
   # View project board status
   gh project item-list 1 --owner zerothrow --limit 20
   
   # Check your assigned issues
   gh issue list --assignee @me
   
   # View issues in progress
   gh issue list --label "in-progress"
   ```

### Prerequisites
- Node.js 18+
- pnpm 9+ (`npm install -g pnpm`)
- Docker (optional, for full test matrix)
- GitHub CLI (`gh`) - REQUIRED for issue tracking

### Common Commands
```bash
# Setup
pnpm install

# Development
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm lint               # Lint check
pnpm run ci:local       # Full CI simulation

# Package-specific
pnpm --filter @zerothrow/core test
pnpm --filter @zerothrow/core build
```

### Git Workflow (Issue-Based)

**EVERY BRANCH MUST REFERENCE AN ISSUE!**

#### ⚠️ v0.3.0 Release Branch Workflow (ACTIVE UNTIL v0.3.0 RELEASE)

```bash
# 1. First, claim your issue
gh issue edit {number} --add-assignee @me

# 2. Create branch FROM release/v0.3.0 (not main!)
git checkout release/v0.3.0
git pull origin release/v0.3.0
git checkout -b feat/#{issue-number}-description

# 3. Keep your branch updated
git checkout release/v0.3.0
git pull origin release/v0.3.0
git checkout feat/#{issue-number}-description
git rebase release/v0.3.0

# 4. Link commits to issue
git commit -m "[package] feat: description (#issue-number)"

# 5. Create PR targeting release/v0.3.0 (not main!)
gh pr create --base release/v0.3.0 --title "feat: description" --body "Closes #issue-number"
```

**This ensures all v0.3.0 features are integrated together before merging to main.**

#### Standard Workflow (POST v0.3.0)

```bash
# 1. First, claim your issue
gh issue edit {number} --add-assignee @me

# 2. Create branch from main
git checkout -b feat/#{issue-number}-description
# Examples:
#   feat/#69-error-code-standardization
#   fix/#70-tracing-utilities
#   chore/#55-automated-publishing

# 3. Link commits to issue
git commit -m "[package] feat: description (#issue-number)"

# 4. Create PR linked to issue
gh pr create --title "feat: description" --body "Closes #issue-number"
```

**Branch Naming Convention:**
- `feat/#{number}-{description}` - New features
- `fix/#{number}-{description}` - Bug fixes
- `chore/#{number}-{description}` - Maintenance tasks
- `docs/#{number}-{description}` - Documentation only

## Commit Guidelines

### Format (WITH ISSUE REFERENCE)
```
[{package}] {type}: {subject} (#{issue-number})

{body}

Closes #{issue-number}
(optional) BREAKING CHANGE: {details}
```

**EVERY COMMIT MUST REFERENCE AN ISSUE!**

> [!important] If you can't find a package name that describes your commit, you're probably committing too much at once. Target packages with your commits: one commit affecting one package.

### Examples (WITH ISSUE NUMBERS)
```
[core] feat: add Result.tap method for side effects (#123)
[jest] fix: handle undefined values in toBeOkWith matcher (#124)
[resilience] docs: add circuit breaker examples (#125)

# Commit bodies should close issues:
[core] feat: implement ErrorCode standardization (#69)

Implements enum-based error codes to replace stringly-typed errors.

Closes #69
BREAKING CHANGE: ZT.err() now requires ErrorCode enum
```

### Rules
- **One package per commit** - Keep changes focused
- **Atomic commits** - Each commit should be independently valid
- **Test with code** - Include tests in the same commit as features
- **Build before commit** - Ensure packages build successfully

## Documentation System

We use markdown-transclusion for modular documentation:

```bash
# Generate docs from templates
pnpm zt docs generate

# Templates live in docs-src/
# Shared components in docs-src/shared/
```

## Release Process

### 1. Version Bump
```bash
# Update package.json versions
# Update CHANGELOG.md
# Update README/ECOSYSTEM versions
```

### 2. Commit and Push
```bash
git add -A
git commit -m "chore: release v{version}"
git push
```

### 3. Publish to npm
```bash
cd packages/{package}
npm publish --otp={otp}
```

### Publishing Order (respect dependencies)
1. Core first
2. Packages that depend on core (resilience, expect)
3. Test packages last (jest, vitest, testing)

## Testing Philosophy

- **Write behavior tests, not implementation tests**
- **Test the public API, not internals**
- **Use Result matchers for clean assertions**
- **No try/catch in tests - use Result patterns**

## Key Design Decisions

### Zero Dependencies
All packages aim for zero runtime dependencies. This ensures:
- Small bundle sizes
- No dependency conflicts
- Predictable behavior

### Modular Architecture
- Small, focused packages that do one thing well
- Compose packages for complex use cases
- Each package has its own README and tests

### Result-First API
- Functions return Results, not throw exceptions
- Errors are values, not control flow
- Composable error handling with combinators

## Common Patterns

### Creating Results
```typescript
// Your functions
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return ZT.err('DIV_BY_ZERO');
  return ZT.ok(a / b);
}

// Third-party code
const parsed = ZT.try(() => JSON.parse(input));
```

### Chaining Operations
```typescript
userResult
  .map(user => user.name)
  .andThen(name => validateName(name))
  .tap(name => console.log('Valid name:', name))
  .unwrapOr('Anonymous')
```

## GitHub Issue Integration

### Starting Work on ZeroThrow:

1. **Check the project board:**
   ```bash
   # View all issues by status
   gh project item-list 1 --owner zerothrow --limit 30
   
   # Find issues in Priority Queue
   gh issue list --search "project:zerothrow/1 status:Priority Queue"
   ```

2. **Claim an issue:**
   ```bash
   # Assign yourself
   gh issue edit {number} --add-assignee @me
   
   # This automatically moves it to "In Progress" on the board!
   ```

3. **Create feature branch:**
   ```bash
   git checkout -b feat/#{number}-short-description
   ```

4. **Track progress:**
   - Comment on the issue with updates
   - Reference issue in all commits
   - PR will auto-link when you mention "Closes #{number}"

### Project Board Views:
- **By Phase** - See Phase 2/3/4 work distribution
- **By Package** - Work organized by package (Core, Resilience, React, etc.)
- **By Priority** - Critical → High → Medium → Low
- **By Status** - Backlog → Priority Queue → In Progress → In Review → Done

## Memory Integration

After completing work on an issue:
```
mcp__basic-memory__write_note
  title: "ZeroThrow #{issue} - {title}"
  folder: "projects/zerothrow/issues"
  content: {implementation details, decisions, learnings}
  tags: ["#zerothrow", "#issue-{number}", "#{package}"]
```

After significant changes, create a SITREP using POSIX timestamp:
```
mcp__basic-memory__write_note
  title: "ZeroThrow SITREP $(date +%s)_{subject}"
  folder: "projects/zerothrow/sitreps"
  content: {summary of changes}
  tags: ["#zerothrow", "#sitrep"]
```

### SITREP File Naming Convention
- Use POSIX timestamps to avoid date/timezone confusion
- Format: `{timestamp}_{subject}.md`
- Example: `1736219729_release-v0.2.3-preparation.md`
- This ensures chronological sorting and unique filenames

## Important Notes

### Issue-Driven Development Rules:
1. **NO WORK WITHOUT AN ISSUE** - Every change must track to an issue
2. **ASSIGN BEFORE STARTING** - Claims the work and updates project board
3. **REFERENCE IN COMMITS** - Every commit message includes `(#{number})`
4. **CLOSE WITH PR** - Use "Closes #{number}" in PR description
5. **UPDATE ISSUE STATUS** - Comment progress on complex issues

### Technical Requirements:
- **Check package versions** before releasing
- **Update documentation** when APIs change
- **Run tests locally** before pushing
- **Use pnpm** for all package operations
- **Follow Result-first patterns** in all examples

### Quick Issue Commands:
```bash
# Find something to work on
gh issue list --label "good first issue"
gh issue list --label "help wanted"
gh project item-list 1 --owner zerothrow | grep "Priority Queue"

# Create new issue
gh issue create --title "feat: amazing feature" \
  --body "Description of the feature" \
  --label "enhancement,zt-core" \
  --milestone "Phase 2: Developer Experience"

# Start work
gh issue edit 123 --add-assignee @me
git checkout -b feat/#123-amazing-feature

# Finish work
git commit -m "[core] feat: implement amazing feature (#123)"
gh pr create --title "feat: amazing feature" --body "Closes #123"
```

## Resources

- [API Documentation](packages/core/docs/api.md)
- [Ecosystem Overview](ECOSYSTEM.md)
- [Contributing Guide](CONTRIBUTING.md)
- [GitHub Discussions](https://github.com/zerothrow/zerothrow/discussions)