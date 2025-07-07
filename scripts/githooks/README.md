# ZeroThrow Git Hooks

TypeScript Git hooks that enforce the issue-driven development workflow defined in CLAUDE.md.

## Hooks

### pre-commit.ts
- Validates branch name follows issue-driven format: `{type}/#{issue}-{description}`
- Checks for partially staged files with interactive staging
- Runs ESLint on staged files
- Reminds to assign yourself to the referenced issue

### commit-msg.ts
- Validates commit message format: `[package] type: subject (#issue)`
- Enforces issue references in all commits
- Exempts merge commits and release commits

### pre-push.ts
- Runs tests before pushing
- Checks build passes
- Ensures code quality before sharing

## Installation

```bash
# Run the setup script
pnpm exec tsx scripts/githooks/setup-hooks.ts

# The script will:
# 1. Install necessary dependencies (tsx, eslint)
# 2. Set up hooks based on your preference (Husky or vanilla)
# 3. Configure Git to use the hooks
```

## Manual Installation

If you prefer manual setup:

```bash
# For Husky users
echo '#!/usr/bin/env bash\npnpm exec tsx scripts/githooks/pre-commit.ts' > .husky/pre-commit
echo '#!/usr/bin/env bash\npnpm exec tsx scripts/githooks/commit-msg.ts "$1"' > .husky/commit-msg
echo '#!/usr/bin/env bash\npnpm exec tsx scripts/githooks/pre-push.ts' > .husky/pre-push
chmod +x .husky/*

# For vanilla Git hooks
mkdir -p .githooks
echo '#!/usr/bin/env bash\npnpm exec tsx scripts/githooks/pre-commit.ts' > .githooks/pre-commit
echo '#!/usr/bin/env bash\npnpm exec tsx scripts/githooks/commit-msg.ts "$1"' > .githooks/commit-msg
echo '#!/usr/bin/env bash\npnpm exec tsx scripts/githooks/pre-push.ts' > .githooks/pre-push
chmod +x .githooks/*
git config core.hooksPath .githooks
```

## Bypass Hooks (Emergency Only)

```bash
# Skip hooks for a single commit
git commit --no-verify -m "emergency: fixing critical issue"

# But you should really create an issue first!
gh issue create --title "Critical: Description" --label "critical"
```

## Development

All hooks are written in TypeScript and dogfood ZeroThrow:
- Use Result types instead of throwing exceptions
- Chain operations with `andThen`, `map`, `tap`
- Handle errors gracefully with typed error codes

## Configuration

Hooks respect environment variables:
- `ZEROHOOK_DEBUG=1` - Enable debug output
- `CI=true` - Skip interactive prompts in CI environments