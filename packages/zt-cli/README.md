# @zerothrow/zt-cli

> **🧠 ZeroThrow Layers**  
> • **ZT** – primitives (`try`, `tryAsync`, `ok`, `err`)  
> • **Result** – combinators (`map`, `andThen`, `match`)  
> • **ZeroThrow** – utilities (`collect`, `enhanceAsync`)  
> • **@zerothrow/*** – ecosystem packages (resilience, jest, etc)

> **ZeroThrow Ecosystem** · [Packages ⇢](https://github.com/zerothrow/zerothrow/blob/main/ECOSYSTEM.md)

[![CI](https://github.com/zerothrow/zerothrow/actions/workflows/ci.yml/badge.svg)](https://github.com/zerothrow/zerothrow/actions)
![npm](https://img.shields.io/npm/v/@zerothrow/zt-cli)
![types](https://img.shields.io/npm/types/@zerothrow/zt-cli)
![ecosystem](https://img.shields.io/badge/zerothrow-ecosystem-blue)

ZeroThrow CLI tool for repo-wide workflows and package management automation.

<div align="center">
<img src="https://raw.githubusercontent.com/flyingrobots/image-dump/refs/heads/main/optimized/marketing/brand/zerothrow-zt-cli.webp" height="300" />
</div>

## Installation

### As a dev dependency in your project
```bash
npm install --save-dev @zerothrow/zt-cli
# or: pnpm add -D @zerothrow/zt-cli
```

### Global installation
```bash
npm install -g @zerothrow/zt-cli
# or: pnpm add -g @zerothrow/zt-cli
```

## Quick Start

The `zt` CLI provides a unified interface for managing ZeroThrow packages and development workflows:

```bash
# List all packages in the monorepo
zt list

# Check if packages are ready for publishing
zt package ready

# Run all validation checks
zt validate

# Generate documentation from templates
zt docs generate
```

## Commands

### `zt list` (alias: `zt ls`)

Lists all packages in the monorepo with their versions and metadata.

```bash
zt list
# or
zt ls
```

**Output:**
```
📦 ZeroThrow Packages

  @zerothrow/core         v0.2.3
  @zerothrow/resilience   v0.2.0
  @zerothrow/jest         v1.1.0
  ...

Total: 8 packages
```

### `zt package`

Package management utilities with multiple subcommands.

#### `zt package ready`

Checks if packages meet all requirements for publishing to npm.

```bash
# Interactive package selection
zt package ready

# Check all packages
zt package ready --all

# Check specific package
zt package ready --package core

# Show detailed check results
zt package ready --all --verbose

# Auto-fix issues where possible
zt package ready --fix

# Fix all packages
zt package ready --all --fix
```

**Exit Codes:**
- `0` - All selected packages are ready
- `1` - One or more packages are not ready
- `2` - Command error

**Output Modes:**
- `--verbose` - Shows every check with ✓ or ✗
- `--fix` - Auto-fix issues and prompt for manual fixes
- Default - Only shows failures (silence is golden)

The command checks:
- Accurate package description
- Correct package naming (`@zerothrow/*`)
- Required package.json fields (type, exports, main, module, types, etc.)
- Proper configuration (sideEffects, publishConfig, engines)
- Required files (README.md, CHANGELOG.md, LICENSE)
- Mascot image in marketing/brand directory
- README content requirements (badges, ecosystem links, install instructions)
- ECOSYSTEM.md inclusion and version accuracy

#### `zt package init`

Creates a new package from template.

```bash
# Interactive mode
zt package init

# With options
zt package init --name my-package --description "My awesome package"
```

### `zt validate`

Runs all validation checks across the monorepo.

```bash
# Run all checks
zt validate

# Auto-fix issues where possible
zt validate --fix

# Only validate staged files
zt validate --staged
```

**Checks performed:**
- Build (TypeScript compilation)
- Lint (ESLint)
- Type check
- Tests (via turbo)
- Format (Prettier)

### `zt ecosystem`

Manages the ECOSYSTEM.md file that documents all packages.

#### `zt ecosystem sync`

Updates ECOSYSTEM.md with current package information.

```bash
zt ecosystem sync
```

#### `zt ecosystem check`

Verifies ECOSYSTEM.md is up to date (useful for CI).

```bash
zt ecosystem check
```

### `zt docs`

Documentation generation utilities using markdown transclusion.

#### `zt docs generate`

Generates all documentation from templates, ensuring consistency across packages.

```bash
zt docs generate
```

This command:
1. Extracts package information (versions, descriptions)
2. Processes ECOSYSTEM.md from template
3. Processes all package READMEs from templates
4. Supports custom README templates per package
5. Uses markdown-transclusion for composable documentation

## External Commands

The CLI supports external commands via the `zt-{command}` naming convention. When you run `zt foo`, it will look for:
1. Built-in command named `foo`
2. External command `zt-foo` in your PATH

This allows extending the CLI with custom commands.

## Development

The CLI is built with:
- [Commander.js](https://github.com/tj/commander.js/) for CLI framework
- [Chalk](https://github.com/chalk/chalk) for terminal colors
- [Ora](https://github.com/sindresorhus/ora) for spinners
- [Inquirer](https://github.com/SBoudrias/Inquirer.js/) for interactive prompts
- [Markdown Transclusion](https://github.com/flyingrobots/markdown-transclusion) for documentation generation

## Examples

### Pre-publish Workflow

```bash
# Check all packages
zt package ready --all --verbose

# Fix issues automatically
zt package ready --all --fix

# Sync documentation
zt docs generate

# Run validation
zt validate

# Final check
zt ecosystem check
```

### Development Workflow

```bash
# List current packages
zt list

# Create new package
zt package init --name my-feature

# Check readiness
zt package ready --package my-feature

# Fix issues
zt package ready --package my-feature --fix
```

### CI Workflow

```bash
# Validate everything
zt validate

# Check ecosystem is in sync
zt ecosystem check

# Check all packages are ready
zt package ready --all
```

## Contributing

See the [main repository](https://github.com/zerothrow/zerothrow) for contribution guidelines.

## License

MIT