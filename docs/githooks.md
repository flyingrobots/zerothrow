# Git Hooks

## Table of Contents

- [Overview](#overview)
- [Quick Start (Automated Setup)](#quick-start-automated-setup)
- [Manual Setup Options](#manual-setup-options)
  - [1. Husky Setup (modern approach)](#1-husky-setup-modern-approach)
  - [2. Plain-bash hook (no extra dev-deps)](#2-plain-bash-hook-no-extra-dev-deps)
- [Additional Tips](#additional-tips)
  - [Pre-push gate](#pre-push-gate)
- [What the hooks enforce](#what-the-hooks-enforce)

---

## Overview

Built-in "no-throw" git hooks to enforce ZeroThrow discipline across your team. These hooks prevent commits containing `throw` statements from entering your codebase.

---

## Quick Start (Automated Setup)

We provide an intelligent setup script that handles everything for you:

```bash
npm run githooks
```

**What the script does:**
- 🔍 Detects your package manager (npm/yarn/pnpm)
- 🤝 Respects existing git hooks and asks before modifying
- 🐕 Supports both Husky and vanilla git hooks
- 📦 Installs missing dependencies if needed
- ⚙️ Creates ESLint config if missing
- 🪟 Works on Windows (requires Git Bash or WSL)

**Advanced usage:**
```bash
# Quiet mode for CI/automation
npm run githooks -- --quiet

# Verbose mode for debugging
npm run githooks -- --verbose

# Show help
npm run githooks -- --help
```

---

## Manual Setup Options

If you prefer to set up hooks manually, here are two approaches:

| Style | TL;DR |
|----|----|
|Husky + lint-staged (modern, cross-platform) | `npm i -D husky lint-staged && npx husky init && echo "npm run lint:staged" > .husky/pre-commit` |
| Vanilla `.githooks/pre-commit` (no deps) | Create `.githooks/pre-commit` with the script below, then `git config core.hooksPath .githooks` |

### 1. Husky Setup (modern approach)

#### Step 1 — Add husky + lint-staged

```bash
npm i -D husky lint-staged
```

#### Step 2 — Initialize Husky

```bash
npx husky init
```

#### Step 3 — Create the pre-commit hook

```bash
echo "npm run lint:staged" > .husky/pre-commit
```

#### Step 4 — Configure package.json and lint-staged

Add to your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint",
    "lint:staged": "lint-staged"
  }
}
```

Create `.lintstagedrc.json`:

```json
{
  "*.{ts,tsx}": ["eslint --max-warnings 0"]
}
```

**Note:** If using ESLint v9+, ensure you have an `eslint.config.js` file instead of `.eslintrc`. The `zerothrow/no-throw` rule will block commits containing raw `throw` statements.

---

### 2. Plain-bash hook (no extra dev-deps)

Create `.githooks/pre-commit`:

```bash
#!/usr/bin/env bash

# Fail commit if ESLint reports any error (including zerothrow/no-throw)
echo "[ZeroThrow] Running git hook..."
npm run lint --silent
EC=$?
if [ $EC -ne 0 ]; then
  echo "[ZeroThrow] Commit REJECTED!! ESLint errors detected:"
  echo "────────────────────────────────────────────────"
  npm run lint 2>&1 | head -n 20
  echo "────────────────────────────────────────────────"
  echo "[ZeroThrow] Fix these errors and try again."
  exit $EC
fi

echo "[ZeroThrow] All clear; commit allowed."
```

Then:

```bash
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

---

## Additional Tips

### Pre-push gate

Add a second hook to guarantee CI parity:

**For Husky:**
```bash
echo "npm run test && npm run lint" > .husky/pre-push
```

**For vanilla hooks:**
```bash
# Create .githooks/pre-push with similar structure
cp .githooks/pre-commit .githooks/pre-push
# Edit to run tests as well
```

Now a rogue throw can't slip in via force-push or "someone forgot to run tests locally."

---

## What the hooks enforce

- `zerothrow/no-throw` — any new throw kills the commit.
- All other ESLint errors (no-unused-vars, etc.) because we pass `--max-warnings 0`.
- Unit tests (if you wire the pre-push hook).

__Result:__ your `main` branch stays at `0 % throw violations` without babysitting PRs.