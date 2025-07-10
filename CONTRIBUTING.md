# Contributing to ZeroThrow

First off, thank you for considering contributing to ZeroThrow! It's people like you that make ZeroThrow such a great tool for the TypeScript community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
  - [Git Commit Messages](#git-commit-messages)
  - [TypeScript Style Guide](#typescript-style-guide)
  - [Documentation Style Guide](#documentation-style-guide)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Code of Conduct

This project and everyone participating in it is governed by the [ZeroThrow Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to james@flyingrobots.dev.

## Getting Started

### First-Time Setup Checklist

- [ ] Fork the repo on GitHub
- [ ] Clone your fork locally
- [ ] Install dependencies: `pnpm install`
- [ ] **Set up Git hooks**: `pnpm run githooks` (see [Git Hooks Documentation](docs/githooks.md))
- [ ] Run tests to verify setup: `pnpm test`
- [ ] Configure your editor for TypeScript and ESLint

### Making Changes

#### ⚠️ v0.3.0 Release Branch Workflow (ACTIVE UNTIL v0.3.0 RELEASE)

For all feature work targeting v0.3.0:

1. **Check out the release branch**:
   ```bash
   git checkout release/v0.3.0
   git pull origin release/v0.3.0
   ```

2. **Create your feature branch from release/v0.3.0**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Make your changes**

4. **Run tests and lint**: `pnpm test && pnpm run lint`

5. **Commit your changes** (pre-commit hooks will run automatically)

6. **Push to your fork** (pre-push hooks will run comprehensive tests)

7. **Submit a pull request targeting release/v0.3.0**:
   ```bash
   gh pr create --base release/v0.3.0
   ```

#### Standard Workflow (POST v0.3.0)

1. Create a branch for your changes from `main`
2. Make your changes
3. Run tests and lint: `pnpm test && pnpm run lint`
4. Commit your changes (pre-commit hooks will run automatically)
5. Push to your fork (pre-push hooks will run comprehensive tests)
6. Submit a pull request to `main`

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include code samples** (use markdown code blocks)
- **Include your environment details** (Node version, TypeScript version, OS)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Include screenshots and animated GIFs in your pull request whenever possible
- Follow the [TypeScript](#typescript-style-guide) style guide
- Include thoughtfully-worded, well-structured tests
- Document new code
- End all files with a newline

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/zerothrow
cd zerothrow

# Install dependencies
pnpm install

# IMPORTANT: Set up git hooks for automated quality checks
pnpm run githooks
# This enables:
# - Pre-commit: runs tests and linting on staged files
# - Pre-push: runs full test suite in Docker containers
# See docs/githooks.md for details

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Run linting
pnpm run lint

# Build the project
pnpm run build
```

### Git Hooks

We strongly recommend setting up Git hooks to maintain code quality. The hooks will:
- **Pre-commit**: Run tests and ESLint on staged files
- **Pre-push**: Run the full test matrix in Docker containers to ensure CI will pass

For more information, see the [Git Hooks Documentation](docs/githooks.md).

## Style Guidelines

### Git Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Types:
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that don't affect code meaning (white-space, formatting)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Code change that improves performance
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools

Examples:
```
feat: add Result.mapErr method
fix: handle null values in tryR
docs: update API examples in README
test: add coverage for wrap function
```

### TypeScript Style Guide

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- No `any` types without explicit justification
- Use early returns to reduce nesting

### Documentation Style Guide

- Use Markdown for all documentation
- Include code examples for all features
- Keep language clear and concise
- Update the README.md if you change functionality

## Testing

- Write tests for all new functionality
- Maintain or increase code coverage (aim for >80%)
- Run the full test suite before submitting a PR
- Include both positive and negative test cases
- Test edge cases

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run tests with coverage
pnpm run test:coverage
```

## Project Structure

```
zerothrow/
├── src/                 # Source code
│   ├── index.ts        # Main entry point
│   ├── error.ts        # ZeroError class
│   ├── result.ts       # Result type and helpers
│   └── eslint/         # ESLint plugin
├── test/               # Test files
├── docs/               # Documentation
├── scripts/            # Build and utility scripts
└── examples/           # Example usage
```

## Questions?

Feel free to open an issue with your question or reach out directly at james@flyingrobots.dev.

Thank you for contributing! 🚀